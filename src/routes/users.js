const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { getUserUsage } = require('../services/tokenTracker');
const { getOrCreateDailyUsage } = require('../middleware/planLimits');

const router = express.Router();

// GET /api/users/profile — obtener perfil de onboarding
router.get('/profile', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.user.id]);
    res.json({ profile: rows[0] || null });
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

// POST /api/users/profile — guardar/actualizar perfil de onboarding
router.post('/profile', authenticate, async (req, res) => {
  try {
    const { occupation, peak_energy, challenges, fixed_schedules } = req.body;

    await pool.query(
      `INSERT INTO user_profiles (user_id, occupation, peak_energy, challenges, fixed_schedules)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         occupation = $2, peak_energy = $3, challenges = $4, fixed_schedules = $5, updated_at = NOW()`,
      [req.user.id, occupation, peak_energy, challenges, fixed_schedules]
    );

    await pool.query('UPDATE users SET onboarding_completed = TRUE WHERE id = $1', [req.user.id]);

    res.json({ message: 'Perfil guardado' });
  } catch (err) {
    console.error('Save profile error:', err.message);
    res.status(500).json({ error: 'Error al guardar el perfil' });
  }
});

// GET /api/users/usage — obtener consumo de tokens
router.get('/usage', authenticate, async (req, res) => {
  try {
    const [today, week, month] = await Promise.all([
      getUserUsage(req.user.id, 'today'),
      getUserUsage(req.user.id, 'week'),
      getUserUsage(req.user.id, 'month'),
    ]);

    res.json({ today, week, month });
  } catch (err) {
    console.error('Get usage error:', err.message);
    res.status(500).json({ error: 'Error al obtener el consumo' });
  }
});

// GET /api/users/daily-limits — obtener límites usados hoy
router.get('/daily-limits', authenticate, async (req, res) => {
  try {
    const usage = await getOrCreateDailyUsage(req.user.id);
    res.json({ usage, plan: req.user.plan });
  } catch (err) {
    console.error('Get daily limits error:', err.message);
    res.status(500).json({ error: 'Error al obtener límites' });
  }
});

// PUT /api/users/name — actualizar nombre
router.put('/name', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre es requerido' });

    await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name.trim(), req.user.id]);
    res.json({ message: 'Nombre actualizado' });
  } catch (err) {
    console.error('Update name error:', err.message);
    res.status(500).json({ error: 'Error al actualizar nombre' });
  }
});

// DELETE /api/users/account — eliminar cuenta y todos los datos
router.delete('/account', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.clearCookie('token');
    res.json({ message: 'Cuenta eliminada' });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: 'Error al eliminar la cuenta' });
  }
});

module.exports = router;
