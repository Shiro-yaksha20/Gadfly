const express = require('express');
const { listAllTickets } = require('./tickets');
const { fileTicketWithCalendar, closeTicketWithCalendar, setReminderTimestamp } = require('./ticketActions');

const router = express.Router();

const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD; // required, see auth check below

// Simple HTTP Basic Auth, no extra dependency needed.
function requireAuth(req, res, next) {
  if (!DASHBOARD_PASSWORD) {
    return res.status(500).send(
      'DASHBOARD_PASSWORD is not set. Add it to your environment variables to enable the dashboard.'
    );
  }
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === DASHBOARD_USER && pass === DASHBOARD_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Ticket Dashboard"');
  return res.status(401).send('Authentication required.');
}

router.use('/dashboard', requireAuth);
router.use('/api/tickets', requireAuth);

// --- JSON API ---
router.get('/api/tickets', async (req, res) => {
  res.json(await listAllTickets());
});

router.post('/api/tickets', express.json(), async (req, res) => {
  const title = (req.body && req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const ticket = await fileTicketWithCalendar(title);
  res.json(ticket);
});

router.post('/api/tickets/:id/close', async (req, res) => {
  const t = await closeTicketWithCalendar(req.params.id);
  if (!t) return res.status(404).json({ error: 'ticket not found' });
  res.json(t);
});

router.post('/api/tickets/:id/remind', express.json(), async (req, res) => {
  const timestamp = Number(req.body && req.body.timestamp);
  if (!timestamp) return res.status(400).json({ error: 'timestamp (ms) is required' });
  const t = await setReminderTimestamp(req.params.id, timestamp);
  if (!t) return res.status(404).json({ error: 'ticket not found' });
  res.json(t);
});

// --- HTML page ---
router.get('/dashboard', (req, res) => {
  res.send(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Ticket Queue</title>
<style>
  :root{
    --bg:#14181C; --panel:#1B2126; --line:#2A333A; --text:#E8ECEF; --muted:#7A8690;
    --accent-open:#FF6B4A; --accent-warn:#F2C94C; --accent-done:#4ADE80; --accent-progress:#5AB7FF;
  }
  *{box-sizing:border-box;}
  body{background:var(--bg); color:var(--text); font-family:-apple-system,Inter,sans-serif; margin:0; padding:20px 16px 60px;}
  .wrap{max-width:640px; margin:0 auto;}
  h1{font-family:'IBM Plex Mono',monospace; font-size:16px; letter-spacing:0.02em; border-bottom:1px solid var(--line); padding-bottom:14px;}
  .inputbar{display:flex; gap:8px; margin:18px 0;}
  .inputbar input{flex:1; background:var(--panel); border:1px solid var(--line); color:var(--text); padding:11px 12px; border-radius:6px; font-size:14px;}
  .inputbar button{background:var(--accent-open); border:none; color:#1A1006; font-weight:700; padding:0 16px; border-radius:6px; cursor:pointer;}
  .label{font-family:monospace; font-size:11px; color:var(--muted); text-transform:uppercase; margin:18px 0 8px;}
  .ticket{display:flex; flex-wrap:wrap; align-items:center; background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:11px 13px; margin-bottom:7px; gap:10px;}
  .heat{width:5px; align-self:stretch; border-radius:3px; flex-shrink:0;}
  .body{flex:1; min-width:0;}
  .id{font-family:monospace; font-size:11px; color:var(--muted);}
  .title{font-size:14px; margin-top:2px;}
  .title.done{color:var(--muted); text-decoration:line-through;}
  .meta{font-family:monospace; font-size:11px; color:var(--muted); margin-top:3px;}
  button.close-btn{background:transparent; border:1px solid var(--line); color:var(--muted); font-family:monospace; font-size:11px; padding:6px 10px; border-radius:4px; cursor:pointer; flex-shrink:0;}
  button.close-btn:hover{border-color:var(--accent-done); color:var(--accent-done);}
  .remind-row{display:flex; gap:6px; width:100%; margin-top:6px; padding-top:8px; border-top:1px solid var(--line);}
  .remind-row input[type=datetime-local]{flex:1; background:var(--bg); border:1px solid var(--line); color:var(--text); font-family:monospace; font-size:11px; padding:6px 8px; border-radius:4px;}
  .remind-row button{background:transparent; border:1px solid var(--accent-progress); color:var(--accent-progress); font-family:monospace; font-size:11px; padding:6px 10px; border-radius:4px; cursor:pointer; flex-shrink:0;}
  .remind-row button:hover{background:var(--accent-progress); color:#08131C;}
  .empty{text-align:center; color:var(--muted); font-family:monospace; font-size:12px; padding:30px 0; border:1px dashed var(--line); border-radius:6px;}
</style>
</head>
<body>
<div class="wrap">
  <h1>TICKET QUEUE // dashboard</h1>
  <div class="inputbar">
    <input id="input" type="text" placeholder="File a new ticket..." autocomplete="off"/>
    <button onclick="fileTicket()">FILE</button>
  </div>
  <div class="label">Open</div>
  <div id="open-list"></div>
  <div class="label">Done</div>
  <div id="done-list"></div>
</div>
<script>
function ageLabel(ts){
  const mins = Math.floor((Date.now()-ts)/60000);
  if (mins<60) return mins+'m';
  const hrs = Math.floor(mins/60);
  if (hrs<24) return hrs+'h';
  return Math.floor(hrs/24)+'d';
}
function heatColor(ts){
  const hrs = (Date.now()-ts)/3600000;
  if (hrs<4) return 'var(--accent-progress)';
  if (hrs<24) return 'var(--accent-warn)';
  return 'var(--accent-open)';
}
function toLocalInputValue(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}
function renderTicket(t){
  const div = document.createElement('div');
  div.className = 'ticket';
  const heat = document.createElement('div');
  heat.className = 'heat';
  heat.style.background = t.status==='done' ? 'var(--accent-done)' : heatColor(t.createdAt);
  const body = document.createElement('div');
  body.className = 'body';
  const remindLine = (t.status!=='done' && t.remindAt)
    ? ' · rings '+new Date(t.remindAt).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})
    : '';
  body.innerHTML = '<div class="id">'+t.id+'</div>' +
    '<div class="title'+(t.status==='done'?' done':'')+'">'+escapeHtml(t.title)+'</div>' +
    '<div class="meta">'+(t.status==='done' ? 'closed '+ageLabel(t.doneAt) : 'open '+ageLabel(t.createdAt))+remindLine+'</div>';
  div.appendChild(heat);
  div.appendChild(body);
  if (t.status !== 'done'){
    const btn = document.createElement('button');
    btn.className = 'close-btn';
    btn.textContent = 'DONE';
    btn.onclick = () => closeTicket(t.id);
    div.appendChild(btn);

    const remindRow = document.createElement('div');
    remindRow.className = 'remind-row';
    const timeInput = document.createElement('input');
    timeInput.type = 'datetime-local';
    timeInput.value = toLocalInputValue(t.remindAt || (Date.now()+30*60000));
    const setBtn = document.createElement('button');
    setBtn.textContent = 'SET ALARM';
    setBtn.onclick = () => setReminder(t.id, timeInput.value);
    remindRow.appendChild(timeInput);
    remindRow.appendChild(setBtn);
    div.appendChild(remindRow);
  }
  return div;
}
function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

async function load(){
  const res = await fetch('/api/tickets');
  const tickets = await res.json();
  const open = tickets.filter(t=>t.status!=='done').sort((a,b)=>a.createdAt-b.createdAt);
  const done = tickets.filter(t=>t.status==='done').sort((a,b)=>b.doneAt-a.doneAt);
  const openList = document.getElementById('open-list');
  const doneList = document.getElementById('done-list');
  openList.innerHTML = open.length ? '' : '<div class="empty">No open tickets.</div>';
  open.forEach(t => openList.appendChild(renderTicket(t)));
  doneList.innerHTML = done.length ? '' : '<div class="empty">Nothing closed yet.</div>';
  done.slice(0,10).forEach(t => doneList.appendChild(renderTicket(t)));
}

async function fileTicket(){
  const input = document.getElementById('input');
  const title = input.value.trim();
  if (!title) return;
  input.value = '';
  await fetch('/api/tickets', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title})
  });
  load();
}

async function closeTicket(id){
  await fetch('/api/tickets/'+id+'/close', { method:'POST' });
  load();
}

async function setReminder(id, localDatetimeValue){
  if (!localDatetimeValue) return;
  const timestamp = new Date(localDatetimeValue).getTime();
  await fetch('/api/tickets/'+id+'/remind', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({timestamp})
  });
  load();
}

document.getElementById('input').addEventListener('keydown', e => { if (e.key==='Enter') fileTicket(); });
load();
// Poll every 30s while the tab is actually visible; pause entirely when it's
// backgrounded/minimized, so leaving this tab open doesn't quietly burn
// through Redis read commands for no reason.
let pollTimer = setInterval(load, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(pollTimer);
  } else {
    load(); // catch up immediately on refocus
    pollTimer = setInterval(load, 30000);
  }
});
</script>
</body>
</html>`;

module.exports = router;
