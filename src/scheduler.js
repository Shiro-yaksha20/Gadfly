const cron = require('node-cron');
const { listOpenTickets, markPinged, setPingMessageId } = require('./tickets');
const { sendDM, addCheckReaction } = require('./discord');
const { rescheduleEvent } = require('./calendar');

const INTERVAL_MIN = parseInt(process.env.PING_INTERVAL_MINUTES || '30', 10);

function ageLabel(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

async function runPingCheck() {
  const allOpen = await listOpenTickets();
  // Skip tickets snoozed into the future — their alarm just hasn't rung yet.
  const due = allOpen.filter((t) => !t.remindAt || t.remindAt <= Date.now());
  if (due.length === 0) return;

  // One message per ticket (instead of one bundled list) so each can carry
  // its own ✅ reaction for one-tap closing.
  for (const t of due) {
    const message = await sendDM(
      `Still open: **${t.id}** — ${t.title} (open ${ageLabel(t.createdAt)})\n(react ✅ to close, or reply "done" + a keyword from the title)`
    );
    if (message) {
      await addCheckReaction(message);
      await setPingMessageId(t.id, message.id);
    }
    await markPinged(t.id);
    if (t.googleEventId) {
      await rescheduleEvent(t.googleEventId); // re-fires the phone popup
    }
  }
}

function startScheduler() {
  const expr = `*/${INTERVAL_MIN} * * * *`;
  cron.schedule(expr, () => {
    runPingCheck().catch((err) => console.error('Ping check failed:', err));
  });
  console.log(`Scheduler running: pinging every ${INTERVAL_MIN} min if tickets are open.`);
}

module.exports = { startScheduler, runPingCheck };
