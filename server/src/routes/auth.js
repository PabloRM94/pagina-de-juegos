import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../database/connection.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/register
 * Registra un nuevo usuario
 */
router.post('/register', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ success: false, error: 'Nombre y contraseña requeridos' });
    }
    
    const existingUser = await db.prepare('SELECT id FROM users WHERE name = ?').get(name);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El usuario ya existe' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const isAdmin = name === 'Domingoadmin' ? 1 : 0;
    
    const result = await db.prepare('INSERT INTO users (name, password, is_admin) VALUES (?, ?, ?)').run(name, hashedPassword, isAdmin);
    
    // Turso devuelve BigInt, convertir a número
    const userId = Number(result.lastInsertRowid);
    
    const today = new Date().toISOString().split('T')[0];
    await db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(userId, today);
    
    const token = generateToken({ id: userId, name, isAdmin });
    
    res.json({ success: true, user: { id: userId, name, isAdmin }, token });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/login
 * Inicia sesión
 */
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ success: false, error: 'Nombre y contraseña requeridos' });
    }
    
    const user = await db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    
    const token = generateToken({ id: user.id, name: user.name, isAdmin: user.is_admin });
    console.log('=== LOGIN ===');
    console.log('User:', user.name, 'isAdmin:', user.is_admin, 'type:', typeof user.is_admin);
    console.log('Token payload:', { id: user.id, name: user.name, isAdmin: user.is_admin });
    
    res.json({ success: true, user: { id: user.id, name: user.name, isAdmin: user.is_admin }, token });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * POST /api/reset-password-direct
 * Cambia la contraseña directamente (sin email, solo username + nueva contraseña)
 */
router.post('/reset-password-direct', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    if (!username || !newPassword) {
      return res.status(400).json({ success: false, error: 'Usuario y nueva contraseña requeridos' });
    }
    
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 4 caracteres' });
    }
    
    // Buscar usuario
    const user = await db.prepare('SELECT id FROM users WHERE name = ?').get(username);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Actualizar contraseña
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
    
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error en reset-password-direct:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

/**
 * PUT /api/users/:id/name
 * Actualiza el nombre de un usuario
 */
router.put('/users/:id/name', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const currentUserId = req.user.id;
    
    // Solo el propio usuario puede cambiar su nombre
    if (currentUserId !== parseInt(id, 10)) {
      return res.status(403).json({ success: false, error: 'No puedes cambiar el nombre de otro usuario' });
    }
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    
    if (name.length < 2 || name.length > 20) {
      return res.status(400).json({ success: false, error: 'El nombre debe tener entre 2 y 20 caracteres' });
    }
    
    // Verificar que el nombre no exista ya (excluyendo el usuario actual)
    const existingUser = await db.prepare('SELECT id FROM users WHERE name = ? AND id != ?').get(name, id);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El nombre ya está en uso' });
    }
    
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id);
    
    res.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error('Error actualizando nombre:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

export default router;
