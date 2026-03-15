import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Estado en memoria
const rooms = new Map();

// Roles disponibles
const ROLES = ['piedra', 'papel', 'tijera'];

// Función para asignar rol aleatorio
function assignRandomRole() {
  return ROLES[Math.floor(Math.random() * ROLES.length)];
}

// Función para determinar ganador del encuentro
function resolveEncounter(role1, role2) {
  if (role1 === role2) return 'tie';
  
  const wins = {
    piedra: 'tijera',
    papel: 'piedra',
    tijera: 'papel'
  };
  
  return wins[role1] === role2 ? 'player1' : 'player2';
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
    
    const player = {
      id: socket.id,
      name: playerName,
      isHidden: false,
      isAlive: true,
      eliminated: false
    };
    
    room.players.push(player);
    socket.join(roomId);
    
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
    
    if (allHidden && room.state === 'waiting') {
      room.state = 'hidden';
      
      // Asignar roles aleatorios a los jugadores vivos
      room.players.forEach(p => {
        if (p.isAlive) {
          room.roles[p.id] = assignRandomRole();
        }
      });
      
      io.to(roomId).emit('all-hidden', { room });
      console.log(`Todos escondidos en sala ${roomId}, roles asignados`);
    }
    
    callback({ success: true, room });
    io.to(roomId).emit('room-updated', room);
  });

  // Reportar encuentro
  socket.on('report-encounter', (data, callback) => {
    const { roomId, opponentId } = data;
    const room = rooms.get(roomId);
    
    if (!room || room.state !== 'hidden') {
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
    
    const role1 = room.roles[socket.id];
    const role2 = room.roles[opponentId];
    
    const result = resolveEncounter(role1, role2);
    
    let winner = null;
    let loser = null;
    let eliminatedPlayerId = null;
    
    if (result === 'player1') {
      player2.eliminated = true;
      player2.isAlive = false;
      eliminatedPlayerId = opponentId;
      winner = player1;
      loser = player2;
    } else if (result === 'player2') {
      player1.eliminated = true;
      player1.isAlive = false;
      eliminatedPlayerId = socket.id;
      winner = player2;
      loser = player1;
    }
    
    // Verificar si queda un solo jugador
    const alivePlayers = room.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      room.state = 'finished';
    }
    
    const encounterResult = {
      player1: { id: player1.id, name: player1.name, role: role1 },
      player2: { id: player2.id, name: player2.name, role: role2 },
      result,
      winner,
      loser,
      eliminatedPlayerId,
      room
    };
    
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
