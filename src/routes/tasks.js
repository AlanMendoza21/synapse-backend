const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { checkLimit, incrementUsage } = require('../middleware/planLimits');

const router = express.Router();

// GET /api/tasks — obtener tareas del día
router.get('/', authenticate, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 AND date = $2 ORDER BY time_start ASC NULLS LAST, created_at ASC',
      [req.user.id, date]
    );
    res.json({ tasks: rows });
  } catch (err) {
    console.error('Get tasks error:', err.message);
    res.status(500).json({ error: 'Error al obtener tareas' });
  }
});

// POST /api/tasks — crear tarea
router.post('/', authenticate, checkLimit('tasks'), async (req, res) => {
  try {
    const { title, time_start, time_end, source } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es requerido' });

    const { rows } = await pool.query(
      'INSERT INTO tasks (user_id, title, time_start, time_end, source) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, title.trim(), time_start || null, time_end || null, source || 'user']
    );

    await incrementUsage(req.user.id, 'tasks_count');
    res.status(201).json({ task: rows[0] });
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: 'Error al crear tarea' });
  }
});

// PATCH /api/tasks/:id — actualizar tarea (completar, editar)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, title, time_start, time_end } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });

    const updates = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title.trim()); }
    if (time_start !== undefined) { updates.push(`time_start = $${idx++}`); values.push(time_start); }
    if (time_end !== undefined) { updates.push(`time_end = $${idx++}`); values.push(time_end); }

    if (updates.length === 0) return res.status(400).json({ error: 'No hay cambios' });

    values.push(id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      values
    );

    res.json({ task: rows[0] });
  } catch (err) {
    console.error('Update task error:', err.message);
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
});

// GET /api/tasks/progress — progreso del día
router.get('/progress', authenticate, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM tasks WHERE user_id = $1 AND date = $2 AND source = 'user'`,
      [req.user.id, date]
    );
    const { total, completed } = rows[0];
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    res.json({ total: parseInt(total), completed: parseInt(completed), percentage });
  } catch (err) {
    console.error('Get progress error:', err.message);
    res.status(500).json({ error: 'Error al obtener progreso' });
  }
});

module.exports = router;
