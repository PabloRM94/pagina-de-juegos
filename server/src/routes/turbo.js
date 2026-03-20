import express from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

let autoTriggerTimeout = null;

async function scheduleAutoTrigger(io) {
  if (autoTriggerTimeout) {
    clearTimeout(autoTriggerTimeout);
  }
  
  const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
  
  if (!turboState.active) return;
  
  if (turboState.current_target_user_id) {
    return;
  }
  
  const minMs = 30000;
  const maxMs = 120000;
  const randomMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  
  console.log(`[TURBO] Programando auto-disparo en ${randomMs/1000} segundos`);
  
  autoTriggerTimeout = setTimeout(() => {
    triggerAutoTurbo(io);
  }, randomMs);
}

async function triggerAutoTurbo(io) {
  const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
  
  if (!turboState.active || turboState.current_target_user_id) {
    return;
  }
  
  const users = await db.prepare('SELECT id, name FROM users WHERE is_admin = 0').all();
  
  if (users.length === 0) return;
  
  const randomUser = users[Math.floor(Math.random() * users.length)];
  
  await db.prepare(`UPDATE turbo_state SET current_target_user_id = ?, current_confirmations = 0, last_triggered = CURRENT_TIMESTAMP WHERE id = 1`).run(randomUser.id);
  
  await db.prepare('DELETE FROM turbo_confirmations').run();
  
  const newTurboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
  
  if (io) {
    io.emit('turbo-triggered', { 
      targetUserId: randomUser.id, 
      targetUserName: randomUser.name, 
      requiredConfirmations: newTurboState.required_confirmations, 
      currentConfirmations: 0 
    });
    
    scheduleAutoTrigger(io);
  }
  
  console.log(`[TURBO] Auto-disparo elegido: ${randomUser.name}`);
}

/**
 * GET /api/turbo/state
 * Obtiene el estado del turbo
 */
