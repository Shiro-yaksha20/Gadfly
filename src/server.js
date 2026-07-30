require('dotenv').config();
const express = require('express');
const {
  listOpenTickets,
  parseIncoming,
  resolveTicketRef,
  updateTicket,
  findTicketByPingMessageId,
} = require('./tickets');
const { parseTimeExpression } = require('./timeParse');
const { start, sendDM, addCheckReaction } = require('./discord');
const { startScheduler } = require('./scheduler');
const { isConfigured } = require('./calendar');
const { fileTicketWithCalendar, closeTicketWithCalendar, setReminderTimestamp } = require('./ticketActions');
const dashboard = require('./dashboard');

// --- Web server: health check + dashboard ---
const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('Ticket bot is alive. Dashboard: /dashboard'));
app.use(dashboard);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server on port ${PORT}`));

// Formats an ambiguous-match reply so you can pick a more specific keyword
// or fall back to the exact ID.
function ambiguousReply(candidates) {
  const lines = candidates.map((t) => `**${t.id}** — ${t.title}`);
  return `Found more than one match:\n${lines.join('\n')}\n\nBe more specific, or use the exact ID.`;
}

// --- Handle incoming text messages from you ---
async function handleMessage(text) {
  const parsed = parseIncoming(text);

  if (parsed.type === 'close') {
    const result = await resolveTicketRef(parsed.ref);
    if (result.match === 'none') {
      await sendDM(`Couldn't find an open ticket matching "${parsed.ref}". Send "list" to see what's open.`);
      return;
    }
    if (result.match === 'ambiguous') {
      await sendDM(ambiguousReply(result.candidates));
      return;
    }
    const t = await closeTicketWithCalendar(result.ticket.id);
    await sendDM(`Closed **${t.id}** — ${t.title}`);
    return;
  }

  if (parsed.type === 'remind') {
    const result = await resolveTicketRef(parsed.ref);
    if (result.match === 'none') {
      await sendDM(`Couldn't find an open ticket matching "${parsed.ref}".`);
      return;
    }
    if (result.match === 'ambiguous') {
      await sendDM(ambiguousReply(result.candidates));
      return;
    }
    const timestamp = parseTimeExpression(parsed.timeExpr);
    if (!timestamp) {
      await sendDM(`Couldn't understand "${parsed.timeExpr}". Try "remind ${result.ticket.id} at 6pm" or "in 30m".`);
      return;
    }
    const t = await setReminderTimestamp(result.ticket.id, timestamp);
    await sendDM(`**${t.id}** will ping you at ${new Date(timestamp).toLocaleString()}`);
    return;
  }

  if (parsed.type === 'list') {
    const open = await listOpenTickets();
    const reply = open.length === 0
      ? 'Nothing open. Nice.'
      : open.map((t) => `**${t.id}** — ${t.title}`).join('\n');
    await sendDM(reply);
    return;
  }

  // Default: file a new ticket. fileTicketWithCalendar does its own
  // read+write to create the ticket, then we send the Discord message and
  // fold the calendar event ID + message ID into ONE combined write below,
  // instead of two separate round trips.
  const { ticket, googleEventId } = await fileTicketWithCalendar(parsed.title, parsed.remindAt);
  const calendarNote = isConfigured() ? '' : ' (Calendar reminders not set up yet)';
  const timeNote = parsed.remindAt ? ` — pings at ${new Date(parsed.remindAt).toLocaleString()}` : '';
  const message = await sendDM(`Filed **${ticket.id}**: ${ticket.title}${timeNote}${calendarNote}\n(react ✅ here anytime to close it)`);

  const patch = {};
  if (googleEventId) patch.googleEventId = googleEventId;
  if (message) {
    await addCheckReaction(message);
    patch.pingMessageId = message.id;
  }
  if (Object.keys(patch).length > 0) {
    await updateTicket(ticket.id, patch); // single write covering both fields
  }
}

// --- Handle a ✅ reaction on any message the bot sent ---
async function handleReaction(messageId) {
  const ticket = await findTicketByPingMessageId(messageId);
  if (!ticket) return; // reaction on an old/unrelated message, ignore
  const t = await closeTicketWithCalendar(ticket.id);
  await sendDM(`Closed **${t.id}** — ${t.title} (via reaction)`);
}

start(handleMessage, handleReaction);
startScheduler();
