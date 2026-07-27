// Run this ONCE on your own machine (not on Render) to get a refresh token:
//   npm install
//   npm run get-google-token
//
// It opens a browser tab for you to approve Calendar access, then prints the
// refresh token you paste into .env / Render's environment variables.

require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:53682/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env first.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // forces Google to actually hand back a refresh token
  scope: ['https://www.googleapis.com/auth/calendar.events'],
});

console.log('\nOpen this URL in your browser and approve access:\n');
console.log(authUrl);
console.log('\nWaiting for you to approve...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.end('ok');
    return;
  }
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');

  res.end('Done — you can close this tab and go back to your terminal.');
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\nSuccess. Add this to your .env / Render environment variables:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err.message);
  }
});

server.listen(53682, () => {
  console.log('(listening on http://localhost:53682 for the redirect)');
});
