const { readDb, writeDb } = require('./db');
const { parseTimeExpression } = require('./timeParse');

function nextId(db) {
  const id = `TCK-${String(db.counter).padStart(3, '0')}`;
  db.counter += 1;
  return id;
}

function fileTicket(title, remindAt = null) {
  const db = readDb();
  const ticket = {
    id: nextId(db),
    title: title.trim(),
    status: 'open',
    createdAt: Date.now(),
    doneAt: null,
    lastPingedAt: null,
    googleEventId: null,
    remindAt: remindAt || null,
    pingMessageId: null, // Discord message ID of its most recent ping/confirmation, for reaction-close
  };
  db.tickets.push(ticket);
  writeDb(db);
  return ticket;
}

function listOpenTickets() {
  const db = readDb();
  return db.tickets
    .filter((t) => t.status !== 'done')
    .sort((a, b) => a.createdAt - b.createdAt);
}

function listAllTickets() {
  return readDb().tickets;
}

function closeTicket(id) {
  const db = readDb();
  const t = db.tickets.find((t) => t.id.toLowerCase() === id.toLowerCase());
  if (!t) return null;
  t.status = 'done';
  t.doneAt = Date.now();
  writeDb(db);
  return t;
}

function setGoogleEventId(id, googleEventId) {
  const db = readDb();
  const t = db.tickets.find((x) => x.id === id);
  if (t) {
    t.googleEventId = googleEventId;
    writeDb(db);
  }
}

function setRemindAt(id, timestamp) {
  const db = readDb();
  const t = db.tickets.find((x) => x.id.toLowerCase() === id.toLowerCase());
  if (!t) return null;
  t.remindAt = timestamp;
  writeDb(db);
  return t;
}

function setPingMessageId(id, messageId) {
  const db = readDb();
  const t = db.tickets.find((x) => x.id === id);
  if (t) {
    t.pingMessageId = messageId;
    writeDb(db);
  }
}

function findTicketByPingMessageId(messageId) {
  const db = readDb();
  return db.tickets.find((t) => t.pingMessageId === messageId && t.status !== 'done') || null;
}

function markPinged(id) {
  const db = readDb();
  const t = db.tickets.find((x) => x.id === id);
  if (t) {
    t.lastPingedAt = Date.now();
    writeDb(db);
  }
}

// Resolves a typed reference to a ticket — either a real ID ("TCK-003") or a
// loose keyword match against open ticket titles ("epfo", "report").
// Returns one of:
//   { match: 'single', ticket }
//   { match: 'ambiguous', candidates: [...] }
//   { match: 'none' }
function resolveTicketRef(ref) {
  const db = readDb();
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

// Small command parser for incoming Discord text / dashboard input.
// "done report" / "close epfo"            -> closes the open ticket whose
//                                            title contains that keyword
//                                            (or an exact TCK-00X ID)
//                                            NOTE: "finish"/"finished" are NOT
//                                            close synonyms — they collide
//                                            with titles like "Finish report"
// "list" or "status"                      -> lists open tickets
// "remind report at 6pm" / "in 30m"       -> sets/edits that ticket's alarm
// "snooze report 30m"                     -> same as remind, relative shorthand
// "Finish report at 6pm" / "... in 2h"    -> files a ticket AND sets its alarm,
//                                            if the trailing bit parses as a time
// anything else                           -> files a new ticket, no alarm
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
  // Also allow a bare relative duration with no "in" prefix, e.g. "snooze payslip 30m"
  const bareDurationMatch = trimmed.match(
    /^(remind|snooze)\s+(.+?)\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours))$/i
  );
  if (bareDurationMatch) {
    return { type: 'remind', ref: bareDurationMatch[2].trim(), timeExpr: bareDurationMatch[3] };
  }

  if (lower === 'list' || lower === 'status' || lower === 'open') {
    return { type: 'list' };
  }

  // Try to peel off a trailing time expression, e.g. "Finish report at 6pm"
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
  setGoogleEventId,
  setRemindAt,
  setPingMessageId,
  findTicketByPingMessageId,
  resolveTicketRef,
  parseIncoming,
};
