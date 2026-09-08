// telegramAuth.js
// This file checks that the "initData" sent by the frontend really came from Telegram,
// and was not faked by someone sending a fake request directly to our API.
//
// How it works (short version):
// 1. Telegram gives the Mini App a string called "initData" (user info + a hash).
// 2. Telegram creates that hash using YOUR bot's secret token — something only you know.
// 3. We recreate the same hash on our server using the same secret.
// 4. If our hash matches Telegram's hash, the data is real. If not, someone faked it.

const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.warn('WARNING: BOT_TOKEN is not set in .env — Telegram login will not work.');
}

/**
 * Verifies Telegram initData and returns the user info if valid.
 * Returns null if the data is invalid or faked.
 */
function verifyTelegramInitData(initData) {
  if (!initData) return null;

  // initData looks like: "user=...&auth_date=...&hash=abc123"
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // Remove "hash" itself before recalculating — it's not part of the data being signed.
  params.delete('hash');

  // Telegram requires the remaining fields sorted alphabetically, joined with newlines.
  const dataCheckArr = [];
  for (const [key, value] of [...params.entries()].sort()) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join('\n');

  // Step 1: create a "secret key" from our bot token.
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  // Step 2: hash the data using that secret key.
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Step 3: compare our hash to Telegram's hash.
  if (calculatedHash !== hash) {
    return null; // Faked or corrupted data — reject it.
  }

  // Optional but recommended: reject old requests (older than 24 hours).
  const authDate = Number(params.get('auth_date'));
  const MAX_AGE_SECONDS = 24 * 60 * 60;
  if (Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    return null;
  }

  // Data is valid — parse and return the user info.
  const userJson = params.get('user');
  if (!userJson) return null;

  return JSON.parse(userJson); // { id, username, first_name, last_name, ... }
}

module.exports = { verifyTelegramInitData };
