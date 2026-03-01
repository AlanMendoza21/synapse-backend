const express = require('express');
const { authenticate } = require('../middleware/auth');
const calendarService = require('../services/calendar');
const config = require('../config/env');

const router = express.Router();

// GET /auth/google — redirect to Google OAuth
router.get('/google', authenticate, (req, res) => {
  if (req.user.plan !== 'premium') {
    return res.status(403).json({ error: 'Google Calendar es una función Premium' });
  }
  const authUrl = calendarService.getAuthUrl(req.user.id);
  res.redirect(authUrl);
});

// GET /auth/google/callback — Google redirects here after authorization
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.status(400).send('Faltan parámetros');
    }

    await calendarService.handleCallback(code, parseInt(userId));

    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Synapse - Calendario Conectado</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #0f172a; color: white; padding: 20px;
    }
    .card {
      text-align: center; max-width: 360px;
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #94a3b8; margin-bottom: 24px; }
    a {
      display: inline-block; background: #6366f1; color: white;
      padding: 12px 32px; border-radius: 12px; text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📅✅</div>
    <h1>¡Calendario conectado!</h1>
    <p>Tu Google Calendar está vinculado a Synapse. Ahora puedo ver tus eventos para organizar mejor tu día.</p>
    <a href="${config.appBaseUrl}">Volver a Synapse</a>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).send('Error al conectar el calendario. Inténtalo de nuevo.');
  }
});

module.exports = router;
