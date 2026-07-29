# workload — my gadfly deployment notes

Personal reference for my own gadfly setup. This repo is private for a
reason — fill in your real values below and never push this repo's
visibility to public.

> ⚠️ This file is meant to hold your actual secrets for quick personal
> reference. That's a convenience trade-off, not a best practice — even a
> private repo's history is forever, and "private" can flip to "public" by
> accident (yours, a collaborator's, or GitHub's). If you'd rather not risk
> it, keep this file structure but store the real values in a password
> manager instead, and leave this doc with placeholders only.

---

## Live deployment

- **Render service URL**: `https://workload-dnot.onrender.com`
- **Dashboard**: `https://workload-dnot.onrender.com/dashboard`
- **Render service name**: `workload-dnot` *(update if renamed)*
- **Deployed from**: this repo (`workload`), `main` branch, auto-deploys on push
- **Public mirror (no secrets)**: `github.com/Shiro-yaksha20/Gadfly`

## Keep-alive

- **UptimeRobot monitor**: pings `https://workload-dnot.onrender.com` every
  5 min to stop Render's free tier from sleeping
- Account: *(your UptimeRobot login email, for your own reference)*

---

## Environment variables — actual values

Fill these in with your real values (also entered in Render → your service
→ Environment tab — that's the copy that actually matters for deployment;
this is just so you have them written down somewhere you control).

```
# Discord
DISCORD_BOT_TOKEN=
OWNER_DISCORD_USER_ID=
PING_INTERVAL_MINUTES=30

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary

# Dashboard login
DASHBOARD_USER=
DASHBOARD_PASSWORD=

# Web server
PORT=3000
```

## Discord bot reference

- **Bot application name**: *(from Discord Developer Portal)*
- **Private server name** (the one the bot lives in so it can DM you):
  *(your server name)*
- **My Discord user ID**: *(same as OWNER_DISCORD_USER_ID above)*

## Google Cloud reference

- **Cloud project name**: *(your project name)*
- **OAuth consent screen**: Testing mode, my account added as test user
- **Refresh token generated**: *(date — refresh tokens don't expire on
  their own for testing-mode apps, but note this in case Google ever
  requires re-consent)*

---

## Quick commands

```bash
# Pull latest and push to both remotes after a change
git add .
git commit -m "describe the change"
git push private main
git push public main
```

```bash
# Regenerate a Google refresh token if it ever gets revoked
npm run get-google-token
```

## If something breaks

- **Render stuck in a crash loop**: check the Logs tab (not build logs) —
  usually a missing/blank environment variable. Cross-check against the
  list above.
- **Dashboard says "DASHBOARD_PASSWORD is not set"**: add it in Render's
  Environment tab, not just locally.
- **Bot not responding on Discord**: confirm the bot shows "logged in as
  ..." in Render's logs. If not, `DISCORD_BOT_TOKEN` is likely wrong or
  regenerated on Discord's side without updating Render.
- **Phone not getting calendar pings**: re-run `npm run get-google-token`
  locally if the refresh token stopped working, then update it in Render.

---

*Full setup instructions, feature docs, and command syntax live in the
public repo's README — this file is just my own deployment cheat sheet, not
meant to be comprehensive on its own.*
