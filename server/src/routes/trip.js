import express from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /trip/config
 * Obtiene la configuración del viaje
 */
router.get('/trip/config', async (req, res) => {
  try {
    const config = await db.prepare('SELECT * FROM trip_config WHERE id = 1').get();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error obteniendo config:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /trip/config
 * Actualiza la configuración del viaje (solo admin)
 */
router.post('/trip/config', authenticateToken, async (req, res) => {
  try {
    console.log('=== TRIP CONFIG UPDATE ===');
    console.log('User from token:', req.user);
    console.log('Body:', req.body);
    
    // Verificación robusta de admin
    const isAdmin = Number(req.user.isAdmin) === 1 || req.user.isAdmin === true || req.user.isAdmin === '1';
    console.log('isAdmin check:', isAdmin);
    
    if (!isAdmin) {
      console.log('ERROR: No es admin');
      return res.status(403).json({ success: false, error: 'Solo el admin puede modificar la configuración' });
    }
    
    const { start_date, end_date, trip_started, trip_ended, admin_only, guest_mode, show_pwa_banner } = req.body;
    
    let updates = [];
    let params = [];
    
    if (start_date) { updates.push('start_date = ?'); params.push(start_date); console.log('Updating start_date:', start_date); }
    if (end_date) { updates.push('end_date = ?'); params.push(end_date); console.log('Updating end_date:', end_date); }
    if (trip_started !== undefined) { updates.push('trip_started = ?'); params.push(trip_started ? 1 : 0); console.log('Updating trip_started:', trip_started); }
    if (trip_ended !== undefined) { updates.push('trip_ended = ?'); params.push(trip_ended ? 1 : 0); console.log('Updating trip_ended:', trip_ended); }
    if (admin_only !== undefined) { updates.push('admin_only = ?'); params.push(admin_only ? 1 : 0); console.log('Updating admin_only:', admin_only); }
    if (guest_mode !== undefined) { updates.push('guest_mode = ?'); params.push(guest_mode ? 1 : 0); console.log('Updating guest_mode:', guest_mode); }
    if (show_pwa_banner !== undefined) { updates.push('show_pwa_banner = ?'); params.push(show_pwa_banner ? 1 : 0); console.log('Updating show_pwa_banner:', show_pwa_banner); }
    
    if (updates.length > 0) {
      params.push(1); // id = 1
      await db.prepare(`UPDATE trip_config SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      console.log('DB updated successfully');
    } else {
      console.log('No updates to make');
    }
    
    const config = await db.prepare('SELECT * FROM trip_config WHERE id = 1').get();
    console.log('Config after update:', config);
    
    // Notificar a todos los clientes (se hace desde el servidor principal)
    if (req.app.get('io')) {
      req.app.get('io').emit('trip-config-updated', config);
    }
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error actualizando config:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

export default router;
