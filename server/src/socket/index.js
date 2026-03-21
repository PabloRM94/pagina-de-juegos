import { setupApuestasSocketHandlers } from './apuestasHandlers.js';

import { v4 as uuidv4 } from 'uuid';
import { createRoom, addPlayerToRoom, removePlayerFromRooms } from './room.js';
import { assignRandomRole, assignBalancedRole, resolveEncounter } from '../services/gameEngine.js';

import { 
  createTimesUpState, 
  assignCaptains, 
  setupWords, 
  shuffleArray,
  getCurrentDescribePlayer, 
  getCurrentWord,
  getRemainingWordsCount,
  getRoundConfig,
  updateRoundConfig,
  markWordGuessed,
  markWordSeen,
  nextTeamTurn,
  nextPlayerInTeam,
  startNewRound,
  getStartingTeam,
  getLeaderboard,
  getWinner,
  areAllWordsGuessed,
  DEFAULT_ROUND_CONFIG,
  ROUND_TIMES,
  ROUND_NAMES
} from '../services/timesupEngine.js';

/**
 * Configura los handlers de socket.io
 * @param {Server} io - Instancia de socket.io
 */
export function setupSocketHandlers(io) {
  // Estado en memoria
  const rooms = new Map();
  
  // Salas de Time's Up - separadas del sistema de rooms de socket.io
  // Esto evita que los jugadores salgan de la sala cuando cambia la vista
  const timesupRooms = new Map();
  
  // Salas de Apuestas - cronómetro de precisión
  const apuestasRooms = new Map();
  
  // Función helper para buscar sala de Time's Up
  const getTimesupRoom = (roomId) => {
    if (!roomId) return null;
    return timesupRooms.get(roomId.toUpperCase());
  };
  
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

        return;
      }
      
      // Agregar jugador
      const player = addPlayerToRoom(room, socket.id, playerName, avatarStyle, avatarSeed);
      
      socket.join(roomId);
      
      callback({ success: true, room, player });
      io.emit('room-updated', room);
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
          io.emit('game-started', { room });
  
        }, 3000);
        
        io.emit('all-hidden', { room });
        console.log(`Todos escondidos en sala ${roomId}, roles asignados`);
      }
      
      callback({ success: true, room });
      io.emit('room-updated', room);
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
        io.emit('game-finished', {
          winningTeam,
          winningPlayers: winningPlayers.map(p => ({ id: p.id, name: p.name }))
        });
      }
      
      // Actualizar room para todos (para ver estados de eliminado)
      io.emit('room-updated', room);
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
      io.emit('room-updated', room);
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
    
    // ==================== TIME'S UP - CREAR PARTIDA ====================
    socket.on('timesup-create', (data, callback) => {
      const { teamCount, withSounds, playerName } = data;
      const roomId = uuidv4().slice(0, 8).toUpperCase();
      
      console.log('=== timesup-create ===', { roomId, teamCount, withSounds, socketId: socket.id, playerName });
      
      // Crear sala de Time's Up - guardada en timesupRooms separada
      const timesupRoom = {
        id: roomId,
        host: socket.id,
        gameType: 'timesup',
        players: [{
          id: socket.id,
          name: playerName || 'Host',
          avatarStyle: 'avataaars',
          avatarSeed: playerName || 'Host'
        }],
        state: 'lobby',
        timesup: createTimesUpState(teamCount, withSounds)
      };
      
      // Guardar en timesupRooms (no depende del sistema de rooms de socket.io)
      timesupRooms.set(roomId, timesupRoom);
      
      console.log('Sala timesup creada:', roomId, 'en timesupRooms:', Array.from(timesupRooms.keys()));
      
      callback({ success: true, roomId: timesupRoom.id, room: timesupRoom });
      console.log(`Time's Up creado en sala ${timesupRoom.id} por ${socket.id}`);
    });
    
    // ==================== TIME'S UP - UNIRSE ====================
    socket.on('timesup-join', (data, callback) => {
      const { roomId, playerName, avatarStyle, avatarSeed } = data;
      console.log('=== timesup-join ===', { roomId, playerName, socketId: socket.id });
      console.log('TimesupRooms disponibles:', Array.from(timesupRooms.keys()));
      
      // Buscar en timesupRooms en lugar de rooms
      const room = timesupRooms.get(roomId.toUpperCase());
      console.log('Sala encontrada:', room ? room.id : 'NULL', 'gameType:', room?.gameType);
      
      if (!room || room.gameType !== 'timesup') {
        console.log('ERROR: Sala no encontrada o no es timesup');
        callback({ success: false, error: 'Sala de Time\'s Up no encontrada' });
        return;
      }
      
      if (room.timesup.state !== 'lobby' && room.timesup.state !== 'team-names') {
        callback({ success: false, error: 'El juego ya ha comenzado' });
        return;
      }
      
      // Agregar jugador directamente a la sala de Time's Up
      const player = {
        id: socket.id,
        name: playerName,
        avatarStyle: avatarStyle || 'avataaars',
        avatarSeed: avatarSeed || playerName
      };
      
      // Verificar si el jugador ya existe
      const existingPlayer = room.players.find(p => p.id === socket.id);
      if (!existingPlayer) {
        room.players.push(player);
      }
      
      console.log('Jugador unido:', playerName, 'Total jugadores:', room.players.length);
      
      callback({ success: true, room, player });
      
      // Enviar a todos los sockets conocidos (usando io en lugar de room)
      io.emit('timesup-player-joined', { 
        player: { id: socket.id, name: playerName },
        playerCount: room.players.length
      });
      console.log(`${playerName} se unió a Time's Up en sala ${roomId}`);
    });
    
    // ==================== TIME'S UP - ASIGNAR CAPITANES ====================
    socket.on('timesup-assign-captains', (data, callback) => {
      const { roomId } = data;
      
      console.log('========== timesup-assign-captains ==========');
      console.log('roomId recibido:', roomId);
      console.log('socket.id:', socket.id);
      console.log('timesupRooms disponibles:', Array.from(timesupRooms.keys()));
      
      // Buscar en timesupRooms
      const room = timesupRooms.get(roomId.toUpperCase());
      
      console.log('Sala encontrada:', room ? room.id : 'NULL');
      console.log('room.host:', room?.host);
      console.log('room.players.length:', room?.players?.length);
      
      if (!room || room.gameType !== 'timesup') {
        console.log('ERROR: Sala no encontrada');
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      if (room.host !== socket.id) {
        console.log('ERROR: Solo el host puede asignar capitanes');
        callback({ success: false, error: 'Solo el host puede asignar capitanes' });
        return;
      }
      
      console.log('Jugadores en la sala antes de asignar capitanes:', room.players.map(p => p.id));
      
      // Asignar capitanes aleatorios
      room.timesup.teams = assignCaptains(room.players, room.timesup.config.teamCount);
      room.timesup.state = 'team-names';
      
      console.log('Equipos creados:', room.timesup.teams.map(t => ({ id: t.id, captainId: t.captainId, players: t.players })));
      
      // Notificar a todos los clientes directamente
      console.log('Enviando timesup-captains-assigned a todos los clientes');
      
      io.emit('timesup-captains-assigned', {
        roomId: room.id,
        teams: room.timesup.teams,
        state: room.timesup.state
      });
      
      console.log('Evento enviado, esperando respuesta...');
      console.log('============================================');
      
      callback({ success: true, roomId: room.id, teams: room.timesup.teams });
    });
    
    
    // ==================== TIME'S UP - NOMBRAR EQUIPO ====================
    socket.on('timesup-name-team', (data, callback) => {
      const { roomId, teamName } = data;
      
      console.log('========== timesup-name-team ==========');
      console.log('roomId recibido:', roomId);
      console.log('roomId uppercase:', roomId?.toUpperCase());
      console.log('socket.id:', socket.id);
      console.log('teamName:', teamName);
      console.log('timesupRooms disponibles:', Array.from(timesupRooms.keys()));
      
      // Buscar en timesupRooms
      const room = timesupRooms.get(roomId?.toUpperCase());
      console.log('Sala encontrada:', room ? room.id : 'NULL');
      console.log('gameType:', room?.gameType);
      
      if (!room || room.gameType !== 'timesup') {
        console.log('ERROR: Sala no encontrada o gameType incorrecto');
        console.log('============================================');
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      // Verificar que el jugador esté en la sala
      const playerInRoom = room.players.find(p => p.id === socket.id);
      console.log('Jugador en sala:', playerInRoom ? 'SÍ' : 'NO');
      
      // Encontrar el equipo del capitán
      const team = room.timesup.teams.find(t => t.captainId === socket.id);
      console.log('Equipo del capitán:', team ? `Equipo ${team.id}` : 'NO ENCONTRADO');
      console.log('Capitanes disponibles:', room.timesup.teams.map(t => t.captainId));
      
      if (!team) {
        console.log('ERROR: No eres captain de ningún equipo');
        console.log('============================================');
        callback({ success: false, error: 'No eres captain de ningún equipo' });
        return;
      }
      
      team.name = teamName;
      room.timesup.captainsReady.push(socket.id);
      
      console.log('[timesup-name-team] captainsReady:', room.timesup.captainsReady.length, 'teamCount:', room.timesup.config.teamCount);
      
      // Verificar si todos los capitanes nombraron
      if (room.timesup.captainsReady.length === room.timesup.config.teamCount) {
        room.timesup.state = 'words';
        io.emit('timesup-all-teams-named', { state: 'words' });
      }
      
      io.emit('timesup-team-named', { teamId: team.id, teamName });
      callback({ success: true, team });
    });
    
    // ==================== TIME'S UP - ENVIAR PALABRAS ====================
    socket.on('timesup-submit-words', (data, callback) => {
      const { roomId, words } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      console.log('========== timesup-submit-words ==========');
      console.log('roomId:', roomId);
      console.log('socket.id:', socket.id);
      console.log('palabras:', words?.length);
      
      if (!room || room.gameType !== 'timesup') {
        console.log('ERROR: Sala no encontrada');
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      if (room.timesup.state !== 'words') {
        console.log('ERROR: No es la fase de palabras, estado actual:', room.timesup.state);
        callback({ success: false, error: 'No es la fase de palabras' });
        return;
      }
      
      // Validar número de palabras
      if (!words || words.length < 3 || words.length > 10) {
        console.log('ERROR: Número de palabras inválido');
        callback({ success: false, error: 'Debes enviar entre 3 y 10 palabras' });
        return;
      }
      
      room.timesup.playerWords[socket.id] = words;
      room.timesup.playersReady[socket.id] = true;
      
      console.log('playersReady:', room.timesup.playersReady);
      console.log('room.players:', room.players.map(p => p.id));
      
      // Verificar si TODOS los capitanes enviaron palabras
      const captains = room.timesup.teams.filter(t => t.captainId).map(t => t.captainId);
      const allCaptainsReady = captains.every(captainId => room.timesup.playersReady[captainId]);
      
      console.log('Capitanes:', captains);
      console.log('Todos los capitanes listos:', allCaptainsReady);
      
      if (allCaptainsReady) {
        console.log('Todos los capitanes enviaron palabras, mezclando...');
        
        // Recolectar todas las palabras del pool común
        const allWords = [];
        Object.values(room.timesup.playerWords).forEach(words => {
          allWords.push(...words);
        });
        room.timesup.allWords = allWords;
        
        // Mezclar palabras para la primera ronda
        room.timesup.shuffledWords = setupWords(room.timesup.allWords);
        room.timesup.wordsUsed = [];
        room.timesup.wordsSeen = [];
        room.timesup.currentRound = 1;
        room.timesup.startingTeam = 0;  // Equipo 0 empieza la ronda 1
        room.timesup.currentTeamTurn = room.timesup.startingTeam;
        room.timesup.currentPlayerIndex = 0;
        room.timesup.state = 'playing';
        
        console.log('Palabras totales:', room.timesup.allWords.length);
        
        // Obtener información del primer turno
        const currentTeam = room.timesup.teams[room.timesup.currentTeamTurn];
        const currentPlayerId = currentTeam?.players[room.timesup.currentPlayerIndex];
        
        console.log('Primer turno - Equipo:', room.timesup.currentTeamTurn, 'Jugador:', currentPlayerId);
        
        // Usar io.emit porque timesupRooms NO está en socket.io rooms
        io.emit('timesup-all-words-received', { 
          roomId: room.id,
          state: 'playing',
          totalWords: room.timesup.allWords.length,
          currentTeamTurn: room.timesup.currentTeamTurn,
          currentPlayerId: currentPlayerId,
          round: 1,
          startingTeam: 0,
          roundConfig: room.timesup.roundConfig
        });
      }
      
      // Usar io.emit en lugar de io.to(roomId)
      io.emit('timesup-player-ready', { 
        roomId: room.id,
        playerId: socket.id,
        wordsCount: words.length,
        readyCount: Object.keys(room.timesup.playersReady).length,
        totalCaptains: captains.length
      });
      
      console.log('===========================================');
      
      callback({ success: true, allReady: allCaptainsReady });
    });
    
    // ==================== TIME'S UP - INICIAR TURNO ====================
    socket.on('timesup-start-turn', (data, callback) => {
      const { roomId } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      if (!room || room.gameType !== 'timesup') {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      const currentTeam = room.timesup.teams[room.timesup.currentTeamTurn];
      
      // Verificar que el jugador pertenece al equipo actual
      if (!currentTeam || !currentTeam.players.includes(socket.id)) {
        callback({ success: false, error: 'No perteneces a este equipo' });
        return;
      }
      
      // Verificar que no haya otro jugador уже describiendo
      if (room.timesup.turnActive && room.timesup.currentDescribePlayer) {
        callback({ success: false, error: 'Ya hay un jugador describiendo' });
        return;
      }
      
      const currentWord = getCurrentWord(room.timesup);
      room.timesup.turnActive = true;
      room.timesup.currentDescribePlayer = socket.id;
      room.timesup.currentPlayerIndex = currentTeam.players.indexOf(socket.id);
      
      // Usar la configuración de la ronda (puede haber sido editada por el host)
      const roundConfig = getRoundConfig(room.timesup, room.timesup.currentRound);
      const roundTimeMs = roundConfig.timePerTurn;
      
      if (room.timesup.currentTurnTimer) {
        clearTimeout(room.timesup.currentTurnTimer);
      }
      
      room.timesup.currentTurnTimer = setTimeout(() => {
        console.log('[timesup-start-turn] Tiempo agotado!');
        
        // Tiempo agotado - fin del turno
        io.emit('timesup-turn-timeout', {
          roomId: room.id,
          teamId: room.timesup.currentTeamTurn,
          playerId: getCurrentDescribePlayer(room.timesup)
        });
        
        // Cambiar de equipo
        room.timesup = nextTeamTurn(room.timesup);
        room.timesup.turnActive = false;
        
        // Verificar si quedan palabras - si no quedan, terminar ronda
        if (areAllWordsGuessed(room.timesup)) {
          console.log('[timesup-start-turn] Sin palabras restantes - fin de ronda');
          
          // Obtener info del primer jugador del equipo que empieza la próxima ronda
          room.timesup = startNewRound(room.timesup);
          const firstTeam = room.timesup.teams[room.timesup.currentTeamTurn];
          const firstPlayerId = firstTeam?.players[0];
          
          io.emit('timesup-next-round', {
            roomId: room.id,
            round: room.timesup.currentRound,
            roundName: ROUND_NAMES[room.timesup.currentRound],
            totalWords: room.timesup.shuffledWords.length,
            wordsUsed: room.timesup.wordsUsed.length,
            leaderboard: getLeaderboard(room.timesup),
            scores: room.timesup.roundScores[room.timesup.currentRound],
            startingTeam: room.timesup.startingTeam,
            firstPlayerId: firstPlayerId,
            isLastRound: room.timesup.currentRound >= room.timesup.config.totalRounds
          });
          
          callback({ success: false, error: 'Ronda terminada', roundEnded: true });
          return;
        }
        
        io.emit('timesup-team-turn-changed', {
          roomId: room.id,
          nextTeamId: room.timesup.currentTeamTurn,
          nextPlayerId: getCurrentDescribePlayer(room.timesup),
          round: room.timesup.currentRound,
          roundName: ROUND_NAMES[room.timesup.currentRound]
        });

      }, roundTimeMs);
      
      // Notificar a todos
      io.emit('timesup-turn-started', {
        teamId: room.timesup.currentTeamTurn,
        playerId: socket.id,
        round: room.timesup.currentRound,
        roundName: ROUND_NAMES[room.timesup.currentRound],
        timeLimit: roundTimeMs,
        word: currentWord
      });
      
      callback({ 
        success: true, 
        word: currentWord,
        timeLimit: roundTimeMs 
      });
    });
    
    // ==================== TIME'S UP - RESPUESTA CORRECTA ====================
    socket.on('timesup-correct', (data, callback) => {
      const { roomId, word } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      if (!room || room.gameType !== 'timesup') {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      // Verificar que el turno esté activo
      if (!room.timesup.turnActive) {
        callback({ success: false, error: 'El turno no está activo' });
        return;
      }
      
      const currentDescribePlayer = getCurrentDescribePlayer(room.timesup);
      if (currentDescribePlayer !== socket.id) {
        callback({ success: false, error: 'No es tu turno' });
        return;
      }
      
      // Marcar palabra como adivinada
      room.timesup = markWordGuessed(room.timesup, word);
      
      const currentScore = room.timesup.teams[room.timesup.currentTeamTurn].score;
      const remainingWords = getRemainingWordsCount(room.timesup);
      
      // Verificar si se terminan las palabras - fin de ronda
      if (areAllWordsGuessed(room.timesup)) {
        console.log('[timesup-correct] Todas las palabras adivinadas - fin de ronda');
        
        // Detener timer
        clearTimeout(room.timesup.currentTurnTimer);
        room.timesup.turnActive = false;
        
        // Obtener info del primer jugador del equipo que empieza la próxima ronda
        room.timesup = startNewRound(room.timesup);
        const firstTeam = room.timesup.teams[room.timesup.currentTeamTurn];
        const firstPlayerId = firstTeam?.players[0];
        
        // Emitir fin de ronda
        io.emit('timesup-next-round', {
          roomId: room.id,
          round: room.timesup.currentRound,
          roundName: ROUND_NAMES[room.timesup.currentRound],
          totalWords: room.timesup.shuffledWords.length,
          wordsUsed: room.timesup.wordsUsed.length,
          leaderboard: getLeaderboard(room.timesup),
          scores: room.timesup.roundScores[room.timesup.currentRound],
          startingTeam: room.timesup.startingTeam,
          firstPlayerId: firstPlayerId,
          isLastRound: room.timesup.currentRound >= room.timesup.config.totalRounds
        });
        
        callback({ success: true, score: currentScore, roundEnded: true });
        return;
      }
      
      // Obtener siguiente palabra
      const nextWord = getCurrentWord(room.timesup);
      
      io.emit('timesup-word-correct', {
        roomId: room.id,
        teamId: room.timesup.currentTeamTurn,
        word,
        teamScore: currentScore,
        nextWord: nextWord,
        remainingWords: remainingWords - 1
      });
      
      callback({ success: true, score: currentScore });
    });
    
    // ==================== TIME'S UP - RESPUESTA INCORRECTA ====================
    socket.on('timesup-wrong', (data, callback) => {
      const { roomId } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      if (!room || room.gameType !== 'timesup') {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      // Verificar que el turno esté activo
      if (!room.timesup.turnActive) {
        callback({ success: false, error: 'El turno no está activo' });
        return;
      }
      
      const currentDescribePlayer = getCurrentDescribePlayer(room.timesup);
      if (currentDescribePlayer !== socket.id) {
        callback({ success: false, error: 'No es tu turno' });
        return;
      }
      
      // Usar la configuración de la ronda
      const roundConfig = getRoundConfig(room.timesup, room.timesup.currentRound);
      
      if (roundConfig.failPassesTurn) {
        // Pierde turno - cambia al otro equipo
        clearTimeout(room.timesup.currentTurnTimer);
        room.timesup = nextTeamTurn(room.timesup);
        room.timesup.turnActive = false;
        
        io.emit('timesup-wrong-answer', {
          roomId: room.id,
          wrongTeamId: room.timesup.currentTeamTurn,
          nextTeamId: room.timesup.currentTeamTurn,
          nextPlayerId: getCurrentDescribePlayer(room.timesup)
        });
      } else {
        // No pasa turno - solo pasar a siguiente palabra
        const nextWord = getCurrentWord(room.timesup);
        io.emit('timesup-word-wrong', { roomId: room.id, nextWord });
      }
      
      callback({ success: true });
    });
    
    // ==================== TIME'S UP - SALTAR PALABRA ====================
    socket.on('timesup-skip', (data, callback) => {
      const { roomId } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      if (!room || room.gameType !== 'timesup') {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      // Verificar que el turno esté activo
      if (!room.timesup.turnActive) {
        callback({ success: false, error: 'El turno no está activo' });
        return;
      }
      
      const currentDescribePlayer = getCurrentDescribePlayer(room.timesup);
      if (currentDescribePlayer !== socket.id) {
        callback({ success: false, error: 'No es tu turno' });
        return;
      }
      
      // Verificar si el skip está permitido en esta ronda
      const roundConfig = getRoundConfig(room.timesup, room.timesup.currentRound);
      if (!roundConfig.allowSkip) {
        callback({ success: false, error: 'El skip no está permitido en esta ronda' });
        return;
      }
      
      // Marcar palabra como vista (no adivinada pero ya vista en esta ronda)
      let avoidIndex = -1;
      if (data.word) {
        room.timesup = markWordSeen(room.timesup, data.word);
        // Obtener el índice de la palabra actual para evitarla
        avoidIndex = room.timesup.shuffledWords.indexOf(data.word);
      }
      
      // Obtener siguiente palabra (evitando la actual)
      const nextWord = getCurrentWord(room.timesup, avoidIndex);
      const remainingWords = getRemainingWordsCount(room.timesup);
      
      if (!nextWord) {
        callback({ success: false, error: 'No hay más palabras' });
        return;
      }
      
      io.emit('timesup-word-skipped', { roomId: room.id, nextWord, remainingWords });
      callback({ success: true, nextWord, remainingWords });
    });
    
    // ==================== TIME'S UP - CAMBIAR DE EQUIPO ====================
    socket.on('timesup-change-team', (data, callback) => {
      const { roomId } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      if (!room || room.gameType !== 'timesup') {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      const currentDescribePlayer = getCurrentDescribePlayer(room.timesup);
      if (currentDescribePlayer !== socket.id) {
        callback({ success: false, error: 'No es tu turno' });
        return;
      }
      
      // Detener temporizador
      if (room.timesup.currentTurnTimer) {
        clearTimeout(room.timesup.currentTurnTimer);
      }
      
      // Cambiar de equipo
      room.timesup = nextTeamTurn(room.timesup);
      room.timesup.turnActive = false;
      
      io.emit('timesup-team-turn-changed', {
        nextTeamId: room.timesup.currentTeamTurn,
        nextPlayerId: getCurrentDescribePlayer(room.timesup),
        round: room.timesup.currentRound,
        roundName: ROUND_NAMES[room.timesup.currentRound]
      });
      
      callback({ success: true });
    });
    
    // ==================== TIME'S UP - FIN DE RONDA (manual) ====================
    socket.on('timesup-end-round', (data, callback) => {
      const { roomId } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      if (!room || room.gameType !== 'timesup') {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      console.log('[timesup-end-round] Fin de ronda solicitado', { 
        currentRound: room.timesup.currentRound,
        totalRounds: room.timesup.config.totalRounds,
        wordsUsed: room.timesup.wordsUsed?.length,
        totalWords: room.timesup.shuffledWords?.length
      });
      
      // Detener temporizador
      if (room.timesup.currentTurnTimer) {
        clearTimeout(room.timesup.currentTurnTimer);
      }
      
      room.timesup.turnActive = false;
      
      // Verificar si hay más rondas
      const totalRounds = room.timesup.config.totalRounds;
      
      if (room.timesup.currentRound >= totalRounds) {
        // Fin del juego
        room.timesup.state = 'finished';
        const winner = getWinner(room.timesup);
        const leaderboard = getLeaderboard(room.timesup);
        
        io.emit('timesup-game-ended', {
          roomId: room.id,
          winner: winner ? { id: winner.id, name: winner.name } : null,
          leaderboard,
          roundScores: room.timesup.roundScores,
          finalScores: room.timesup.teams.map((t, i) => ({ 
            teamId: i, 
            teamName: t.name, 
            score: t.score 
          }))
        });
      } else {
        // Siguiente ronda - usar startNewRound que alterna equipo inicial
        room.timesup = startNewRound(room.timesup);
        
        console.log('[timesup-end-round] Nueva ronda', {
          round: room.timesup.currentRound,
          startingTeam: room.timesup.startingTeam,
          currentTeamTurn: room.timesup.currentTeamTurn,
          wordsCount: room.timesup.shuffledWords?.length
        });
        
        // Obtener info del primer jugador del equipo que empieza
        const firstTeam = room.timesup.teams[room.timesup.currentTeamTurn];
        const firstPlayerId = firstTeam?.players[0];
        
        io.emit('timesup-next-round', {
          roomId: room.id,
          currentRound: room.timesup.currentRound,
          roundName: ROUND_NAMES[room.timesup.currentRound],
          totalWords: room.timesup.shuffledWords?.length,
          wordsUsed: 0,
          leaderboard: getLeaderboard(room.timesup),
          scores: room.timesup.roundScores[room.timesup.currentRound - 1],
          startingTeam: room.timesup.startingTeam,
          firstPlayerId: firstPlayerId,
          isLastRound: room.timesup.currentRound >= totalRounds
        });
      }
      
      callback({ success: true });
    });
    
    // ==================== TIME'S UP - ACTUALIZAR CONFIG DE RONDA ====================
    socket.on('timesup-update-round-config', (data, callback) => {
      const { roomId, roundNumber, config } = data;
      const room = timesupRooms.get(roomId.toUpperCase());
      
      if (!room || room.gameType !== 'timesup') {
        callback({ success: false, error: 'Sala no encontrada' });
        return;
      }
      
      if (room.host !== socket.id) {
        callback({ success: false, error: 'Solo el host puede modificar la configuración' });
        return;
      }
      
      if (roundNumber < 1 || roundNumber > 4) {
        callback({ success: false, error: 'Número de ronda inválido' });
        return;
      }
      
      room.timesup = updateRoundConfig(room.timesup, roundNumber, config);
      
      io.emit('timesup-round-config-updated', {
        roomId: room.id,
        roundNumber,
        config: room.timesup.roundConfig[roundNumber]
      });
      
      callback({ success: true, config: room.timesup.roundConfig[roundNumber] });
    });

    // ==================== APUESTAS - REGISTRAR HANDLERS ====================
    setupApuestasSocketHandlers(io, socket, apuestasRooms);

    // ==================== DESCONEXIÓN ====================
    socket.on('disconnect', (reason) => {
      console.log('========== USUARIO DESCONECTADO ==========');
      console.log('socket.id:', socket.id);
      console.log('reason:', reason);
      
      const affectedRoom = removePlayerFromRooms(rooms, socket.id);
      
      if (affectedRoom) {
        console.log('affectedRoom.id:', affectedRoom.id);
        console.log('Jugadores restantes en sala:', affectedRoom.players.length);
        io.to(affectedRoom.id).emit('room-updated', affectedRoom);
      }
      
      console.log('===========================================');
    });
  });
}


export default { setupSocketHandlers };
