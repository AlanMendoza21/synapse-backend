const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/subscription — obtener plan actual
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT plan, plan_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Get subscription error:', err.message);
    res.status(500).json({ error: 'Error al obtener la suscripción' });
  }
});

// POST /api/subscription/upgrade — simular upgrade a Premium (para hackathon)
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      'UPDATE users SET plan = $1, plan_expires_at = $2 WHERE id = $3',
      ['premium', expiresAt.toISOString(), req.user.id]
    );

    res.json({ message: 'Actualizado a Premium', plan: 'premium', expires_at: expiresAt });
  } catch (err) {
    console.error('Upgrade error:', err.message);
    res.status(500).json({ error: 'Error al actualizar el plan' });
  }
});

// POST /api/subscription/downgrade — volver a Free
router.post('/downgrade', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET plan = $1, plan_expires_at = NULL WHERE id = $2',
      ['free', req.user.id]
    );
    res.json({ message: 'Plan cambiado a Free', plan: 'free' });
  } catch (err) {
    console.error('Downgrade error:', err.message);
    res.status(500).json({ error: 'Error al cambiar el plan' });
  }
});

module.exports = router;
