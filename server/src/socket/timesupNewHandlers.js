// TimeUp New - Socket Handlers
// Juego multiplayer con asignación manual de equipos

import {
  createTimesUpNewState,
  assignCaptainsToTeams,
  shuffleArray,
  getCurrentWord,
  markWordGuessed,
  markWordSeen,
  startTurn,
  nextTeamTurn,
  nextPlayerInTeam,
  endTurn,
  startNewRound,
  endRound,
  getLeaderboard,
  getWinner,
  getRoundConfig,
  updateRoundConfig,
  getCurrentPlayer,
  ROUND_NAMES
} from '../services/timesupNewEngine.js';

// Generador de código de sala
function generateRoomCode(existingRooms) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingRooms.has(code));
  return code;
}

/**
 * Registra los handlers de TimeUp New
 * @param {Object} io - Instancia de Socket.io
 * @param {Map} timesupNewRooms - Map de salas
 */
export function registerTimesupNewHandlers(io, timesupNewRooms) {
  
  // Obtener sala por código
  const getRoom = (roomId) => timesupNewRooms.get(roomId?.toUpperCase());
  
  // ==================== CREAR SALA ====================
  io.on('timesupnew-create', (data, callback) => {
    const { teamCount, withSounds, playerName, sessionId } = data;
    
    const roomId = generateRoomCode(timesupNewRooms);
    
    const timesupnewRoom = {
      id: roomId,
      host: null,  // socket.id del host
      players: [],  // [{ id, name, teamId }]
      timesup: createTimesUpNewState(teamCount, withSounds)
    };
    
    // El primer jugador es el host
    const playerId = io.id;
    timesupnewRoom.host = playerId;
    timesupnewRoom.players.push({
      id: playerId,
      name: playerName,
      teamId: null
    });
    
    timesupNewRooms.set(roomId, timesupnewRoom);
    
    console.log(`[timesupnew-create] Sala ${roomId} creada por ${playerName} (sessionId: ${sessionId})`);
    
    callback({ 
      success: true, 
      roomId: timesupnewRoom.id, 
      room: {
        id: timesupnewRoom.id,
        host: timesupnewRoom.host,
        players: timesupnewRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          teamId: p.teamId
        }))
      }
    });
  });
  
  // ==================== UNIRSE A SALA ====================
  io.on('timesupnew-join', (data, callback) => {
    const { roomId, playerName, sessionId } = data;
    const room = getRoom(roomId);
    
    if (!room || room.timesup.state !== 'lobby') {
      return callback({ success: false, error: 'Sala no encontrada o juego ya iniciado' });
    }
    
    // Verificar si el jugador ya está en la sala (reconexión)
    const existingPlayer = room.players.find(p => p.id === io.id);
    if (existingPlayer) {
      console.log(`[timesupnew-join] Jugador ${playerName} reconectado a sala ${roomId}`);
      return callback({
        success: true,
        room: {
          id: room.id,
          host: room.host,
          players: room.players.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })),
          state: room.timesup.state,
          teams: room.timesup.teams
        }
      });
    }
    
    // Agregar nuevo jugador
    room.players.push({
      id: io.id,
      name: playerName,
      teamId: null
    });
    
    console.log(`[timesupnew-join] Jugador ${playerName} se unió a sala ${roomId}`);
    
    // Notificar a todos
    io.emit('timesupnew-player-joined', {
      player: { id: io.id, name: playerName }
    });
    
    callback({
      success: true,
      room: {
        id: room.id,
        host: room.host,
        players: room.players.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })),
        state: room.timesup.state,
        teams: room.timesup.teams
      }
    });
  });
  
  // ==================== OBTENER SALAS ACTIVAS ====================
  io.on('timesupnew-get-active-rooms', (data, callback) => {
    const activeRooms = [];
    
    timesupNewRooms.forEach((room, roomId) => {
      if (room.timesup.state === 'lobby') {
        activeRooms.push({
          id: room.id,
          playerCount: room.players.length,
          hostName: room.players.find(p => p.id === room.host)?.name || 'Unknown'
        });
      }
    });
    
    callback({ success: true, rooms: activeRooms });
  });
  
  // ==================== ASIGNAR EQUIPOS (HOST) ====================
  io.on('timesupnew-assign-teams', (data, callback) => {
    const { roomId, teamAssignments } = data;  // teamAssignments: { playerId: teamId }
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    if (room.host !== io.id) {
      return callback({ success: false, error: 'Solo el host puede asignar equipos' });
    }
    
    // Asignar jugadores a equipos
    room.players = room.players.map(p => ({
      ...p,
      teamId: teamAssignments[p.id] !== undefined ? teamAssignments[p.id] : null
    }));
    
    // Crear estructura de equipos
    const teams = [];
    for (let i = 0; i < room.timesup.config.teamCount; i++) {
      const teamPlayers = room.players
        .filter(p => p.teamId === i)
        .map(p => p.id);
      
      teams.push({
        id: i,
        name: `Equipo ${i + 1}`,
        captainId: teamPlayers.length > 0 ? teamPlayers[0] : null,
        players: teamPlayers,
        score: 0
      });
    }
    
    room.timesup.teams = teams;
    room.timesup.state = 'team-names';
    
    console.log(`[timesupnew-assign-teams] Equipos asignados en sala ${roomId}:`, teams.map(t => ({ id: t.id, players: t.players })));
    
    // Notificar a todos
    io.emit('timesupnew-teams-assigned', {
      teams: room.timesup.teams,
      state: room.timesup.state
    });
    
    callback({ success: true, teams: room.timesup.teams });
  });
  
  // ==================== NOMBRAR EQUIPO (CAPITÁN) ====================
  io.on('timesupnew-name-team', (data, callback) => {
    const { roomId, teamName } = data;
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    // Verificar si es capitán
    const team = room.timesup.teams.find(t => t.captainId === io.id);
    if (!team) {
      return callback({ success: false, error: 'No eres capitán de ningún equipo' });
    }
    
    team.name = teamName;
    
    // Marcar capitán como listo
    if (!room.timesup.captainsReady.includes(io.id)) {
      room.timesup.captainsReady.push(io.id);
    }
    
    console.log(`[timesupnew-name-team] Equipo ${team.id} nombrado: ${teamName}`);
    
    // Notificar
    io.emit('timesupnew-team-named', {
      teamId: team.id,
      teamName: team.name
    });
    
    // Si todos los capitanes han nombrado, pasar a fase de palabras
    const captainsCount = room.timesup.teams.filter(t => t.captainId).length;
    if (room.timesup.captainsReady.length === captainsCount && captainsCount > 0) {
      room.timesup.state = 'words';
      io.emit('timesupnew-all-teams-named', { state: 'words' });
    }
    
    callback({ success: true, teamId: team.id, teamName: team.name });
  });
  
  // ==================== ENVIAR PALABRAS (CADA JUGADOR) ====================
  io.on('timesupnew-submit-words', (data, callback) => {
    const { roomId, words } = data;
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    if (room.timesup.state !== 'words') {
      return callback({ success: false, error: 'No es la fase de palabras' });
    }
    
    // Validar mínimo de palabras
    if (words.length < 3) {
      return callback({ success: false, error: 'Mínimo 3 palabras' });
    }
    
    // Guardar palabras del jugador
    room.timesup.playerWords[io.id] = words;
    room.timesup.playersReady[io.id] = true;
    
    console.log(`[timesupnew-submit-words] Jugador ${io.id} envió ${words.length} palabras`);
    
    // Notificar
    io.emit('timesupnew-player-ready', {
      playerId: io.id,
      readyCount: Object.keys(room.timesup.playersReady).length,
      totalPlayers: room.players.length
    });
    
    // Verificar si todos enviaron
    const allPlayersReady = room.players.every(p => room.timesup.playersReady[p.id]);
    
    if (allPlayersReady) {
      // Recopilar todas las palabras
      const allWords = [];
      Object.values(room.timesup.playerWords).forEach(wordList => {
        allWords.push(...wordList);
      });
      
      room.timesup.allWords = allWords;
      room.timesup.shuffledWords = shuffleArray(allWords);
      room.timesup.wordsUsed = [];
      room.timesup.wordsSeen = [];
      room.timesup.currentRound = 1;
      room.timesup.startingTeam = 0;
      room.timesup.currentTeamTurn = 0;
      room.timesup.currentPlayerIndex = 0;
      room.timesup.state = 'playing';
      
      console.log(`[timesupnew-submit-words] Todas las palabras recibidas: ${allWords.length} palabras`);
      
      io.emit('timesupnew-all-words-received', {
        totalWords: allWords.length,
        currentTeamTurn: room.timesup.currentTeamTurn,
        roundConfig: room.timesup.roundConfig
      });
    }
    
    callback({ success: true });
  });
  
  // ==================== INICIAR TURNO ====================
  io.on('timesupnew-start-turn', (data, callback) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    if (room.timesup.turnActive) {
      return callback({ success: false, error: 'Ya hay un turno activo' });
    }
    
    // Obtener jugador actual
    const currentPlayerId = getCurrentPlayer(room.timesup);
    if (!currentPlayerId) {
      return callback({ success: false, error: 'No hay jugador para iniciar turno' });
    }
    
    // Iniciar turno
    room.timesup = startTurn(room.timesup);
    room.timesup.currentWord = getCurrentWord(room.timesup);
    room.timesup.turnActive = true;
    
    const roundConfig = getRoundConfig(room.timesup, room.timesup.currentRound);
    const timeLimit = roundConfig.timePerTurn;
    
    console.log(`[timesupnew-start-turn] Turno iniciado - Equipo: ${room.timesup.currentTeamTurn}, Jugador: ${currentPlayerId}`);
    
    io.emit('timesupnew-turn-started', {
      roomId: room.id,
      word: room.timesup.currentWord,
      timeLimit: timeLimit,
      teamId: room.timesup.currentTeamTurn,
      playerId: currentPlayerId
    });
    
    callback({
      success: true,
      word: room.timesup.currentWord,
      timeLimit: timeLimit
    });
  });
  
  // ==================== CORRECTO ====================
  io.on('timesupnew-correct', (data, callback) => {
    const { roomId, word } = data;
    const room = getRoom(roomId);
    
    if (!room || !room.timesup.turnActive) {
      return callback({ success: false, error: 'Turno no activo' });
    }
    
    room.timesup = markWordGuessed(room.timesup, word);
    
    const nextWord = getCurrentWord(room.timesup);
    const teamScore = room.timesup.teams[room.timesup.currentTeamTurn].score;
    
    io.emit('timesupnew-word-correct', {
      roomId: room.id,
      word: word,
      nextWord: nextWord,
      teamId: room.timesup.currentTeamTurn,
      teamScore: teamScore
    });
    
    callback({ success: true, score: teamScore, nextWord: nextWord });
  });
  
  // ==================== WRONG ====================
  io.on('timesupnew-wrong', (data, callback) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (!room || !room.timesup.turnActive) {
      return callback({ success: false, error: 'Turno no activo' });
    }
    
    const roundConfig = getRoundConfig(room.timesup, room.timesup.currentRound);
    
    if (!roundConfig.failPassesTurn) {
      // Simplemente pasar a siguiente palabra
      const nextWord = getCurrentWord(room.timesup);
      room.timesup.currentWord = nextWord;
      
      io.emit('timesupnew-word-wrong', {
        roomId: room.id,
        nextWord: nextWord
      });
      
      return callback({ success: true, nextWord: nextWord });
    }
    
    // Terminar turno
    room.timesup = nextTeamTurn(room.timesup);
    room.timesup.turnActive = false;
    room.timesup.currentWord = null;
    
    const nextPlayerId = getCurrentPlayer(room.timesup);
    
    io.emit('timesupnew-wrong-answer', {
      roomId: room.id,
      nextTeamId: room.timesup.currentTeamTurn,
      nextPlayerId: nextPlayerId
    });
    
    callback({ success: true, nextTeamId: room.timesup.currentTeamTurn });
  });
  
  // ==================== SKIP ====================
  io.on('timesupnew-skip', (data, callback) => {
    const { roomId, word } = data;
    const room = getRoom(roomId);
    
    if (!room || !room.timesup.turnActive) {
      return callback({ success: false, error: 'Turno no activo' });
    }
    
    const roundConfig = getRoundConfig(room.timesup, room.timesup.currentRound);
    if (!roundConfig.allowSkip) {
      return callback({ success: false, error: 'Skip no permitido en esta ronda' });
    }
    
    room.timesup = markWordSeen(room.timesup, word);
    
    const nextWord = getCurrentWord(room.timesup);
    
    io.emit('timesupnew-word-skipped', {
      roomId: room.id,
      word: word,
      nextWord: nextWord
    });
    
    callback({ success: true, nextWord: nextWord });
  });
  
  // ==================== CAMBIAR DE EQUIPO ====================
  io.on('timesupnew-change-team', (data, callback) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (!room || !room.timesup.turnActive) {
      return callback({ success: false, error: 'Turno no activo' });
    }
    
    // Terminar turno y pasar al siguiente equipo
    room.timesup = nextTeamTurn(room.timesup);
    room.timesup.turnActive = false;
    room.timesup.currentWord = null;
    
    const nextPlayerId = getCurrentPlayer(room.timesup);
    
    io.emit('timesupnew-team-turn-changed', {
      roomId: room.id,
      nextTeamId: room.timesup.currentTeamTurn,
      nextPlayerId: nextPlayerId,
      round: room.timesup.currentRound
    });
    
    callback({ success: true, nextTeamId: room.timesup.currentTeamTurn });
  });
  
  // ==================== TERMINAR RONDA ====================
  io.on('timesupnew-end-round', (data, callback) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    room.timesup = endRound(room.timesup);
    room.timesup.turnActive = false;
    
    const leaderboard = getLeaderboard(room.timesup);
    const isLastRound = room.timesup.currentRound >= room.timesup.config.totalRounds;
    
    console.log(`[timesupnew-end-round] Ronda ${room.timesup.currentRound} terminada`);
    
    io.emit('timesupnew-round-ended', {
      roomId: room.id,
      round: room.timesup.currentRound,
      roundName: ROUND_NAMES[room.timesup.currentRound],
      totalWords: room.timesup.allWords.length,
      wordsUsed: room.timesup.wordsUsed.length,
      leaderboard: leaderboard,
      scores: room.timesup.roundScores[room.timesup.currentRound],
      isLastRound: isLastRound,
      nextStartingTeam: room.timesup.startingTeam
    });
    
    callback({ success: true });
  });
  
  // ==================== SIGUIENTE RONDA ====================
  io.on('timesupnew-next-round', (data, callback) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    room.timesup = startNewRound(room.timesup);
    room.timesup.state = 'playing';
    
    const leaderboard = getLeaderboard(room.timesup);
    const firstPlayerId = getCurrentPlayer(room.timesup);
    
    console.log(`[timesupnew-next-round] Ronda ${room.timesup.currentRound} iniciada`);
    
    io.emit('timesupnew-next-round', {
      roomId: room.id,
      currentRound: room.timesup.currentRound,
      startingTeam: room.timesup.currentTeamTurn,
      firstPlayerId: firstPlayerId,
      leaderboard: leaderboard
    });
    
    callback({ success: true });
  });
  
  // ==================== ACTUALIZAR CONFIG DE RONDA ====================
  io.on('timesupnew-update-round-config', (data, callback) => {
    const { roomId, roundNumber, config } = data;
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    if (room.host !== io.id) {
      return callback({ success: false, error: 'Solo el host puede editar la configuración' });
    }
    
    room.timesup = updateRoundConfig(room.timesup, roundNumber, config);
    
    io.emit('timesupnew-round-config-updated', {
      roomId: room.id,
      roundNumber: roundNumber,
      config: room.timesup.roundConfig[roundNumber]
    });
    
    callback({ success: true });
  });
  
  // ==================== OBTENER ESTADO ====================
  io.on('timesupnew-get-state', (data, callback) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }
    
    callback({
      success: true,
      state: room.timesup.state,
      teams: room.timesup.teams,
      currentRound: room.timesup.currentRound,
      currentTeamTurn: room.timesup.currentTeamTurn,
      scores: room.timesup.teams.map(t => t.score),
      roundScores: room.timesup.roundScores,
      roundConfig: room.timesup.roundConfig
    });
  });
  
  // ==================== SALIR DE SALA ====================
  io.on('timesupnew-leave', (data, callback) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (room) {
      const playerIndex = room.players.findIndex(p => p.id === io.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        
        // Si era el host, transferir a otro
        if (room.host === io.id && room.players.length > 0) {
          room.host = room.players[0].id;
          io.emit('timesupnew-host-changed', {
            newHostId: room.host,
            newHostName: room.players[0].name
          });
        }
        
        // Si se fue un jugador, notificar
        io.emit('timesupnew-player-left', {
          playerId: io.id,
          playerName: player.name
        });
        
        // Si no hay jugadores, eliminar sala
        if (room.players.length === 0) {
          timesupNewRooms.delete(roomId);
          console.log(`[timesupnew-leave] Sala ${roomId} eliminada (sin jugadores)`);
        }
      }
    }
    
    callback({ success: true });
  });
  
  console.log('✅ TimeUp New handlers registrados');
}

export default registerTimesupNewHandlers;
