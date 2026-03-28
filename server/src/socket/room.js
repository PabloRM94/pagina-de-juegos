import { v4 as uuidv4 } from 'uuid';
import { assignRandomRole, assignBalancedRole } from '../services/gameEngine.js';

/**
 * Genera un código de sala de 2 dígitos (00-99)
 * @param {Map} rooms - Map de salas existentes para evitar colisiones
 * @returns {string} - Código de sala
 */
export function generateRoomCode(rooms) {
  let attempts = 0;
  let code;
  
  do {
    // Generar número aleatorio de 00 a 99
    const num = Math.floor(Math.random() * 100);
    code = num.toString().padStart(2, '0');
    attempts++;
    
    // Safety: si ya existen 100 salas, force break
    if (attempts >= 100) break;
  } while (rooms.has(code)); // Si ya existe, intentar otro
  
  return code;
}

/**
 * Crea una nueva sala
 * @param {string} socketId - ID del socket del host
 * @param {string} sessionId - ID de sesión del cliente (para reconexiones)
 * @param {Map} rooms - Map de salas existentes (para generar código único)
 * @returns {object} - Sala creada
 */
export function createRoom(socketId, sessionId, rooms = new Map()) {
  const roomId = generateRoomCode(rooms);
  const room = {
    id: roomId,
    host: socketId,
    hostSessionId: sessionId, // Guardar sessionId del host para reconexiones
    players: [{
      id: socketId,
      sessionId: sessionId,
      name: 'Host',
      isHidden: false,
      isAlive: true,
      eliminated: false,
      disconnectedAt: null
    }],
    state: 'lobby', // lobby, ready, playing, finished
    roles: {},
    pendingEncounters: {},
    createdAt: Date.now()
  };
  
  return room;
}

/**
 * Agrega un jugador a una sala
 * @param {object} room - Sala
 * @param {string} socketId - ID del socket
 * @param {string} sessionId - ID de sesión del cliente (para reconexiones)
 * @param {string} playerName - Nombre del jugador
 * @param {string} avatarStyle - Estilo de avatar
 * @param {string} avatarSeed - Seed de avatar
 * @returns {object|null} - Jugador agregado o null si no se pudo
 */
export function addPlayerToRoom(room, socketId, sessionId, playerName, avatarStyle, avatarSeed) {
  // Verificar si el juego ya comenzó (todos escondidos)
  const gameStarted = (room.state === 'ready' || room.state === 'playing');
  
  const player = {
    id: socketId,
    sessionId: sessionId,
    name: playerName,
    avatarStyle,
    avatarSeed,
    isHidden: gameStarted, // Si el juego ya empezó, se marca como escondido automáticamente
    isAlive: true,
    eliminated: false,
    disconnectedAt: null
  };
  
  // Si el juego ya empezó, asignar rol al jugador nuevo
  if (gameStarted) {
    // Filtrar solo los roles de jugadores vivos
    const existingRoles = {};
    room.players.forEach(p => {
      if (p.id !== socketId && p.isAlive && room.roles[p.id]) {
        existingRoles[p.id] = room.roles[p.id];
      }
    });
    
    // Asignar rol balanceado
    room.roles[socketId] = assignBalancedRole(existingRoles);
  }
  
  room.players.push(player);
  
  return player;
}

/**
 * Busca un jugador en una sala por socketId O sessionId
 * @param {object} room - Sala
 * @param {string} socketId - ID del socket
 * @param {string} sessionId - ID de sesión
 * @returns {object|null} - Jugador encontrado o null
 */
export function findPlayerInRoom(room, socketId, sessionId) {
  return room.players.find(p => 
    p.id === socketId || (sessionId && p.sessionId === sessionId)
  );
}

/**
 * Marca un jugador como desconectado (en lugar de eliminarlo)
 * @param {Map} rooms - Map de salas
 * @param {string} socketId - ID del socket
 * @param {string} sessionId - ID de sesión (opcional, para búsquedas)
 * @returns {object|null} - Sala donde se marcó al jugador, o null
 */
export function markPlayerDisconnected(rooms, socketId, sessionId = null) {
  let affectedRoom = null;
  
  rooms.forEach((room, roomId) => {
    const player = findPlayerInRoom(room, socketId, sessionId);
    if (player) {
      player.disconnectedAt = Date.now();
      affectedRoom = room;
      console.log(`[markPlayerDisconnected] Jugador ${player.name} marcado como desconectado en sala ${roomId}`);
    }
  });
  
  return affectedRoom;
}

/**
 * Busca y elimina un jugador de una sala (eliminación definitiva)
 * @param {Map} rooms - Map de salas
 * @param {string} socketId - ID del socket
 * @returns {object|null} - Sala de la que se eliminó o null
 */
export function removePlayerFromRooms(rooms, socketId) {
  let affectedRoom = null;
  
  rooms.forEach((room, roomId) => {
    const playerIndex = room.players.findIndex(p => p.id === socketId);
    if (playerIndex !== -1) {
      const playerName = room.players[playerIndex].name;
      room.players.splice(playerIndex, 1);
      delete room.roles[socketId];
      
      // Limpiar encuentros pendientes relacionados con este jugador
      Object.keys(room.pendingEncounters).forEach(key => {
        const encounter = room.pendingEncounters[key];
        if (encounter.player1Id === socketId || encounter.player2Id === socketId) {
          delete room.pendingEncounters[key];
        }
      });
      
      // Si la sala queda vacía, eliminarla
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`[removePlayerFromRooms] Sala ${roomId} eliminada (quedó vacía)`);
      } else {
        console.log(`[removePlayerFromRooms] Jugador ${playerName} eliminado definitivamente de sala ${roomId}`);
        affectedRoom = room;
      }
    }
  });
  
  return affectedRoom;
}

