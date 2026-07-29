const { fileTicket, closeTicket, setGoogleEventId, setRemindAt } = require('./tickets');
const { createReminderEvent, rescheduleEvent, deleteEvent, isConfigured } = require('./calendar');

async function fileTicketWithCalendar(title, remindAt) {
  const ticket = await fileTicket(title, remindAt);
  if (isConfigured()) {
    try {
      const eventId = await createReminderEvent(ticket, remindAt);
      await setGoogleEventId(ticket.id, eventId);
      ticket.googleEventId = eventId;
    } catch (err) {
      console.error('Failed to create calendar event:', err.message);
    }
  }
  return ticket;
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
        await setGoogleEventId(ticket.id, eventId);
        ticket.googleEventId = eventId;
      }
    } catch (err) {
      console.error('Failed to update calendar event for reminder:', err.message);
    }
  }
  return ticket;
}

module.exports = { fileTicketWithCalendar, closeTicketWithCalendar, setReminderTimestamp };
