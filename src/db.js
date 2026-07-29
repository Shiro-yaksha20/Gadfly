const { Redis } = require('@upstash/redis');

// One JSON blob holding everything, stored under a single Redis key —
// mirrors the old local-file structure exactly, just over the network now.
const DB_KEY = 'gadfly:tickets-db';

let redis = null;
function getClient() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

async function readDb() {
  const client = getClient();
  const data = await client.get(DB_KEY);
  if (!data) {
    const initial = { counter: 1, tickets: [] };
    await client.set(DB_KEY, initial);
    return initial;
  }
  return data; // @upstash/redis auto-parses stored JSON back into an object
}

async function writeDb(data) {
  const client = getClient();
  await client.set(DB_KEY, data);
}

module.exports = { readDb, writeDb };

/*
  NOTE ON CONCURRENCY:
  This does a plain get-then-set with no locking. For a single person using
  one bot, two writes landing at the exact same millisecond is essentially
  never going to happen in practice, so this is left simple on purpose. If
  gadfly ever grows into a multi-user tool, this would need real
  read-modify-write transactions (Upstash supports these) to avoid one
  write silently clobbering another.
*/
