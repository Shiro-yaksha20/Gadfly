const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'tickets.json');

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ counter: 1, tickets: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };

/*
  NOTE ON PERSISTENCE:
  This stores tickets in a JSON file on disk. On most free hosts (Render free web
  service, Railway without a volume) the filesystem is wiped on redeploy/restart,
  but survives normal uptime in between. For this personal-scale use case that's
  usually fine. If you want tickets to survive redeploys too, either:
    - Add a persistent volume (Railway supports this directly), or
    - Swap this file for a free hosted SQLite like Turso, or Postgres on Neon/Supabase.
  The rest of the code only talks to readDb()/writeDb(), so swapping storage later
  means only touching this file.
*/