router.get('/turbo/state', authenticateToken, async (req, res) => {
  try {
    const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    res.json({ success: true, turboState });
  } catch (error) {
    console.error('Error obteniendo estado turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/turbo/toggle
 * Activa/desactiva el turbo
 */
router.post('/turbo/toggle', authenticateToken, async (req, res) => {
  try {
    const { active } = req.body;
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede activar el Turbo Lata' });
    }
    
    if (active) {
      await db.prepare('UPDATE turbo_state SET active = 1 WHERE id = 1').run();
      const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
      
      if (req.app.get('io')) {
        req.app.get('io').emit('turbo-state-changed', { active: true });
        
        if (!turboState.current_target_user_id) {
          scheduleAutoTrigger(req.app.get('io'));
        }
      }
      
      res.json({ success: true, turboState });
    } else {
      if (autoTriggerTimeout) {
        clearTimeout(autoTriggerTimeout);
        autoTriggerTimeout = null;
      }
      
      await db.prepare('UPDATE turbo_state SET active = 0 WHERE id = 1').run();
      await db.prepare('UPDATE turbo_state SET current_target_user_id = NULL, current_confirmations = 0 WHERE id = 1').run();
      await db.prepare('DELETE FROM turbo_confirmations').run();
      
      const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
      
      if (req.app.get('io')) {
        req.app.get('io').emit('turbo-state-changed', { active: false });
      }
      
      res.json({ success: true, turboState });
    }
  } catch (error) {
    console.error('Error toggle turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/turbo/trigger
 * Activa un nuevo turbo (elige random user)
 */
router.post('/turbo/trigger', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede ejecutar Turbo Lata' });
    }
    
    const users = await db.prepare('SELECT id, name FROM users WHERE is_admin = 0').all();
    
    if (users.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay usuarios disponibles' });
    }
    
    const randomUser = users[Math.floor(Math.random() * users.length)];
    
    await db.prepare(`UPDATE turbo_state SET current_target_user_id = ?, current_confirmations = 0, last_triggered = CURRENT_TIMESTAMP WHERE id = 1`).run(randomUser.id);
    
    await db.prepare('DELETE FROM turbo_confirmations').run();
    
    const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    
    if (req.app.get('io')) {
      req.app.get('io').emit('turbo-triggered', { 
        targetUserId: randomUser.id, 
        targetUserName: randomUser.name, 
        requiredConfirmations: turboState.required_confirmations, 
        currentConfirmations: 0 
      });
    }
    
    res.json({ success: true, turboState, targetUser: randomUser });
  } catch (error) {
    console.error('Error trigger turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/turbo/cancel
 * Cancela el turbo actual (resetea target y confirmaciones)
 */
router.post('/turbo/cancel', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede cancelar el Turbo Lata' });
    }
    
    const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    
    if (!turboState.active || !turboState.current_target_user_id) {
      return res.status(400).json({ success: false, error: 'No hay Turbo Lata activo para cancelar' });
    }
    
    // Resetear target y confirmaciones
    await db.prepare('UPDATE turbo_state SET current_target_user_id = NULL, current_confirmations = 0 WHERE id = 1').run();
    await db.prepare('DELETE FROM turbo_confirmations').run();
    
    const newTurboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    
    if (req.app.get('io')) {
      req.app.get('io').emit('turbo-cancelled');
    }
    
    res.json({ success: true, turboState: newTurboState });
  } catch (error) {
    console.error('Error cancelando turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/turbo/config
 * Configura las opciones del turbo (ej: required_confirmations)
 */
router.post('/turbo/config', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede configurar el Turbo Lata' });
    }
    
    const { required_confirmations } = req.body;
    
    if (required_confirmations !== undefined) {
      const value = parseInt(required_confirmations, 10);
      if (isNaN(value) || value < 1) {
        return res.status(400).json({ success: false, error: 'El número de confirmaciones debe ser al menos 1' });
      }
      await db.prepare('UPDATE turbo_state SET required_confirmations = ? WHERE id = 1').run(value);
    }
    
    const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    
    if (req.app.get('io')) {
      req.app.get('io').emit('turbo-state-changed', { active: turboState.active, required_confirmations: turboState.required_confirmations });
    }
    
    res.json({ success: true, turboState });
  } catch (error) {
    console.error('Error configurando turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/turbo/confirm
 * Confirma que el usuario objetivo bebió
 */
router.post('/turbo/confirm', authenticateToken, async (req, res) => {
  try {
    const turboState = await db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    
    if (!turboState.active || !turboState.current_target_user_id) {
      return res.status(400).json({ success: false, error: 'No hay Turbo Lata activo' });
    }
    
    const existing = await db.prepare(`SELECT id FROM turbo_confirmations WHERE target_user_id = ? AND confirmed_by_user_id = ?`).get(turboState.current_target_user_id, req.user.id);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ya has confirmado' });
    }
    
    await db.prepare(`INSERT INTO turbo_confirmations (target_user_id, confirmed_by_user_id) VALUES (?, ?)`).run(turboState.current_target_user_id, req.user.id);
    
    const confirmations = await db.prepare(`SELECT COUNT(*) as count FROM turbo_confirmations WHERE target_user_id = ?`).get(turboState.current_target_user_id);
    
    const newCount = confirmations.count;
    const required = turboState.required_confirmations;
    
    await db.prepare('UPDATE turbo_state SET current_confirmations = ? WHERE id = 1').run(newCount);
    
    if (newCount >= required) {
      const today = new Date().toISOString().split('T')[0];
      
      let counter = await db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(turboState.current_target_user_id, today);
      
      if (!counter) {
        await db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(turboState.current_target_user_id, today);
        counter = await db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(turboState.current_target_user_id, today);
      }
      
      const oldValue = counter.turbolatas;
      const newValue = oldValue + 1;
      
      await db.prepare('UPDATE counters SET turbolatas = ? WHERE user_id = ? AND date = ?').run(newValue, turboState.current_target_user_id, today);
      
      await db.prepare(`INSERT INTO counter_history (user_id, counter_type, old_value, new_value) VALUES (?, ?, ?, ?)`).run(turboState.current_target_user_id, 'turbolatas', oldValue, newValue);
      
      await db.prepare('UPDATE turbo_state SET current_target_user_id = NULL, current_confirmations = 0 WHERE id = 1').run();
      await db.prepare('DELETE FROM turbo_confirmations').run();
      
      if (req.app.get('io')) {
        req.app.get('io').emit('turbo-completed', { targetUserId: turboState.current_target_user_id, turbolatasCount: newValue });
        
        scheduleAutoTrigger(req.app.get('io'));
      }
    }
    
    if (req.app.get('io')) {
      req.app.get('io').emit('turbo-confirmation-updated', { currentConfirmations: newCount, requiredConfirmations: required });
    }
    
    res.json({ success: true, currentConfirmations: newCount, requiredConfirmations: required });
  } catch (error) {
    console.error('Error confirmando turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

export default router;
