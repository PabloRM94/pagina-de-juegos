import express from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/counters/:userId
 * Obtiene los contadores de un usuario específico
 */
router.get('/counters/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    let counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, targetDate);
    
    if (!counter) {
      db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(userId, targetDate);
      counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, targetDate);
    }
    
    res.json({ success: true, counter });
  } catch (error) {
    console.error('Error obteniendo contadores:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * GET /api/counters
 * Obtiene todos los contadores del día (sin admins)
 */
router.get('/counters', authenticateToken, (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const counters = db.prepare(`
      SELECT c.*, u.name as user_name 
      FROM counters c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.date = ? AND u.is_admin = 0
    `).all(targetDate);
    
    res.json({ success: true, counters });
  } catch (error) {
    console.error('Error obteniendo contadores:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/counters/:userId
 * Actualiza un contador
 */
router.post('/counters/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const { counterType, action } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    let counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, today);
    
    if (!counter) {
      db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(userId, today);
      counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, today);
    }
    
    const oldValue = counter[counterType];
    const newValue = action === 'increment' ? oldValue + 1 : Math.max(0, oldValue - 1);
    
    db.prepare(`UPDATE counters SET ${counterType} = ? WHERE user_id = ? AND date = ?`).run(newValue, userId, today);
    
    db.prepare(`INSERT INTO counter_history (user_id, counter_type, old_value, new_value) VALUES (?, ?, ?, ?)`).run(userId, counterType, oldValue, newValue);
    
    // Notificar a todos los clientes
    if (req.app.get('io')) {
      req.app.get('io').emit('counter-updated', { userId, counterType, newValue, date: today });
    }
    
    res.json({ success: true, newValue });
  } catch (error) {
    console.error('Error actualizando contador:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * GET /api/counters/history
 * Obtiene el historial de contadores
 */
router.get('/counters/history', authenticateToken, (req, res) => {
  try {
    const { startDate, endDate, counterType } = req.query;
    
    let query = `SELECT ch.*, u.name as user_name FROM counter_history ch JOIN users u ON ch.user_id = u.id WHERE 1=1`;
    const params = [];
    
    if (startDate) { query += ' AND DATE(ch.timestamp) >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND DATE(ch.timestamp) <= ?'; params.push(endDate); }
    if (counterType) { query += ' AND ch.counter_type = ?'; params.push(counterType); }
    
    query += ' ORDER BY ch.timestamp DESC';
    
    const history = db.prepare(query).all(...params);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * GET /api/users
 * Obtiene todos los usuarios (sin admins)
 */
router.get('/users', authenticateToken, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, is_admin FROM users WHERE is_admin = 0').all();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

export default router;
