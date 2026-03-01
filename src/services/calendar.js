const { google } = require('googleapis');
const config = require('../config/env');
const pool = require('../db/pool');
const { encrypt, decrypt } = require('../utils/encryption');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

function getAuthUrl(userId) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    state: String(userId),
    prompt: 'consent',
  });
}

async function handleCallback(code, userId) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  await pool.query(
    `UPDATE users SET
      google_access_token_encrypted = $1,
      google_refresh_token_encrypted = $2,
      google_token_expiry = $3,
      calendar_connected = TRUE
     WHERE id = $4`,
    [
      encrypt(tokens.access_token),
      encrypt(tokens.refresh_token),
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      userId,
    ]
  );

  return tokens;
}

async function getTodayEvents(userId) {
  const { rows } = await pool.query(
    'SELECT google_access_token_encrypted, google_refresh_token_encrypted, google_token_expiry FROM users WHERE id = $1 AND calendar_connected = TRUE',
    [userId]
  );

  if (rows.length === 0) return [];

  const user = rows[0];
  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    access_token: decrypt(user.google_access_token_encrypted),
    refresh_token: decrypt(user.google_refresh_token_encrypted),
  });

  // Refresh token if expired
  const expiry = new Date(user.google_token_expiry);
  if (expiry < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await pool.query(
      `UPDATE users SET
        google_access_token_encrypted = $1,
        google_token_expiry = $2
       WHERE id = $3`,
      [
        encrypt(credentials.access_token),
        credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        userId,
      ]
    );
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || []).map(event => ({
    title: event.summary || 'Sin título',
    start: event.start.dateTime
      ? new Date(event.start.dateTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
      : 'Todo el día',
    end: event.end.dateTime
      ? new Date(event.end.dateTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '',
    allDay: !event.start.dateTime,
  }));
}

async function disconnect(userId) {
  await pool.query(
    `UPDATE users SET
      google_access_token_encrypted = NULL,
      google_refresh_token_encrypted = NULL,
      google_token_expiry = NULL,
      calendar_connected = FALSE
     WHERE id = $1`,
    [userId]
  );
}

module.exports = { getAuthUrl, handleCallback, getTodayEvents, disconnect };