/**
 * Elimina jugadores desconectados hace más de X milisegundos
 * @param {Map} rooms - Map de salas
 * @param {number} timeoutMs - Timeout en milisegundos (default: 2 horas)
 * @returns {number} - Cantidad de jugadores eliminados
 */
export function cleanupDisconnectedPlayers(rooms, timeoutMs = 2 * 60 * 60 * 1000) {
  let removedCount = 0;
  const now = Date.now();
  
  rooms.forEach((room, roomId) => {
    const disconnectedPlayers = room.players.filter(
      p => p.disconnectedAt && (now - p.disconnectedAt > timeoutMs)
    );
    
    disconnectedPlayers.forEach(player => {
      const playerIndex = room.players.findIndex(p => p.id === player.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        delete room.roles[player.id];
        removedCount++;
        console.log(`[cleanupDisconnected] Jugador ${player.name} eliminado por timeout en sala ${roomId}`);
      }
    });
    
    // Limpiar encuentros pendientes de jugadores eliminados
    Object.keys(room.pendingEncounters).forEach(key => {
      const encounter = room.pendingEncounters[key];
      const playerStillInRoom = room.players.some(p => 
        p.id === encounter.player1Id || p.id === encounter.player2Id
      );
      if (!playerStillInRoom) {
        delete room.pendingEncounters[key];
      }
    });
    
    // Si la sala queda vacía, eliminarla
    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`[cleanupDisconnected] Sala ${roomId} eliminada (quedó vacía tras cleanup)`);
    }
  });
  
  return removedCount;
}

/**
 * Obtiene lista de salas activas (para mostrar a usuarios)
 * @param {Map} rooms - Map de salas
 * @returns {Array} - Array de salas con info resumida
 */
export function getActiveRooms(rooms) {
  const activeRooms = [];
  
  rooms.forEach((room, roomId) => {
    // Solo mostrar salas en lobby o con pocos jugadores eliminados
    if (room.state === 'lobby' || room.state === 'ready') {
      const connectedPlayers = room.players.filter(p => !p.disconnectedAt);
      activeRooms.push({
        id: room.id,
        playerCount: connectedPlayers.length,
        state: room.state,
        hostName: room.players.find(p => p.id === room.host)?.name || 'Host'
      });
    }
  });
  
  return activeRooms;
}

/**
 * Obtiene lista de salas activas de Time's Up
 * @param {Map} timesupRooms - Map de salas de Time's Up
 * @returns {Array} - Array de salas con info resumida
 */
export function getTimesupActiveRooms(timesupRooms) {
  const activeRooms = [];
  
  timesupRooms.forEach((room, roomId) => {
    // Solo mostrar salas en lobby o team-names
    if (room.timesup.state === 'lobby' || room.timesup.state === 'team-names') {
      activeRooms.push({
        id: room.id,
        playerCount: room.players.length,
        state: room.timesup.state,
        teamCount: room.timesup.config.teamCount,
        hostName: room.players.find(p => p.id === room.host)?.name || 'Host'
      });
    }
  });
  
  return activeRooms;
}

/**
 * Obtiene lista de salas activas de Apuestas
 * @param {Map} apuestasRooms - Map de salas de Apuestas
 * @returns {Array} - Array de salas con info resumida
 */
export function getApuestasActiveRooms(apuestasRooms) {
  const activeRooms = [];
  
  apuestasRooms.forEach((room, roomId) => {
    // Solo mostrar salas en lobby
    if (room.state === 'lobby') {
      activeRooms.push({
        id: room.id,
        playerCount: room.players.length,
        state: room.state,
        rounds: room.config.rounds,
        hostName: room.players.find(p => p.id === room.host)?.name || 'Host'
      });
    }
  });
  
  return activeRooms;
}

/**
 * Transfiere el rol de host a otro jugador si el host está desconectado
 * @param {object} room - Sala
 * @param {object} io - Instancia de socket.io
 * @param {string} gameType - Tipo de juego ('escondite', 'timesup', 'apuestas')
 * @returns {boolean} - true si se transfirió el host
 */
export function transferHostIfNeeded(room, io, gameType = 'escondite') {
  // Si no hay host o el host está conectado, no hacer nada
  if (!room.host) return false;
  
  const hostPlayer = room.players.find(p => p.id === room.host);
  const hostIsConnected = hostPlayer && !hostPlayer.disconnectedAt;
  
  if (hostIsConnected) return false;
  
  // Buscar el primer jugador conectado que no sea el host
  const newHost = room.players.find(p => p.id !== room.host && !p.disconnectedAt);
  
  if (!newHost) {
    console.log(`[transferHost] No hay jugadores conectados para heredar host en sala ${room.id}`);
    return false;
  }
  
  // Guardar info del host anterior
  const oldHostName = hostPlayer?.name || 'Host';
  
  // Asignar nuevo host
  room.host = newHost.id;
  
  console.log(`[transferHost] Host transferido de ${oldHostName} a ${newHost.name} en sala ${room.id}`);
  
  // Emitir eventos según el tipo de juego
  const eventData = {
    newHostId: newHost.id,
    newHostName: newHost.name,
    oldHostName
  };
  
  // Notificar al nuevo host
  io.to(newHost.id).emit('you-are-host', {
    ...eventData,
    isHost: true
  });
  
  // Notificar a todos los demás
  io.to(room.id).emit('host-changed', eventData);
  
  return true;
}

export default {
  createRoom,
  addPlayerToRoom,
  removePlayerFromRooms,
  markPlayerDisconnected,
  cleanupDisconnectedPlayers,
  getActiveRooms,
  getTimesupActiveRooms,
  getApuestasActiveRooms,
  transferHostIfNeeded
};
