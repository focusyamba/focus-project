// server.js
// This is the main entry point of our backend. It starts a web server
// and defines the "API endpoints" — the URLs the frontend talks to.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { verifyTelegramInitData } = require('./telegramAuth');
const { calculateTrackDistance } = require('./distance');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // GPS tracks can have many points, so allow bigger payloads

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------
// Middleware: checks Telegram login on every request that needs it.
// "Middleware" = a function that runs BEFORE the real endpoint code,
// usually to check something (like: is this user allowed to do this?).
// ---------------------------------------------------------------------
function requireTelegramAuth(req, res, next) {
  const initData = req.header('X-Telegram-Init-Data');
  const tgUser = verifyTelegramInitData(initData);

  if (!tgUser) {
    return res.status(401).json({ error: 'Invalid or missing Telegram login data' });
  }

  // Find or create the user in our database.
  let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tgUser.id);

  if (!user) {
    const result = db
      .prepare(
        'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES (?, ?, ?, ?)'
      )
      .run(tgUser.id, tgUser.username || null, tgUser.first_name || null, tgUser.last_name || null);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  req.user = user; // attach the user to the request so later code can use it
  next(); // continue to the actual endpoint
}

// ---------------------------------------------------------------------
// POST /api/auth
// Called once when the Mini App opens. Verifies the user and returns
// their profile. Also creates the user in the DB on first visit.
// ---------------------------------------------------------------------
app.post('/api/auth', requireTelegramAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------------------
// POST /api/runs
// Called when a user finishes a run. Receives the GPS track,
// calculates distance/pace, and saves it.
// ---------------------------------------------------------------------
app.post('/api/runs', requireTelegramAuth, (req, res) => {
  const { track, startedAt } = req.body;
  // track = array of { lat, lon, timestamp }

  if (!Array.isArray(track) || track.length < 2) {
    return res.status(400).json({ error: 'Track must have at least 2 GPS points' });
  }

  const distanceKm = calculateTrackDistance(track);
  const firstPoint = track[0];
  const lastPoint = track[track.length - 1];
  const durationSec = Math.round((lastPoint.timestamp - firstPoint.timestamp) / 1000);

  if (durationSec <= 0) {
    return res.status(400).json({ error: 'Invalid track timing' });
  }

  const avgPaceSecPerKm = distanceKm > 0 ? durationSec / distanceKm : null;

  const result = db
    .prepare(
      `INSERT INTO runs (user_id, distance_km, duration_sec, avg_pace_sec_per_km, gps_track, started_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      distanceKm,
      durationSec,
      avgPaceSecPerKm,
      JSON.stringify(track),
      startedAt || new Date(firstPoint.timestamp).toISOString()
    );

  const savedRun = db.prepare('SELECT * FROM runs WHERE id = ?').get(result.lastInsertRowid);

  res.json({ run: savedRun });
});

// ---------------------------------------------------------------------
// GET /api/runs
// Returns the logged-in user's run history, most recent first.
// ---------------------------------------------------------------------
app.get('/api/runs', requireTelegramAuth, (req, res) => {
  const runs = db
    .prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);

  res.json({ runs });
});

// ---------------------------------------------------------------------
// GET /api/runs/:id
// Returns one specific run, including the full GPS track (to draw the map).
// ---------------------------------------------------------------------
app.get('/api/runs/:id', requireTelegramAuth, (req, res) => {
  const run = db
    .prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  res.json({ run: { ...run, gps_track: JSON.parse(run.gps_track) } });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
