// db.js
// This file sets up our database connection and creates tables if they don't exist yet.
// We use SQLite — a database that lives in a single file (no separate server needed).

const Database = require('better-sqlite3');
const path = require('path');

// This creates (or opens, if it already exists) a file called "app.db"
const db = new Database(path.join(__dirname, 'app.db'));

// "PRAGMA" is a SQLite setting. This one makes reads/writes safer and faster.
db.pragma('journal_mode = WAL');

// Create the "users" table if it doesn't exist yet.
// Each row = one Telegram user.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create the "runs" table if it doesn't exist yet.
// Each row = one completed run by a user.
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    distance_km REAL NOT NULL,
    duration_sec INTEGER NOT NULL,
    avg_pace_sec_per_km REAL,
    gps_track TEXT NOT NULL,
    started_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

module.exports = db;
