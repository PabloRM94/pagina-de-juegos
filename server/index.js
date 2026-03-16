import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './database.js';

const JWT_SECRET = 'trip-secret-key-2026';

const app = express();

// Middleware CORS más explícito
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Endpoint raíz para verificar que el servidor está activo
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Game server running' });
});

// ==================== AUTH API ====================

// Registro de usuario
app.post('/api/register', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ success: false, error: 'Nombre y contraseña requeridos' });
    }
    
    const existingUser = db.prepare('SELECT id FROM users WHERE name = ?').get(name);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El usuario ya existe' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const isAdmin = name === 'Domingoadmin' ? 1 : 0;
    
    const result = db.prepare('INSERT INTO users (name, password, is_admin) VALUES (?, ?, ?)').run(name, hashedPassword, isAdmin);
    
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(result.lastInsertRowid, today);
    
    const token = jwt.sign({ id: result.lastInsertRowid, name, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, user: { id: result.lastInsertRowid, name, isAdmin }, token });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

// Login de usuario
app.post('/api/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ success: false, error: 'Nombre y contraseña requeridos' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    
    const token = jwt.sign({ id: user.id, name: user.name, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, user: { id: user.id, name: user.name, isAdmin: user.is_admin }, token });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

// Middleware para verificar token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token requerido' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// ==================== TRIP CONFIG API ====================

app.get('/api/trip/config', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM trip_config WHERE id = 1').get();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error obteniendo config:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

// Actualizar configuración del viaje (solo admin)
app.post('/api/trip/config', authenticateToken, (req, res) => {
  try {
    console.log('=== TRIP CONFIG UPDATE ===');
    console.log('User:', req.user);
    console.log('Body:', req.body);
    
    if (!req.user.isAdmin) {
      console.log('ERROR: No es admin');
      return res.status(403).json({ success: false, error: 'Solo el admin puede modificar la configuración' });
    }
    
    const { start_date, end_date, trip_started, trip_ended, admin_only } = req.body;
    
    let updates = [];
    let params = [];
    
    if (start_date) { updates.push('start_date = ?'); params.push(start_date); console.log('Updating start_date:', start_date); }
    if (end_date) { updates.push('end_date = ?'); params.push(end_date); console.log('Updating end_date:', end_date); }
    if (trip_started !== undefined) { updates.push('trip_started = ?'); params.push(trip_started ? 1 : 0); console.log('Updating trip_started:', trip_started); }
    if (trip_ended !== undefined) { updates.push('trip_ended = ?'); params.push(trip_ended ? 1 : 0); console.log('Updating trip_ended:', trip_ended); }
    if (admin_only !== undefined) { updates.push('admin_only = ?'); params.push(admin_only ? 1 : 0); console.log('Updating admin_only:', admin_only); }
    
    if (updates.length > 0) {
      params.push(1); // id = 1
      db.prepare(`UPDATE trip_config SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      console.log('DB updated successfully');
    } else {
      console.log('No updates to make');
    }
    
    const config = db.prepare('SELECT * FROM trip_config WHERE id = 1').get();
    console.log('Config after update:', config);
    
    // Notificar a todos los clientes
    io.emit('trip-config-updated', config);
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error actualizando config:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

// ==================== COUNTERS API ====================

app.get('/api/counters/:userId', authenticateToken, (req, res) => {
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

app.get('/api/counters', authenticateToken, (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const counters = db.prepare(`SELECT c.*, u.name as user_name FROM counters c JOIN users u ON c.user_id = u.id WHERE c.date = ?`).all(targetDate);
    
    res.json({ success: true, counters });
  } catch (error) {
    console.error('Error obteniendo contadores:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

app.post('/api/counters/:userId', authenticateToken, (req, res) => {
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
    
    io.emit('counter-updated', { userId, counterType, newValue, date: today });
    
    res.json({ success: true, newValue });
  } catch (error) {
    console.error('Error actualizando contador:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

app.get('/api/counters/history', authenticateToken, (req, res) => {
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

// ==================== TURBO LATA API ====================

app.get('/api/turbo/state', authenticateToken, (req, res) => {
  try {
    const turboState = db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    res.json({ success: true, turboState });
  } catch (error) {
    console.error('Error obteniendo estado turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

app.post('/api/turbo/toggle', authenticateToken, (req, res) => {
  try {
    const { active } = req.body;
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede activar el Turbo Lata' });
    }
    
    db.prepare('UPDATE turbo_state SET active = ? WHERE id = 1').run(active ? 1 : 0);
    
    const turboState = db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    io.emit('turbo-state-changed', { active });
    
    res.json({ success: true, turboState });
  } catch (error) {
    console.error('Error toggle turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

app.post('/api/turbo/trigger', authenticateToken, (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Solo el admin puede ejecutar Turbo Lata' });
    }
    
    const users = db.prepare('SELECT id, name FROM users WHERE is_admin = 0').all();
    
    if (users.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay usuarios disponibles' });
    }
    
    const randomUser = users[Math.floor(Math.random() * users.length)];
    
    db.prepare(`UPDATE turbo_state SET current_target_user_id = ?, current_confirmations = 0, last_triggered = CURRENT_TIMESTAMP WHERE id = 1`).run(randomUser.id);
    
    db.prepare('DELETE FROM turbo_confirmations').run();
    
    const turboState = db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    
    io.emit('turbo-triggered', { targetUserId: randomUser.id, targetUserName: randomUser.name, requiredConfirmations: turboState.required_confirmations, currentConfirmations: 0 });
    
    res.json({ success: true, turboState, targetUser: randomUser });
  } catch (error) {
    console.error('Error trigger turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

app.post('/api/turbo/confirm', authenticateToken, (req, res) => {
  try {
    const turboState = db.prepare('SELECT * FROM turbo_state WHERE id = 1').get();
    
    if (!turboState.active || !turboState.current_target_user_id) {
      return res.status(400).json({ success: false, error: 'No hay Turbo Lata activo' });
    }
    
    const existing = db.prepare(`SELECT id FROM turbo_confirmations WHERE target_user_id = ? AND confirmed_by_user_id = ?`).get(turboState.current_target_user_id, req.user.id);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ya has confirmado' });
    }
    
    db.prepare(`INSERT INTO turbo_confirmations (target_user_id, confirmed_by_user_id) VALUES (?, ?)`).run(turboState.current_target_user_id, req.user.id);
    
    const confirmations = db.prepare(`SELECT COUNT(*) as count FROM turbo_confirmations WHERE target_user_id = ?`).get(turboState.current_target_user_id);
    
    const newCount = confirmations.count;
    const required = turboState.required_confirmations;
    
    db.prepare('UPDATE turbo_state SET current_confirmations = ? WHERE id = 1').run(newCount);
    
    if (newCount >= required) {
      const today = new Date().toISOString().split('T')[0];
      
      let counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(turboState.current_target_user_id, today);
      
      if (!counter) {
        db.prepare('INSERT INTO counters (user_id, date) VALUES (?, ?)').run(turboState.current_target_user_id, today);
        counter = db.prepare('SELECT * FROM counters WHERE user_id = ? AND date = ?').get(turboState.current_target_user_id, today);
      }
      
      const oldValue = counter.turbolatas;
      const newValue = oldValue + 1;
      
      db.prepare('UPDATE counters SET turbolatas = ? WHERE user_id = ? AND date = ?').run(newValue, turboState.current_target_user_id, today);
      
      db.prepare(`INSERT INTO counter_history (user_id, counter_type, old_value, new_value) VALUES (?, ?, ?, ?)`).run(turboState.current_target_user_id, 'turbolatas', oldValue, newValue);
      
      db.prepare('UPDATE turbo_state SET current_target_user_id = NULL, current_confirmations = 0 WHERE id = 1').run();
      db.prepare('DELETE FROM turbo_confirmations').run();
      
      io.emit('turbo-completed', { targetUserId: turboState.current_target_user_id, turbolatasCount: newValue });
    }
    
    io.emit('turbo-confirmation-updated', { currentConfirmations: newCount, requiredConfirmations: required });
    
    res.json({ success: true, currentConfirmations: newCount, requiredConfirmations: required });
  } catch (error) {
    console.error('Error confirmando turbo:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

app.get('/api/users', authenticateToken, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, is_admin FROM users').all();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["https://pagina-de-juegos-pywuqj9ng-pablorm94s-projects.vercel.app", "https://pagina-de-juegos.vercel.app", "*"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Estado en memoria
const rooms = new Map();

// Roles disponibles - SOLO piedra, papel, tijera
const ROLES = ['piedra', 'papel', 'tijera'];

// Función para resolver encuentro (piedra-papel-tijera)
// Returns: 'tie', 'player1', o 'player2'
function resolveEncounter(role1, role2) {
  if (role1 === role2) return 'tie';
  
  // Victoria de role1 sobre role2
  const wins = {
    piedra: ['tijera'],
    papel: ['piedra'],
    tijera: ['papel']
  };
  
  return wins[role1]?.includes(role2) ? 'player1' : 'player2';
}

// Función para asignar rol balanceado (evitando duplicados si es posible)
function assignBalancedRole(roles, existingRoles) {
  // Contar cuántos de cada rol ya están asignados
  const roleCount = {};
  ROLES.forEach(role => roleCount[role] = 0);
  
  // Contar roles existentes entre jugadores vivos
  Object.values(existingRoles).forEach(role => {
    if (role) roleCount[role]++;
  });
  
  // Encontrar el rol con menos jugadores
  const minCount = Math.min(...Object.values(roleCount));
  const availableRoles = ROLES.filter(role => roleCount[role] === minCount);
  
  // Si hay roles disponibles con menos jugadores, elegir uno de ellos
  if (availableRoles.length > 0) {
    return availableRoles[Math.floor(Math.random() * availableRoles.length)];
  }
  
  // Si todos tienen la misma cantidad, elegir aleatorio
  return assignRandomRole();
}

// Función para asignar rol aleatorio
function assignRandomRole() {
  return ROLES[Math.floor(Math.random() * ROLES.length)];
}

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Crear sala
  socket.on('create-room', (data, callback) => {
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const room = {
      id: roomId,
      host: socket.id,
      players: [{
        id: socket.id,
        name: 'Host',
        isHidden: false,
        isAlive: true,
        eliminated: false
      }],
      state: 'lobby', // lobby, ready, playing, finished
      roles: {},
      pendingEncounters: {}
    };
    
    rooms.set(roomId, room);
    socket.join(roomId);
    
    callback({ success: true, roomId, room });
    console.log(`Sala ${roomId} creada por ${socket.id}`);
  });

  // Unirse a sala
  socket.on('join-room', (data, callback) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    // Verificar si hay jugadores eliminados - no se permiten nuevas incorporaciones
    const hasEliminatedPlayers = room.players.some(p => p.eliminated);
    if (hasEliminatedPlayers) {
      callback({ success: false, error: 'No puedes unirte a una partida en progreso con eliminados' });
      return;
    }
    
    // Verificar si el jugador ya está en la sala (puede ser el host que se unió)
    const existingPlayer = room.players.find(p => p.id === socket.id);
    
    if (existingPlayer) {
      // Actualizar nombre del jugador existente
      existingPlayer.name = playerName;
      callback({ success: true, room, player: existingPlayer });
      io.to(roomId).emit('room-updated', room);
      return;
    }
    
    // Verificar si el juego ya comenzó (todos escondidos)
    const gameStarted = (room.state === 'ready' || room.state === 'playing');
    
    const player = {
      id: socket.id,
      name: playerName,
      isHidden: gameStarted, // Si el juego ya empezó, se marca como escondido automáticamente
      isAlive: true,
      eliminated: false
    };
    
    room.players.push(player);
    socket.join(roomId);
    
    // Si el juego ya empezó, asignar rol al jugador nuevo
    if (gameStarted) {
      // Filtrar solo los roles de jugadores vivos
      const existingRoles = {};
      room.players.forEach(p => {
        if (p.id !== socket.id && p.isAlive && room.roles[p.id]) {
          existingRoles[p.id] = room.roles[p.id];
        }
      });
      
      // Asignar rol balanceado (evitando duplicados si es posible)
      room.roles[socket.id] = assignBalancedRole(room.roles, existingRoles);
      
      console.log(`Jugador ${playerName} se unió tarde a sala ${roomId} - rol asignado: ${room.roles[socket.id]}`);
    }
    
    callback({ success: true, room, player });
    io.to(roomId).emit('room-updated', room);
    console.log(`${playerName} se unió a la sala ${roomId}`);
  });

  // Marcar estado escondido
  socket.on('set-hidden', (data, callback) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      callback({ success: false, error: 'Jugador no encontrado' });
      return;
    }
    
    player.isHidden = true;
    
    // Verificar si todos están escondidos
    const allHidden = room.players.every(p => p.isHidden);
    
    if (allHidden && room.state === 'lobby') {
      room.state = 'ready';
      
      // Asignar roles aleatorios a los jugadores vivos
      room.players.forEach(p => {
        if (p.isAlive) {
          room.roles[p.id] = assignRandomRole();
        }
      });
      
      // Cambiar a playing después de un breve delay para que vean sus roles
      setTimeout(() => {
        room.state = 'playing';
        io.to(roomId).emit('game-started', { room });
        io.to(roomId).emit('room-updated', room);
      }, 3000);
      
      io.to(roomId).emit('all-hidden', { room });
      console.log(`Todos escondidos en sala ${roomId}, roles asignados`);
    }
    
    callback({ success: true, room });
    io.to(roomId).emit('room-updated', room);
  });

  // Iniciar propuesta de encuentro (primer jugador marca)
  socket.on('propose-encounter', (data, callback) => {
    const { roomId, opponentId } = data;
    const room = rooms.get(roomId);
    
    if (!room || room.state !== 'playing') {
      callback({ success: false, error: 'El juego no está activo' });
      return;
    }
    
    const player1 = room.players.find(p => p.id === socket.id);
    const player2 = room.players.find(p => p.id === opponentId);
    
    if (!player1 || !player2) {
      callback({ success: false, error: 'Jugador no encontrado' });
      return;
    }
    
    if (!player1.isAlive || !player2.isAlive) {
      callback({ success: false, error: 'Uno de los jugadores ya está eliminado' });
      return;
    }
    
    // Crear ID de encuentro
    const encounterId = `${socket.id}-${opponentId}`;
    console.log('Propuesta de encuentro:', { encounterId, proposer: socket.id, opponent: opponentId });
    
    // Verificar si ya existe un encuentro pendiente
    const reverseEncounterId = `${opponentId}-${socket.id}`;
    if (room.pendingEncounters[encounterId] || room.pendingEncounters[reverseEncounterId]) {
      callback({ success: false, error: 'Ya existe un encuentro pendiente con este jugador' });
      return;
    }
    
    // Crear encuentro pendiente
    room.pendingEncounters[encounterId] = {
      player1Id: socket.id,
      player2Id: opponentId,
      confirmedBy: [socket.id],
      status: 'pending',
      denied: false
    };
    
    // Notificar al oponente
    io.to(roomId).emit('encounter-proposed', {
      encounterId,
      proposerId: socket.id,
      proposerName: player1.name,
      targetId: opponentId,
      targetName: player2.name
    });
    
    console.log('Pending encounters guardados:', Object.keys(room.pendingEncounters));
    
    callback({ success: true, encounterId });
  });

  // Confirmar encuentro (segundo jugador)
  socket.on('confirm-encounter', (data, callback) => {
    const { roomId, encounterId } = data;
    console.log('Confirmando encuentro:', { roomId, encounterId, socketId: socket.id });
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    if (room.state !== 'playing') {
      callback({ success: false, error: 'El juego no está activo. Estado: ' + room.state });
      return;
    }
    
    console.log('Pending encounters:', Object.keys(room.pendingEncounters));
    const encounter = room.pendingEncounters[encounterId];
    if (!encounter) {
      console.log('Encuentro no encontrado para ID:', encounterId);
      callback({ success: false, error: 'Encuentro no encontrado' });
      return;
    }
    
    if (encounter.confirmedBy.includes(socket.id)) {
      callback({ success: false, error: 'Ya has confirmado este encuentro' });
      return;
    }
    
    // Agregar confirmación
    encounter.confirmedBy.push(socket.id);
    encounter.status = 'confirmed';
    
    // Resolver encuentro
    const player1 = room.players.find(p => p.id === encounter.player1Id);
    const player2 = room.players.find(p => p.id === encounter.player2Id);
    
    const role1 = room.roles[player1.id];
    const role2 = room.roles[player2.id];
    
    const result = resolveEncounter(role1, role2);
    
    let winner = null;
    let loser = null;
    let eliminatedPlayerId = null;
    
    if (result === 'player1') {
      player2.eliminated = true;
      player2.isAlive = false;
      eliminatedPlayerId = player2.id;
      winner = player1;
      loser = player2;
    } else if (result === 'player2') {
      player1.eliminated = true;
      player1.isAlive = false;
      eliminatedPlayerId = player1.id;
      winner = player2;
      loser = player1;
    }
    
    // Verificar si queda un solo jugador
    const alivePlayers = room.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      room.state = 'finished';
    }
    
    const encounterResult = {
      encounterId,
      player1: { id: player1.id, name: player1.name, role: role1 },
      player2: { id: player2.id, name: player2.name, role: role2 },
      result,
      winner: winner ? { id: winner.id, name: winner.name } : null,
      loser: loser ? { id: loser.id, name: loser.name } : null,
      eliminatedPlayerId,
      room
    };
    
    // Eliminar encuentro pendiente
    delete room.pendingEncounters[encounterId];
    
    callback({ success: true, encounterResult });
    io.to(roomId).emit('encounter-resolved', encounterResult);
    io.to(roomId).emit('room-updated', room);
  });

  // Denegar encuentro (el objetivo dice que no se encontró)
  socket.on('deny-encounter', (data, callback) => {
    const { roomId, encounterId } = data;
    console.log('Denegando encuentro:', { roomId, encounterId, socketId: socket.id });
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    const encounter = room.pendingEncounters[encounterId];
    if (!encounter) {
      callback({ success: false, error: 'Encuentro no encontrado' });
      return;
    }
    
    // Solo el objetivo (player2) puede denegar
    if (encounter.player2Id !== socket.id) {
      callback({ success: false, error: 'Solo el objetivo puede denegar el encuentro' });
      return;
    }
    
    // Marcar como denegado
    encounter.denied = true;
    
    // Obtener nombres de jugadores para la notificación
    const player1 = room.players.find(p => p.id === encounter.player1Id);
    const player2 = room.players.find(p => p.id === encounter.player2Id);
    
    // Eliminar encuentro pendiente
    delete room.pendingEncounters[encounterId];
    
    callback({ success: true });
    
    // Notificar a todos que el encuentro fue denegado
    io.to(roomId).emit('encounter-denied', {
      encounterId,
      deniedBy: player2.name,
      deniedTo: player1.name
    });
    
    io.to(roomId).emit('room-updated', room);
    console.log(`Encuentro denegado: ${player1.name} vs ${player2.name}`);
  });

  // Obtener info de sala
  socket.on('get-room', (data, callback) => {
    const { roomId } = data;
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    callback({ success: true, room });
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    
    // Buscar y eliminar al jugador de todas las salas
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        delete room.roles[socket.id];
        
        // Limpiar encuentros pendientes relacionados con este jugador
        Object.keys(room.pendingEncounters).forEach(key => {
          const encounter = room.pendingEncounters[key];
          if (encounter.player1Id === socket.id || encounter.player2Id === socket.id) {
            delete room.pendingEncounters[key];
            io.to(roomId).emit('encounter-cancelled', { encounterId: key });
          }
        });
        
        // Si la sala queda vacía, eliminarla
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`Sala ${roomId} eliminada (vacía)`);
        } else {
          io.to(roomId).emit('room-updated', room);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
