import { v4 as uuidv4 } from 'uuid';
import { assignRandomRole, assignBalancedRole } from '../services/gameEngine.js';

/**
 * Crea una nueva sala
 * @param {string} socketId - ID del socket del host
 * @returns {object} - Sala creada
 */
export function createRoom(socketId) {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const room = {
    id: roomId,
    host: socketId,
    players: [{
      id: socketId,
      name: 'Host',
      isHidden: false,
      isAlive: true,
      eliminated: false
    }],
    state: 'lobby', // lobby, ready, playing, finished
    roles: {},
    pendingEncounters: {}
  };
  
  return room;
}

/**
 * Agrega un jugador a una sala
 * @param {object} room - Sala
 * @param {string} socketId - ID del socket
 * @param {string} playerName - Nombre del jugador
 * @param {string} avatarStyle - Estilo de avatar
 * @param {string} avatarSeed - Seed de avatar
 * @returns {object|null} - Jugador agregado o null si no se pudo
 */
export function addPlayerToRoom(room, socketId, playerName, avatarStyle, avatarSeed) {
  // Verificar si el juego ya comenzó (todos escondidos)
  const gameStarted = (room.state === 'ready' || room.state === 'playing');
  
  const player = {
    id: socketId,
    name: playerName,
    avatarStyle,
    avatarSeed,
    isHidden: gameStarted, // Si el juego ya empezó, se marca como escondido automáticamente
    isAlive: true,
    eliminated: false
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
 * Busca y elimina un jugador de una sala
 * @param {Map} rooms - Map de salas
 * @param {string} socketId - ID del socket
 * @returns {object|null} - Sala de la que se eliminó o null
 */
export function removePlayerFromRooms(rooms, socketId) {
  let affectedRoom = null;
  
  rooms.forEach((room, roomId) => {
    const playerIndex = room.players.findIndex(p => p.id === socketId);
    if (playerIndex !== -1) {
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
      } else {
        affectedRoom = room;
      }
    }
  });
  
  return affectedRoom;
}

export default {
  createRoom,
  addPlayerToRoom,
  removePlayerFromRooms
};
