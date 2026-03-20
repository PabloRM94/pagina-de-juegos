import express from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/counter-types
 * Obtiene todos los tipos de contadores (fijos + personalizados)
 */
router.get('/counter-types', authenticateToken, async (req, res) => {
  try {
    const fixedCounters = [
      { id: 'cervezas', name: 'Cervezas', icon: '🍺', slug: 'cervezas', is_fixed: true },
      { id: 'banos_piscina', name: 'Baños Piscina', icon: '🚿', slug: 'banos_piscina', is_fixed: true },
      { id: 'agua_gas', name: 'Agua con Gas', icon: '💧', slug: 'agua_gas', is_fixed: true },
      { id: 'turbolatas', name: 'Turbolatas', icon: '🥫', slug: 'turbolatas', is_fixed: true }
    ];
    
    const customCounters = await db.prepare('SELECT * FROM counter_types ORDER BY name').all();
    
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
router.post('/counter-types', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede crear contadores' });
    }
    
    const { name, icon } = req.body;
    
    if (!name || !icon) {
      return res.status(400).json({ success: false, error: 'Nombre e icono son requeridos' });
    }
    
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    const existing = await db.prepare('SELECT id FROM counter_types WHERE slug = ?').get(slug);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ya existe un contador con ese nombre' });
    }
    
    const result = await db.prepare('INSERT INTO counter_types (name, icon, slug) VALUES (?, ?, ?)').run(name, icon, slug);
    
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
router.delete('/counter-types/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede eliminar contadores' });
    }
    
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    const counter = await db.prepare('SELECT * FROM counter_types WHERE id = ?').get(id);
    if (!counter) {
      return res.status(404).json({ success: false, error: 'Contador no encontrado' });
    }
    
    await db.prepare('DELETE FROM counter_types WHERE id = ?').run(id);
    
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
router.get('/counters/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    let counter = await db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, targetDate);
    
    if (!counter) {
      await db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(userId, targetDate);
      counter = await db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, targetDate);
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
router.get('/counters', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const counters = await db.prepare(`
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
router.post('/counters/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { counterType, action } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const fixedCounters = ['cervezas', 'banos_piscina', 'agua_gas', 'turbolatas'];
    const isFixed = fixedCounters.includes(counterType);
    
    let counter = await db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, today);
    
    if (!counter) {
      await db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(userId, today);
      counter = await db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(userId, today);
    }
    
    let newValue;
    let oldValue;
    
    if (isFixed) {
      oldValue = counter[counterType] || 0;
      newValue = action === 'increment' ? oldValue + 1 : Math.max(0, oldValue - 1);
      await db.prepare(`UPDATE counters SET ${counterType} = ? WHERE user_id = ? AND date = ?`).run(newValue, userId, today);
    } else {
      const customCounters = JSON.parse(counter.custom_counters || '{}');
      oldValue = customCounters[counterType] || 0;
      newValue = action === 'increment' ? oldValue + 1 : Math.max(0, oldValue - 1);
      customCounters[counterType] = newValue;
      await db.prepare(`UPDATE counters SET custom_counters = ? WHERE user_id = ? AND date = ?`).run(JSON.stringify(customCounters), userId, today);
    }
    
    await db.prepare(`INSERT INTO counter_history (user_id, counter_type, old_value, new_value) VALUES (?, ?, ?, ?)`).run(userId, counterType, oldValue, newValue);
    
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
router.get('/counters/history', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, counterType } = req.query;
    
    let query = `SELECT ch.*, u.name as user_name FROM counter_history ch JOIN users u ON ch.user_id = u.id WHERE 1=1`;
    const params = [];
    
    if (startDate) { query += ' AND DATE(ch.timestamp) >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND DATE(ch.timestamp) <= ?'; params.push(endDate); }
    if (counterType) { query += ' AND ch.counter_type = ?'; params.push(counterType); }
    
    query += ' ORDER BY ch.timestamp DESC';
    
    const history = await db.prepare(query).all(...params);
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
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await db.prepare('SELECT id, name, is_admin FROM users WHERE is_admin = 0').all();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

// ============ CHECKLIST COMPARTIDA ============

/**
 * GET /api/checklist
 * Obtiene todos los items de la checklist
 */
router.get('/checklist', authenticateToken, async (req, res) => {
  try {
    const items = await db.prepare(`
      SELECT cl.*, u.name as created_by_name
      FROM checklist_items cl
      JOIN users u ON cl.created_by = u.id
      ORDER BY cl.created_at DESC
    `).all();
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error obteniendo checklist:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/checklist
 * Crea un nuevo item en la checklist (opcionalmente en una sección)
 */
router.post('/checklist', authenticateToken, async (req, res) => {
  try {
    const { text, section } = req.body;
    const userId = req.user.id;
    
    console.log('=== CHECKLIST POST ===');
    console.log('text:', text);
    console.log('section:', section);
    console.log('section type:', typeof section);
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'El texto es requerido' });
    }
    
    if (text.length > 20) {
      return res.status(400).json({ success: false, error: 'Máximo 20 caracteres' });
    }
    
    const sectionName = (section || '').trim();
    console.log('sectionName a guardar:', sectionName);
    
    const result = await db.prepare(
      'INSERT INTO checklist_items (text, section, created_by) VALUES (?, ?, ?)'
    ).run(text.trim(), sectionName, userId);
    
    // Obtener el item creado con el nombre
    const newItem = await db.prepare(`
      SELECT cl.*, u.name as created_by_name
      FROM checklist_items cl
      JOIN users u ON cl.created_by = u.id
      WHERE cl.id = ?
    `).get(result.lastInsertRowid);
    
    // Notificar a todos los clientes
    if (req.app.get('io')) {
      req.app.get('io').emit('checklist-updated');
    }
    
    res.json({ success: true, item: newItem });
  } catch (error) {
    console.error('Error creando item de checklist:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * PUT /api/checklist/:id/toggle
 * Toggle completado de un item
 */
router.put('/checklist/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const item = await db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }
    
    const newCompleted = item.completed ? 0 : 1;
    const newCompletedBy = newCompleted ? userId : null;
    
    await db.prepare(
      'UPDATE checklist_items SET completed = ?, completed_by = ? WHERE id = ?'
    ).run(newCompleted, newCompletedBy, id);
    
    // Notificar a todos los clientes
    if (req.app.get('io')) {
      req.app.get('io').emit('checklist-updated');
    }
    
    res.json({ success: true, completed: newCompleted });
  } catch (error) {
    console.error('Error togglando item:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * DELETE /api/checklist/:id
 * Elimina un item de la checklist
 */
router.delete('/checklist/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }
    
    await db.prepare('DELETE FROM checklist_items WHERE id = ?').run(id);
    
    // Notificar a todos los clientes
    if (req.app.get('io')) {
      req.app.get('io').emit('checklist-updated');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando item:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

export default router;
