const { google } = require('googleapis');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

function getClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

function isConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

// Creates a short calendar event with a popup reminder set to fire right at
// the start — this is what actually makes your phone buzz, since Calendar
// (not Tasks) owns the real notification.
// atTime: optional ms timestamp for when it should ring. Defaults to ~1 min
// from now (i.e. "ping me right away").
async function createReminderEvent(ticket, atTime) {
  if (!isConfigured()) return null;
  const calendar = getClient();

  const start = new Date(atTime || Date.now() + 60 * 1000);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  const event = {
    summary: `[${ticket.id}] ${ticket.title}`,
    description: 'Filed via ticket bot. Reply "done ' + ticket.id + '" in Discord to close it.',
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 0 }],
    },
  };

  const res = await calendar.events.insert({ calendarId: CALENDAR_ID, requestBody: event });
  return res.data.id;
}

// Re-triggers a fresh notification by moving the event to a new start time.
// This is how we get repeated native pings for one ticket without creating a
// pile of duplicate calendar entries.
// atTime: optional ms timestamp. Defaults to ~1 min from now (immediate re-ping).
async function rescheduleEvent(eventId, atTime) {
  if (!isConfigured() || !eventId) return;
  const calendar = getClient();

  const start = new Date(atTime || Date.now() + 60 * 1000);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  try {
    await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: {
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 0 }],
        },
      },
    });
  } catch (err) {
    console.error(`Failed to reschedule calendar event ${eventId}:`, err.message);
  }
}

async function deleteEvent(eventId) {
  if (!isConfigured() || !eventId) return;
  const calendar = getClient();
  try {
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch (err) {
    // Already gone or never existed — not fatal
    console.error(`Failed to delete calendar event ${eventId}:`, err.message);
  }
}

module.exports = { createReminderEvent, rescheduleEvent, deleteEvent, isConfigured };
