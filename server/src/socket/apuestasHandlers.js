import { v4 as uuidv4 } from 'uuid';

// Handlers de Apuestas para socket.io

export const setupApuestasSocketHandlers = (io, socket, apuestasRooms) => {
  // Helper para hacer callback opcional
  const cb = (callback, result) => {
    if (typeof callback === 'function') callback(result);
  };

  // APUESTAS - CREAR SALA
  socket.on('apuestas-create', (data, callback) => {
    const { playerName, avatarStyle, avatarSeed } = data;
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    
    const room = {
      id: roomId,
      host: socket.id,
      gameType: 'apuestas',
      players: [{ id: socket.id, name: playerName || 'Host', avatarStyle: avatarStyle || 'adventurer', avatarSeed: avatarSeed || playerName || 'Host' }],
      state: 'lobby',
      config: { targetNumber: null, rounds: 1, currentRound: 1 },
      game: { roundStartTime: null, stoppedPlayers: {}, roundWinners: [] }
    };
    
    apuestasRooms.set(roomId, room);
    cb(callback, { success: true, roomId: room.id, room });
  });

  // APUESTAS - UNIRSE
  socket.on('apuestas-join', (data, callback) => {
    const { roomId, playerName, avatarStyle, avatarSeed } = data;
    const room = apuestasRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'apuestas') { cb(callback, { success: false, error: 'Sala de Apuestas no encontrada' }); return; }
    if (room.state !== 'lobby') { cb(callback, { success: false, error: 'El juego ya ha comenzado' }); return; }
    
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (existingPlayer) { cb(callback, { success: true, room, player: existingPlayer }); return; }
    
    const player = { id: socket.id, name: playerName, avatarStyle: avatarStyle || 'adventurer', avatarSeed: avatarSeed || playerName };
    room.players.push(player);
    
    cb(callback, { success: true, room, player });
    io.emit('apuestas-player-joined', { roomId: room.id, player: { id: socket.id, name: playerName }, playerCount: room.players.length, roundWinners: room.game.roundWinners });
  });

  // APUESTAS - CONFIGURAR
  socket.on('apuestas-set-config', (data, callback) => {
    const { roomId, targetNumber, rounds } = data;
    const room = apuestasRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'apuestas') { cb(callback, { success: false, error: 'Sala no encontrada' }); return; }
    if (room.host !== socket.id) { cb(callback, { success: false, error: 'Solo el host puede configurar' }); return; }
    if (targetNumber < 1 || targetNumber > 10) { cb(callback, { success: false, error: 'El número debe ser entre 1 y 10' }); return; }
    if (![1, 3, 5].includes(rounds)) { cb(callback, { success: false, error: 'Las rondas deben ser 1, 3 o 5' }); return; }
    
    room.config.targetNumber = targetNumber;
    room.config.rounds = rounds;
    room.state = 'config';
    
    io.emit('apuestas-config-set', { roomId: room.id, targetNumber, rounds, state: 'config', roundWinners: room.game.roundWinners });
    cb(callback, { success: true, targetNumber, rounds });
  });

  // APUESTAS - INICIAR
  socket.on('apuestas-start', (data, callback) => {
    const { roomId } = data;
    const room = apuestasRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'apuestas') { cb(callback, { success: false, error: 'Sala no encontrada' }); return; }
    if (room.host !== socket.id) { cb(callback, { success: false, error: 'Solo el host puede iniciar' }); return; }
    if (room.state !== 'config') { cb(callback, { success: false, error: 'No se puede iniciar ahora' }); return; }
    
    room.state = 'playing';
    room.game.roundStartTime = Date.now();
    room.game.stoppedPlayers = {};
    
    io.emit('apuestas-round-started', { roomId: room.id, round: room.config.currentRound, totalRounds: room.config.rounds, targetNumber: room.config.targetNumber, playerCount: room.players.length });
    cb(callback, { success: true });
  });

  // APUESTAS - PARAR
  socket.on('apuestas-stop', (data, callback) => {
    const { roomId } = data;
    const room = apuestasRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'apuestas') { cb(callback, { success: false, error: 'Sala no encontrada' }); return; }
    if (room.state !== 'playing') { cb(callback, { success: false, error: 'El juego no está activo' }); return; }
    if (room.game.stoppedPlayers[socket.id]) { cb(callback, { success: false, error: 'Ya has parado' }); return; }
    
    const stopTime = Date.now();
    const elapsed = (stopTime - room.game.roundStartTime) / 1000;
    room.game.stoppedPlayers[socket.id] = { time: elapsed, stoppedAt: stopTime };
    
    // Solo al jugador que paró
    socket.emit('apuestas-player-stopped', { roomId: room.id, time: elapsed });
    
    // Verificar si todos pararon
    const allStopped = room.players.every(p => room.game.stoppedPlayers[p.id]);
    
    if (allStopped) {
      const targetNumber = room.config.targetNumber;
      const results = [];
      
      room.players.forEach(player => {
        const stoppedData = room.game.stoppedPlayers[player.id];
        if (stoppedData) {
          const diff = Math.abs(stoppedData.time - targetNumber);
          results.push({
            playerId: player.id,
            playerName: player.name,
            time: stoppedData.time,
            diff
          });
        } else {
          results.push({
            playerId: player.id,
            playerName: player.name,
            time: null,
            diff: Infinity,
            disconnected: true
          });
        }
      });
      
      results.sort((a, b) => a.diff - b.diff);
      
      // Verificar empate
      if (results.length >= 2 && results[0].diff === results[1].diff) {
        const tiedPlayers = results.filter(r => r.diff === results[0].diff);
        
        // Nueva ronda de desempate
        room.game.stoppedPlayers = {};
        room.game.roundStartTime = Date.now();
        
        io.emit('apuestas-tie-breaker', {
          roomId: room.id,
          tiedPlayers: tiedPlayers.map(r => ({
            playerId: r.playerId,
            playerName: r.playerName,
            time: r.time,
            diff: r.diff
          })),
          targetNumber: room.config.targetNumber
        });
        cb(callback, { success: true, time: elapsed });
        return;
      }
      
      // Winner de la ronda
      const winner = results[0];
      room.game.roundWinners.push({ round: room.config.currentRound, winnerId: winner.playerId, winnerName: winner.playerName });
      room.state = 'finished';
      
      // Enviar resultados directamente a todos
      io.emit('apuestas-round-ended', {
        roomId: room.id,
        results,
        winner: { playerId: winner.playerId, playerName: winner.playerName },
        round: room.config.currentRound,
        totalRounds: room.config.rounds,
        targetNumber: room.config.targetNumber,
        roundWinners: room.game.roundWinners
      });
    }
    
    cb(callback, { success: true, time: elapsed });
  });

  // APUESTAS - SIGUIENTE RONDA
  socket.on('apuestas-next-round', (data, callback) => {
    const { roomId } = data;
    const room = apuestasRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'apuestas') { cb(callback, { success: false, error: 'Sala no encontrada' }); return; }
    if (room.host !== socket.id) { cb(callback, { success: false, error: 'Solo el host puede continuar' }); return; }
    if (room.config.currentRound >= room.config.rounds) { cb(callback, { success: false, error: 'No hay más rondas' }); return; }
    
    room.config.currentRound++;
    room.state = 'config';
    room.game.roundStartTime = null;
    room.game.stoppedPlayers = {};
    
    io.emit('apuestas-next-round', { roomId: room.id, round: room.config.currentRound, totalRounds: room.config.rounds, state: 'config', roundWinners: room.game.roundWinners });
    cb(callback, { success: true, round: room.config.currentRound });
  });

  // APUESTAS - TERMINAR
  socket.on('apuestas-end', (data, callback) => {
    const { roomId } = data;
    const room = apuestasRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'apuestas') { cb(callback, { success: false, error: 'Sala no encontrada' }); return; }
    if (room.host !== socket.id) { cb(callback, { success: false, error: 'Solo el host puede terminar' }); return; }
    
    room.state = 'finished';
    
    // Obtener el jugador con más rondas ganadas
    const winnerCounts = {};
    room.game.roundWinners.forEach(r => {
      winnerCounts[r.winnerId] = (winnerCounts[r.winnerId] || 0) + 1;
    });
    
    let maxWins = 0;
    let finalWinner = null;
    Object.entries(winnerCounts).forEach(([playerId, count]) => {
      if (count > maxWins) {
        maxWins = count;
        finalWinner = playerId;
      }
    });
    
    // Obtener nombre del winner
    const winnerPlayer = room.players.find(p => p.id === finalWinner);
    
    io.emit('apuestas-game-ended', { roomId: room.id, winner: finalWinner, winnerName: winnerPlayer?.name, roundWinners: room.game.roundWinners, players: room.players });
    cb(callback, { success: true, winner: finalWinner, winnerName: winnerPlayer?.name });
  });

  // APUESTAS - SALIR
  socket.on('apuestas-leave', (data, callback) => {
    const { roomId } = data;
    const room = apuestasRooms.get(roomId.toUpperCase());
    
    if (!room) { cb(callback, { success: false, error: 'Sala no encontrada' }); return; }
    
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) { cb(callback, { success: false, error: 'No estás en esta sala' }); return; }
    
    const playerName = room.players[playerIndex].name;
    room.players.splice(playerIndex, 1);
    
    if (room.players.length === 0) {
      apuestasRooms.delete(roomId);
    } else {
      if (room.host === socket.id && room.players.length > 0) {
        room.host = room.players[0].id;
        io.emit('apuestas-host-changed', { roomId: room.id, newHost: room.host });
      }
      io.emit('apuestas-player-left', { roomId: room.id, playerId: socket.id, playerName, playerCount: room.players.length });
    }
    
    cb(callback, { success: true });
  });
};
