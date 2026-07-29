# gadfly

*A self-hosted task nag — text it a to-do, it won't stop pinging Discord and your phone's calendar until you mark it done.*

> Fork this, follow the setup steps below, and it's entirely yours — every
> secret (bot token, Google credentials, dashboard password) lives in your
> own `.env`/host environment variables, never in this repo.

Send your bot a Discord message ("Finish UAN batch upload"), it files a
ticket. Every N minutes while it's still open, it:
1. DMs you on Discord with the list of open tickets, and
2. Fires a real native phone notification via a Google Calendar popup
   reminder — same alert as any calendar event, works on Samsung and any
   Android/iOS phone with the Google Calendar app.

You can also open a password-protected web dashboard at
`https://your-app.onrender.com/dashboard` to see and close tickets from a
browser — same underlying data as Discord and Calendar, just a visual view.

You can also set or edit a specific alarm time per ticket, instead of just
the fixed ping interval:
- Discord: `remind TCK-003 at 6pm`, `remind TCK-003 in 30m`, `snooze TCK-003 30m`
- Filing with a time built in: `Finish report at 6pm` (files the ticket AND
  sets its alarm in one go — only kicks in if the trailing bit actually
  parses as a time, so "Meeting at the office" still files normally)
- Dashboard: each open ticket has a date/time picker + "SET ALARM" button

Until that time arrives, the ticket stays quiet (no Discord nag, no calendar
popup) — then it starts pinging normally at your regular interval once the
alarm time passes.

You don't need to remember `TCK-003`-style IDs anymore, either:
- **Type a keyword**: `done epfo` or `close payslip` closes the one open
  ticket whose title contains that word. If more than one matches, the bot
  lists the candidates and asks you to be more specific (or use the exact ID).
- **Tap a reaction**: every ping and every "Filed" confirmation now carries
  a ✅ — react to it directly on your phone to close that ticket, no typing
  at all.
- Full IDs (`TCK-003`) still work everywhere, if you prefer them.

Reply `done TCK-003` in Discord (or click DONE on the dashboard) to close a
ticket — this deletes its calendar event too, so the phone pings stop.
`list` shows what's still open.

Note: there's no public API for Samsung's own Reminder app, so this uses
Google Calendar as the real notification channel instead — it looks and
feels identical on your phone either way.

## 1. Create the bot (Discord Developer Portal)

