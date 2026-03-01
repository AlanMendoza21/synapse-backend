const pool = require('../db/pool');
const config = require('../config/env');

async function getOrCreateDailyUsage(userId) {
  const today = new Date().toISOString().split('T')[0];

  const { rows } = await pool.query(
    'SELECT * FROM daily_usage WHERE user_id = $1 AND date = $2',
    [userId, today]
  );

  if (rows.length > 0) return rows[0];

  const { rows: created } = await pool.query(
    'INSERT INTO daily_usage (user_id, date) VALUES ($1, $2) RETURNING *',
    [userId, today]
  );
  return created[0];
}

function checkLimit(limitType) {
  return async (req, res, next) => {
    if (req.user.plan === 'premium') return next();

    const usage = await getOrCreateDailyUsage(req.user.id);

    const limitMap = {
      messages: { field: 'messages_count', max: config.limits.freeDailyMessages, label: 'mensajes' },
      tasks: { field: 'tasks_count', max: config.limits.freeDailyTasks, label: 'tareas' },
      plans: { field: 'plans_generated', max: config.limits.freeDailyPlans, label: 'planes' },
      reorganizations: { field: 'reorganizations', max: config.limits.freeDailyReorganizations, label: 'reorganizaciones' },
    };

    const limit = limitMap[limitType];
    if (!limit) return next();

    if (usage[limit.field] >= limit.max) {
      return res.status(403).json({
        error: 'Límite alcanzado',
        message: `Has alcanzado el límite de ${limit.max} ${limit.label} por día en el plan Free.`,
        upgrade: true,
        current: usage[limit.field],
        max: limit.max,
      });
    }

    req.dailyUsage = usage;
    next();
  };
}

function premiumOnly(req, res, next) {
  if (req.user.plan !== 'premium') {
    return res.status(403).json({
      error: 'Función Premium',
      message: 'Esta función está disponible solo para usuarios Premium.',
      upgrade: true,
    });
  }
  next();
}

async function incrementUsage(userId, field) {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO daily_usage (user_id, date, ${field}) VALUES ($1, $2, 1)
     ON CONFLICT (user_id, date) DO UPDATE SET ${field} = daily_usage.${field} + 1`,
    [userId, today]
  );
}

module.exports = { checkLimit, premiumOnly, incrementUsage, getOrCreateDailyUsage };
