const jwt = require('jsonwebtoken');
const config = require('../config/env');
const pool = require('../db/pool');

async function authenticate(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const { rows } = await pool.query('SELECT id, name, email, plan, onboarding_completed, calendar_connected FROM users WHERE id = $1', [decoded.userId]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authenticate };