1. Go to https://discord.com/developers/applications → **New Application** → name it whatever.
2. Left sidebar → **Bot** → **Reset Token** → copy it. This is `DISCORD_BOT_TOKEN`.
3. Still on the Bot page, scroll to **Privileged Gateway Intents** and turn ON:
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT` is not needed, leave off.
4. Left sidebar → **OAuth2** → **URL Generator**:
   - Scopes: check `bot`
   - Bot Permissions: check `Send Messages`, `Read Message History`, `Add Reactions`

   > Already invited your bot before? Just re-run this step and use the new
   > invite link — Discord will update its permissions in your existing
   > server without needing to remove and re-add it.
   - Copy the generated URL, open it in your browser, and add the bot to a
     server. **Easiest: create a brand-new private Discord server just for
     yourself** and add the bot there — this is what lets the bot DM you
     (Discord bots can only DM users they share a server with).

## 2. Get your own Discord user ID

1. Discord app → Settings → **Advanced** → turn on **Developer Mode**.
2. Right-click your own name/profile anywhere → **Copy User ID**.
3. This is `OWNER_DISCORD_USER_ID`.

## 3. Set up Google Calendar (for the real phone ping)

1. Go to https://console.cloud.google.com → create a new project (any name).
2. **APIs & Services → Library** → search "Google Calendar API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: External. App name: anything. Add your own Google account
     under **Test users**. You don't need to publish or verify the app for
     personal use — "Testing" mode is fine indefinitely for your own account.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Desktop app**.
   - Copy the **Client ID** and **Client Secret** — these are
     `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Put those two values in your `.env`, then run, **on your own machine**:
   ```bash
   npm install
   npm run get-google-token
   ```
   This opens a browser tab — approve access with your Google account. The
   terminal will print a `GOOGLE_REFRESH_TOKEN=...` line. Copy that into
   `.env` too (and later into Render's environment variables).
6. Leave `GOOGLE_CALENDAR_ID=primary` unless you want reminders on a
   different calendar.

This OAuth setup is a one-time thing — the refresh token keeps working
indefinitely for your own account without repeating this flow.

## 4. Configure environment variables

Copy `.env.example` to `.env` and fill in:
- `DISCORD_BOT_TOKEN`
- `OWNER_DISCORD_USER_ID`
- `PING_INTERVAL_MINUTES` (default 30)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`
- `DASHBOARD_USER`, `DASHBOARD_PASSWORD` (protects the web dashboard — pick a real password)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (required — this is where tickets are actually stored, see the Database section below)

Never commit your real `.env` — only `.env.example` should go in the repo.
(Skip the Google values if you just want Discord for now — the bot detects
that Calendar isn't configured and keeps working without it. Upstash is not
optional — the bot has no local fallback storage anymore.)

## 5. Run it locally to test

```bash
npm install
npm start
```

You should see `Discord bot logged in as YourBot#1234` in the console. Then
message anything in the private server you created — the bot should reply
"Filed TCK-001: ...". Within about a minute you should also get a calendar
popup notification on your phone if Google Calendar is configured. Try
`list` and `done TCK-001` too.

## 6. Deploy so it runs 24/7

Push this folder to a **private GitHub repo**, then deploy on a free host:

**Render (recommended, simplest)**
1. https://render.com → New → Web Service → connect your private repo.
2. Build command: `npm install`. Start command: `npm start`.
3. Add the same environment variables from your `.env` in Render's dashboard
   under Environment.
4. Deploy. Render will keep it running and auto-restart if it crashes.

**Railway** works the same way and also supports private repos, if you'd
rather use that instead.

Once deployed, visit `https://your-app-name.onrender.com/dashboard` and log
in with `DASHBOARD_USER` / `DASHBOARD_PASSWORD` to view and close tickets
from a browser — handy from your phone too, bookmark it or add it to your
home screen for a one-tap view.

## Keeping Render's free tier awake (skip if you're paying for always-on)

Render's free web services spin down after 15 minutes of no incoming
requests, which kills the bot's Discord connection and stops scheduled
pings until something wakes it back up. Since gadfly needs to stay
always-on to actually nag you on schedule, fix this with a free external
uptime pinger:

1. Sign up free at https://uptimerobot.com (no card required).
2. Add New Monitor → Monitor Type: **HTTP(s)**.
3. URL: your root Render URL, e.g. `https://your-app-name.onrender.com`
   (no `/dashboard`, just the root).
4. Monitoring Interval: **5 minutes** (the only free option — comfortably
   under Render's 15-minute sleep threshold).
5. Save. UptimeRobot now pings your service every 5 min, 24/7, which resets
   Render's inactivity clock before it ever gets a chance to sleep.

This is a common workaround, not an official Render feature — if Render
ever changes free-tier sleep behavior, this may stop working, in which case
upgrading to Render's Starter plan (or moving to Railway) is the fallback.

## Database (Upstash Redis, free)

Tickets are stored in a free Upstash Redis database — not a local file — so
they survive Render redeploys and restarts without disappearing.

1. Go to https://upstash.com → sign up free (no card required).
2. Create a database → any name, pick a region close to your Render
   deployment region for lower latency (doesn't matter much at this scale).
3. On the database's page, find **REST API** section and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Add both to your `.env` locally and to Render's Environment tab.

Free tier covers 500K commands/month and 256MB of data — filing and
pinging tickets uses a handful of commands each, so this is far more
headroom than a personal ticket bot will ever use.

## Commands recap

- Any plain text → files a new ticket
- `Finish report at 6pm` / `Call client in 2h` → files a ticket with an alarm time built in
- `list` or `status` → shows open tickets
- `done epfo` / `close payslip` → closes the open ticket matching that keyword (or use the exact `TCK-002` ID)
- React ✅ on any ping or filed-confirmation message → closes that ticket, no typing
- `remind epfo at 6pm` / `remind epfo in 30m` / `snooze payslip 30m` → sets or edits that ticket's alarm time (keyword or exact ID both work)

## License

MIT — see [LICENSE](./LICENSE). Fork it, change it, ship it as your own.
