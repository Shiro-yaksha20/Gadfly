// Parses things like:
//   "18:30"        -> today at 18:30 (tomorrow if already passed)
//   "6:30pm", "6pm" -> same, 12-hour format
//   "30m", "in 30m", "2h", "in 2 hours" -> relative from now
// Returns a millisecond timestamp, or null if it doesn't recognize the input.
function parseTimeExpression(raw) {
  if (!raw) return null;
  const str = raw.trim().toLowerCase().replace(/^at\s+/, '');

  const relMatch = str.match(/^(?:in\s+)?(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)$/);
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    const ms = unit.startsWith('h') ? amount * 3600000 : amount * 60000;
    return Date.now() + ms;
  }

  const clockMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (clockMatch) {
    let hour = parseInt(clockMatch[1], 10);
    const minute = clockMatch[2] ? parseInt(clockMatch[2], 10) : 0;
    const meridiem = clockMatch[3];
    if (hour > 23 || minute > 59) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1); // already passed today -> tomorrow
    }
    return target.getTime();
  }

  return null;
}

module.exports = { parseTimeExpression };
