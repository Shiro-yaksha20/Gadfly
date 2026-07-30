const { readDb, writeDb } = require('./db');
const { parseTimeExpression } = require('./timeParse');

function nextId(db) {
  const id = `TCK-${String(db.counter).padStart(3, '0')}`;
  db.counter += 1;
  return id;
}

async function fileTicket(title, remindAt = null) {
  const db = await readDb();
  const ticket = {
    id: nextId(db),
    title: title.trim(),
    status: 'open',
    createdAt: Date.now(),
    doneAt: null,
    lastPingedAt: null,
    googleEventId: null,
    remindAt: remindAt || null,
    pingMessageId: null,
  };
  db.tickets.push(ticket);
  await writeDb(db);
  return ticket;
}

async function listOpenTickets() {
  const db = await readDb();
  return db.tickets
    .filter((t) => t.status !== 'done')
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function listAllTickets() {
  const db = await readDb();
  return db.tickets;
}

async function closeTicket(id) {
  const db = await readDb();
  const t = db.tickets.find((t) => t.id.toLowerCase() === id.toLowerCase());
  if (!t) return null;
  t.status = 'done';
  t.doneAt = Date.now();
  await writeDb(db);
  return t;
}

// Patches one or more fields on a ticket in a single read+write round trip —
// use this instead of chaining several single-field setters, since each of
// those is its own full read/write of the whole ticket list.
async function updateTicket(id, patch) {
  const db = await readDb();
  const t = db.tickets.find((x) => x.id.toLowerCase() === id.toLowerCase());
  if (!t) return null;
  Object.assign(t, patch);
  await writeDb(db);
  return t;
}

async function setRemindAt(id, timestamp) {
  return updateTicket(id, { remindAt: timestamp });
}

async function findTicketByPingMessageId(messageId) {
  const db = await readDb();
  return db.tickets.find((t) => t.pingMessageId === messageId && t.status !== 'done') || null;
}

async function markPinged(id) {
  return updateTicket(id, { lastPingedAt: Date.now() });
}

// Resolves a typed reference to a ticket — either a real ID ("TCK-003") or a
// loose keyword match against open ticket titles ("epfo", "report").
async function resolveTicketRef(ref) {
  const db = await readDb();
  const trimmedRef = ref.trim();

  if (/^tck-\d+$/i.test(trimmedRef)) {
    const t = db.tickets.find((x) => x.id.toLowerCase() === trimmedRef.toLowerCase());
    return t ? { match: 'single', ticket: t } : { match: 'none' };
  }

  const keyword = trimmedRef.toLowerCase();
  const candidates = db.tickets.filter(
    (t) => t.status !== 'done' && t.title.toLowerCase().includes(keyword)
  );
  if (candidates.length === 0) return { match: 'none' };
  if (candidates.length === 1) return { match: 'single', ticket: candidates[0] };
  return { match: 'ambiguous', candidates };
}

// Small command parser for incoming Discord text / dashboard input. This one
// stays synchronous — it's pure string parsing, no database access.
function parseIncoming(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  const closeMatch = trimmed.match(/^(done|close|closed)\s+(.+)$/i);
  if (closeMatch) {
    return { type: 'close', ref: closeMatch[2].trim() };
  }

  const remindMatch = trimmed.match(/^(remind|snooze)\s+(.+?)\s+((?:at|in)\s+.+)$/i);
  if (remindMatch) {
    return { type: 'remind', ref: remindMatch[2].trim(), timeExpr: remindMatch[3] };
  }
  const bareDurationMatch = trimmed.match(
    /^(remind|snooze)\s+(.+?)\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours))$/i
  );
  if (bareDurationMatch) {
    return { type: 'remind', ref: bareDurationMatch[2].trim(), timeExpr: bareDurationMatch[3] };
  }

  if (lower === 'list' || lower === 'status' || lower === 'open') {
    return { type: 'list' };
  }

  const suffixMatch = trimmed.match(/^(.+?)\s+((?:at|in)\s+.+)$/i);
  if (suffixMatch) {
    const candidateTime = parseTimeExpression(suffixMatch[2]);
    if (candidateTime) {
      return { type: 'file', title: suffixMatch[1].trim(), remindAt: candidateTime };
    }
  }

  return { type: 'file', title: trimmed, remindAt: null };
}

module.exports = {
  fileTicket,
  listOpenTickets,
  listAllTickets,
  closeTicket,
  markPinged,
  updateTicket,
  setRemindAt,
  findTicketByPingMessageId,
  resolveTicketRef,
  parseIncoming,
};
