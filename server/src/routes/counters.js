import express from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/counter-types
 * Obtiene todos los tipos de contadores (fijos + personalizados)
 */
router.get('/counter-types', authenticateToken, (req, res) => {
  try {
    const fixedCounters = [
      { id: 'cervezas', name: 'Cervezas', icon: '🍺', slug: 'cervezas', is_fixed: true },
      { id: 'banos_piscina', name: 'Baños Piscina', icon: '🚿', slug: 'banos_piscina', is_fixed: true },
      { id: 'agua_gas', name: 'Agua con Gas', icon: '💧', slug: 'agua_gas', is_fixed: true },
      { id: 'turbolatas', name: 'Turbolatas', icon: '🥫', slug: 'turbolatas', is_fixed: true }
    ];
    
    const customCounters = db.prepare('SELECT * FROM counter_types ORDER BY name').all();
    
    const allTypes = [...fixedCounters, ...customCounters.map(c => ({ ...c, is_fixed: false }))];
    
    res.json({ success: true, counterTypes: allTypes });
  } catch (error) {
    console.error('Error obteniendo tipos de contadores:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/counter-types
 * Crea un nuevo tipo de contador (solo admin)
 */
router.post('/counter-types', authenticateToken, (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede crear contadores' });
    }
    
    const { name, icon } = req.body;
    
    if (!name || !icon) {
      return res.status(400).json({ success: false, error: 'Nombre e icono son requeridos' });
    }
    
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    const existing = db.prepare('SELECT id FROM counter_types WHERE slug = ?').get(slug);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ya existe un contador con ese nombre' });
    }
    
    const result = db.prepare('INSERT INTO counter_types (name, icon, slug) VALUES (?, ?, ?)').run(name, icon, slug);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('counter-types-updated');
    }
    
    res.json({ success: true, id: result.lastInsertRowid, name, icon, slug });
  } catch (error) {
    console.error('Error creando tipo de contador:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * DELETE /api/counter-types/:id
 * Elimina un tipo de contador personalizado (solo admin)
 */
router.delete('/counter-types/:id', authenticateToken, (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede eliminar contadores' });
    }
    
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    const counter = db.prepare('SELECT * FROM counter_types WHERE id = ?').get(id);
    if (!counter) {
      return res.status(404).json({ success: false, error: 'Contador no encontrado' });
    }
    
    db.prepare('DELETE FROM counter_types WHERE id = ?').run(id);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('counter-types-updated');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando tipo de contador:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

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
    
    const fixedCounters = ['cervezas', 'banos_piscina', 'agua_gas', 'turbolatas'];
    const isFixed = fixedCounters.includes(counterType);
    
    let counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, today);
    
    if (!counter) {
      db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(userId, today);
      counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, today);
    }
    
    let newValue;
    let oldValue;
    
    if (isFixed) {
      oldValue = counter[counterType] || 0;
      newValue = action === 'increment' ? oldValue + 1 : Math.max(0, oldValue - 1);
      db.prepare(`UPDATE counters SET ${counterType} = ? WHERE user_id = ? AND date = ?`).run(newValue, userId, today);
    } else {
      const customCounters = JSON.parse(counter.custom_counters || '{}');
      oldValue = customCounters[counterType] || 0;
      newValue = action === 'increment' ? oldValue + 1 : Math.max(0, oldValue - 1);
      customCounters[counterType] = newValue;
      db.prepare(`UPDATE counters SET custom_counters = ? WHERE user_id = ? AND date = ?`).run(JSON.stringify(customCounters), userId, today);
    }
    
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
