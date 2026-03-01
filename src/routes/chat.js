const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { checkLimit, incrementUsage } = require('../middleware/planLimits');
const gemini = require('../services/gemini');
const calendar = require('../services/calendar');

const router = express.Router();

// POST /api/chat — enviar mensaje al agente
router.post('/', authenticate, checkLimit('messages'), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'El mensaje es requerido' });

    const today = new Date().toISOString().split('T')[0];

    // Save user message
    await pool.query(
      'INSERT INTO conversations (user_id, role, message, date) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'user', message, today]
    );

    // Get conversation history for today
    const { rows: history } = await pool.query(
      'SELECT role, message FROM conversations WHERE user_id = $1 AND date = $2 ORDER BY created_at ASC',
      [req.user.id, today]
    );

    // Get user profile
    const { rows: profiles } = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );

    // Get calendar events if connected (premium only)
    let calendarEvents = [];
    if (req.user.calendar_connected && req.user.plan === 'premium') {
      try {
        calendarEvents = await calendar.getTodayEvents(req.user.id);
      } catch (err) {
        console.error('Calendar fetch error:', err.message);
      }
    }

    // Call Gemini
    const { response, usage } = await gemini.chat(
      req.user.id,
      history,
      profiles[0] || null,
      calendarEvents
    );

    // Save assistant response
    await pool.query(
      'INSERT INTO conversations (user_id, role, message, date) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'assistant', response, today]
    );

    // Increment usage
    await incrementUsage(req.user.id, 'messages_count');

    res.json({ response, usage });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Error al procesar el mensaje' });
  }
});

// GET /api/chat/history — obtener historial del día
router.get('/history', authenticate, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      'SELECT role, message, created_at FROM conversations WHERE user_id = $1 AND date = $2 ORDER BY created_at ASC',
      [req.user.id, date]
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error('Get history error:', err.message);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
