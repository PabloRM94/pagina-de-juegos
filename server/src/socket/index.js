import { createRoom, addPlayerToRoom, removePlayerFromRooms } from './room.js';
import { assignRandomRole, assignBalancedRole, resolveEncounter } from '../services/gameEngine.js';

/**
 * Configura los handlers de socket.io
 * @param {Server} io - Instancia de socket.io
 */
export function setupSocketHandlers(io) {
  // Estado en memoria
  const rooms = new Map();
  
  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    // ==================== CREAR SALA ====================
    socket.on('create-room', (data, callback) => {
      const room = createRoom(socket.id);
      
      rooms.set(room.id, room);
      socket.join(room.id);
      
      callback({ success: true, roomId: room.id, room });
      console.log(`Sala ${room.id} creada por ${socket.id}`);
    });
    
    // ==================== UNIRSE A SALA ====================
    socket.on('join-room', (data, callback) => {
      const { roomId, playerName, avatarStyle, avatarSeed } = data;
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
      
      // Verificar si el jugador ya está en la sala
      const existingPlayer = room.players.find(p => p.id === socket.id);
      
      if (existingPlayer) {
        // Actualizar nombre del jugador existente
        existingPlayer.name = playerName;
        callback({ success: true, room, player: existingPlayer });
        io.to(roomId).emit('room-updated', room);
        return;
      }
      
      // Agregar jugador
      const player = addPlayerToRoom(room, socket.id, playerName, avatarStyle, avatarSeed);
      
      socket.join(roomId);
      
      callback({ success: true, room, player });
      io.to(roomId).emit('room-updated', room);
      console.log(`${playerName} se unió a la sala ${roomId}`);
    });
    
    // ==================== SALIR DE SALA ====================
    socket.on('leave-room', (data, callback) => {
      const { roomId } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      // Buscar y eliminar jugador
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex === -1) {
        callback({ success: false, error: 'No estás en esta sala' });
        return;
      }
      
      const playerName = room.players[playerIndex].name;
      room.players.splice(playerIndex, 1);
      delete room.roles[socket.id];
      
      // Limpiar encuentros pendientes del jugador
      Object.keys(room.pendingEncounters).forEach(key => {
        const encounter = room.pendingEncounters[key];
        if (encounter.player1Id === socket.id || encounter.player2Id === socket.id) {
          delete room.pendingEncounters[key];
        }
      });
      
      socket.leave(roomId);
      
      // Si la sala queda vacía, eliminarla
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`Sala ${roomId} eliminada (vacía)`);
      } else {
        io.to(roomId).emit('room-updated', room);
      }
      
      callback({ success: true });
      console.log(`${playerName} salió de la sala ${roomId}`);
    });
    
    // ==================== MARCARSE COMO ESCONDIDO ====================
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
        
        // Cambiar a playing después de un breve delay
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
    
    // ==================== PROPONER ENCUENTRO ====================
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
      
      // Notificar SOLO al oponente (no a todos)
      io.to(opponentId).emit('encounter-proposed', {
        encounterId,
        proposerId: socket.id,
        proposerName: player1.name,
        proposerAvatarStyle: player1.avatarStyle,
        proposerAvatarSeed: player1.avatarSeed,
        targetId: opponentId,
        targetName: player2.name
      });
      
      callback({ success: true, encounterId });
    });
    
    // ==================== CONFIRMAR ENCUENTRO ====================
    socket.on('confirm-encounter', (data, callback) => {
      const { roomId, encounterId } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      if (room.state !== 'playing') {
        callback({ success: false, error: `El juego no está activo. Estado: ${room.state}` });
        return;
      }
      
      const encounter = room.pendingEncounters[encounterId];
      if (!encounter) {
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
      let isAlly = false;
      
      // Verificar si son aliados (mismo rol)
      if (role1 === role2) {
        isAlly = true;
        // Ambos siguen jugando, no hay winner/loser
      } else if (result === 'player1') {
        player2.eliminated = true;
        player2.isAlive = false;
        winner = player1;
        loser = player2;
      } else if (result === 'player2') {
        player1.eliminated = true;
        player1.isAlive = false;
        winner = player2;
        loser = player1;
      }
      
      // Verificar condición de victoria (equipo ganador)
      const alivePlayers = room.players.filter(p => p.isAlive);
      const uniqueRoles = new Set(
        alivePlayers
          .filter(p => room.roles[p.id])
          .map(p => room.roles[p.id])
      );
      
      let winningTeam = null;
      if (uniqueRoles.size === 1 && alivePlayers.length > 0) {
        room.state = 'finished';
        winningTeam = Array.from(uniqueRoles)[0];
        room.winningTeam = winningTeam;
      }
      
      const encounterResult = {
        encounterId,
        player1: { id: player1.id, name: player1.name, role: role1 },
        player2: { id: player2.id, name: player2.name, role: role2 },
        result: isAlly ? 'tie' : result,
        isAlly,
        winner: winner ? { id: winner.id, name: winner.name } : null,
        loser: loser ? { id: loser.id, name: loser.name } : null
      };
      
      // Eliminar encuentro pendiente
      delete room.pendingEncounters[encounterId];
      
      callback({ success: true, encounterResult });
      
      // Notificar SOLO a los participantes del encuentro
      io.to(player1.id).emit('encounter-resolved', encounterResult);
      io.to(player2.id).emit('encounter-resolved', encounterResult);
      
      // Si hay equipo ganador, emitir evento de fin de juego a todos
      if (winningTeam) {
        const winningPlayers = room.players.filter(p => room.roles[p.id] === winningTeam);
        io.to(roomId).emit('game-finished', {
          winningTeam,
          winningPlayers: winningPlayers.map(p => ({ id: p.id, name: p.name }))
        });
      }
      
      // Actualizar room para todos (para ver estados de eliminado)
      io.to(roomId).emit('room-updated', room);
    });
    
    // ==================== DENEGAR ENCUENTRO ====================
    socket.on('deny-encounter', (data, callback) => {
      const { roomId, encounterId } = data;
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
      
      // Obtener nombres de jugadores
      const player1 = room.players.find(p => p.id === encounter.player1Id);
      const player2 = room.players.find(p => p.id === encounter.player2Id);
      
      console.log('=== DENY ENCOUNTER ===');
      console.log('player1.id:', player1.id);
      console.log('player2.id:', player2.id);
      console.log('socket.id:', socket.id);
      
      // Eliminar encuentro pendiente
      delete room.pendingEncounters[encounterId];
      
      callback({ success: true });
      
      // Notificar a AMBOS jugadores (proposer y target)
      io.to(player1.id).emit('encounter-denied', {
        encounterId,
        deniedBy: player2.name,
        deniedTo: player1.name
      });
      io.to(player2.id).emit('encounter-denied', {
        encounterId,
        deniedBy: player2.name,
        deniedTo: player1.name
      });
      
      // Actualizar room para todos
      io.to(roomId).emit('room-updated', room);
    });
    
    // ==================== OBTENER INFO DE SALA ====================
    socket.on('get-room', (data, callback) => {
      const { roomId } = data;
      const room = rooms.get(roomId.toUpperCase());
      
      if (!room) {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      callback({ success: true, room });
    });
    
    // ==================== DESCONEXIÓN ====================
    socket.on('disconnect', () => {
      console.log('Usuario desconectado:', socket.id);
      
      const affectedRoom = removePlayerFromRooms(rooms, socket.id);
      
      if (affectedRoom) {
        io.to(affectedRoom.id).emit('room-updated', affectedRoom);
      }
    });
  });
}

export default { setupSocketHandlers };
