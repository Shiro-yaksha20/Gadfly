const { fileTicket, closeTicket, updateTicket, setRemindAt } = require('./tickets');
const { createReminderEvent, rescheduleEvent, deleteEvent, isConfigured } = require('./calendar');

// Files a ticket and, if configured, creates its Calendar event — but does
// NOT write the calendar event ID to the DB yet. Callers that also need to
// attach a Discord message ID (see server.js) should combine both into one
// updateTicket() call afterward, instead of writing twice.
async function fileTicketWithCalendar(title, remindAt) {
  const ticket = await fileTicket(title, remindAt);
  let googleEventId = null;
  if (isConfigured()) {
    try {
      googleEventId = await createReminderEvent(ticket, remindAt);
    } catch (err) {
      console.error('Failed to create calendar event:', err.message);
    }
  }
  return { ticket, googleEventId };
}

async function closeTicketWithCalendar(id) {
  const t = await closeTicket(id);
  if (t && t.googleEventId) {
    await deleteEvent(t.googleEventId);
  }
  return t;
}

async function setReminderTimestamp(id, timestamp) {
  const ticket = await setRemindAt(id, timestamp);
  if (!ticket) return null;

  if (isConfigured()) {
    try {
      if (ticket.googleEventId) {
        await rescheduleEvent(ticket.googleEventId, timestamp);
      } else {
        const eventId = await createReminderEvent(ticket, timestamp);
        await updateTicket(ticket.id, { googleEventId: eventId });
        ticket.googleEventId = eventId;
      }
    } catch (err) {
      console.error('Failed to update calendar event for reminder:', err.message);
    }
  }
  return ticket;
}

module.exports = { fileTicketWithCalendar, closeTicketWithCalendar, setReminderTimestamp };
