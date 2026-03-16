import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

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

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Estado en memoria
const rooms = new Map();

// Roles disponibles
const ROLES = ['piedra', 'papel', 'tijera', 'lagarto', 'spock'];

// Función para resolver encuentro (piedra-papel-tijera-lagarto-spock)
// Returns: 'tie', 'player1', o 'player2'
function resolveEncounter(role1, role2) {
  if (role1 === role2) return 'tie';
  
  // Victoria de role1 sobre role2
  const wins = {
    piedra: ['tijera', 'lagarto'],
    papel: ['piedra', 'spock'],
    tijera: ['papel', 'lagarto'],
    lagarto: ['spock', 'papel'],
    spock: ['tijera', 'piedra']
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
      status: 'pending'
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
