const express = require('express');
const { authenticate } = require('../middleware/auth');
const { premiumOnly } = require('../middleware/planLimits');
const calendarService = require('../services/calendar');

const router = express.Router();

// GET /api/calendar/events — obtener eventos del día
router.get('/events', authenticate, premiumOnly, async (req, res) => {
  try {
    if (!req.user.calendar_connected) {
      return res.json({ events: [], connected: false });
    }
    const events = await calendarService.getTodayEvents(req.user.id);
    res.json({ events, connected: true });
  } catch (err) {
    console.error('Calendar events error:', err.message);
    res.status(500).json({ error: 'Error al obtener eventos del calendario' });
  }
});

// POST /api/calendar/disconnect
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    await calendarService.disconnect(req.user.id);
    res.json({ message: 'Calendario desconectado' });
  } catch (err) {
    console.error('Calendar disconnect error:', err.message);
    res.status(500).json({ error: 'Error al desconectar el calendario' });
  }
});

module.exports = router;
