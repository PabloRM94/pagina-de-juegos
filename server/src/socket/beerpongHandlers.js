import { v4 as uuidv4 } from 'uuid';

/**
 * Genera el bracket para el tournament de BeerPong
 * @param {Array} teams - Array de equipos
 * @param {number} teamsCount - Cantidad de equipos
 * @param {number} minMatchesPerTeam - Min partidos por equipo (por ahora solo se usa la configuración, pero no implementa doble eliminación)
 * @returns {Object} - Bracket con rondas y partidos
 */
export function generateBracket(teams, teamsCount, minMatchesPerTeam = 1) {
  const rounds = [];
  const shuffled = [...teams].sort(() => Math.random() - 0.5).slice(0, teamsCount);

  if (!teamsCount || teamsCount < 1) {
    return { rounds, teams: shuffled };
  }

  if (teamsCount === 1) {
    // Solo un equipo: campeón directo
    return { rounds: [], teams: shuffled };
  }

  // Construir las rondas de eliminatoria garantizando que si hay par impar
  // el primer round utiliza todos los equipos (sin byes de octavos para 6/12, etc.)
  let currentTeams = shuffled.map((t) => t.id);

  while (currentTeams.length > 1) {
    const round = [];
    const nextTeams = [];

    // Si hay 1 equipo extra (impar), se le deja en bye en esta ronda
    if (currentTeams.length % 2 === 1) {
      const byeTeam = currentTeams.pop();
      round.push({
        team1: byeTeam,
        team2: null,
        winner: byeTeam,
        bye: true
      });
      nextTeams.push(byeTeam);
    }

    for (let i = 0; i < currentTeams.length; i += 2) {
      const team1 = currentTeams[i];
      const team2 = currentTeams[i + 1];

      round.push({
        team1,
        team2,
        winner: null,
        bye: false
      });

      // El ganador se definirá tras jugar partido
      nextTeams.push(null);
    }

    rounds.push(round);
    currentTeams = nextTeams;
  }

  return {
    rounds,
    teams: shuffled
  };
}



/**
 * Configura los handlers de socket para BeerPong Tournament
 * @param {Server} io - Instancia de socket.io
 * @param {Socket} socket - Socket del cliente
 * @param {Map} bepongRooms - Map de salas de BeerPong
 */
export function setupBeerpongSocketHandlers(io, socket, bepongRooms) {
  
  // ==================== BEERPONG - CREAR TORNEO ====================
  socket.on('beerpong-create', (data, callback) => {
    const { teamsCount, playersPerTeam, minMatchesPerTeam, playerName } = data;
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    
    console.log('=== beerpong-create ===', { roomId, teamsCount, playersPerTeam, minMatchesPerTeam, socketId: socket.id });
    
    const bepongRoom = {
      id: roomId,
      host: socket.id,
      gameType: 'beerpong',
      config: { teamsCount, playersPerTeam, minMatchesPerTeam },
      teams: [],
      state: 'setup',
      bracket: { rounds: [], teams: [] },
      champion: null
    };
    
    bepongRooms.set(roomId, bepongRoom);
    
    console.log('Sala beerpong creada:', roomId);
    callback({ success: true, roomId, room: bepongRoom });
  });

  // ==================== BEERPONG - AÑADIR EQUIPO ====================
  socket.on('beerpong-add-team', (data, callback) => {
    const { roomId, teamName, players } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    if (room.host !== socket.id) {
      callback({ success: false, error: 'Solo el host puede añadir equipos' });
      return;
    }
    
    if (room.state !== 'setup') {
      callback({ success: false, error: 'El torneo ya ha comenzado' });
      return;
    }
    
    if (room.teams.length >= room.config.teamsCount) {
      callback({ success: false, error: 'Máximo de equipos alcanzado' });
      return;
    }
    
    // Crear equipo
    const team = {
      id: room.teams.length + 1,
      name: teamName,
      players: players
    };
    
    room.teams.push(team);
    
    // Notificar a todos
    io.emit('beerpong-teams-updated', {
      roomId: room.id,
      teams: room.teams
    });
    
    callback({ success: true, teams: room.teams });
  });

  // ==================== BEERPONG - INICIAR TORNEO ====================
  socket.on('beerpong-start', (data, callback) => {
    const { roomId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    if (room.host !== socket.id) {
      callback({ success: false, error: 'Solo el host puede iniciar el torneo' });
      return;
    }
    
    if (room.teams.length !== room.config.teamsCount) {
      callback({ success: false, error: `Necesitas ${room.config.teamsCount} equipos` });
      return;
    }
    
    // Generar bracket
    room.bracket = generateBracket(room.teams, room.config.teamsCount, room.config.minMatchesPerTeam);
    if (room.bracket.rounds.length === 0 && room.teams.length === 1) {
      room.champion = room.teams[0];
      room.state = 'finished';
    } else {
      room.state = 'playing';
    }

    console.log('Bracket generado para beerpong:', room.id);

    callback({ success: true, bracket: room.bracket });

    io.emit('beerpong-bracket-updated', {
      roomId: room.id,
      bracket: room.bracket,
      champion: room.champion
    });
  });

  // ==================== BEERPONG - ESTABLECER GANADOR ====================
  socket.on('beerpong-set-winner', (data, callback) => {
    const { roomId, roundIndex, matchIndex, winnerTeamId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    if (room.host !== socket.id) {
      callback({ success: false, error: 'Solo el host puede seleccionar ganadores' });
      return;
    }
    
    const round = room.bracket.rounds[roundIndex];
    if (!round || !round[matchIndex]) {
      callback({ success: false, error: 'Partido no encontrado' });
      return;
    }
    
    const match = round[matchIndex];
    
    // Validar que al menos un equipo exista
    if (!match.team1 && !match.team2) {
      callback({ success: false, error: 'El partido no tiene equipos válidos' });
      return;
    }

    // Validar que el winner sea uno de los equipos del partido
    if (winnerTeamId !== match.team1 && winnerTeamId !== match.team2) {
      callback({ success: false, error: 'El ganador debe ser uno de los equipos del partido' });
      return;
    }

    // Establecer winner (bye nose auto-asigna, se requiere input explícito)
    match.winner = winnerTeamId;
    
    // Calcular siguiente ronda y partido
    const isFinal = roundIndex === room.bracket.rounds.length - 1;
    
    if (isFinal) {
      // Es la final - proclamar campeón
      room.champion = room.teams.find(t => t.id === winnerTeamId);
      room.state = 'finished';
      
      console.log('Campeón proclamado:', room.champion.name);
    } else {
      // Avanzar winner a la siguiente ronda
      const nextRoundIndex = roundIndex + 1;
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const nextRound = room.bracket.rounds[nextRoundIndex];
      
      // Determinar posición (team1 o team2) según si es par o impar
      const nextTeamSlot = matchIndex % 2 === 0 ? 'team1' : 'team2';
      
      if (nextRound && nextRound[nextMatchIndex]) {
        nextRound[nextMatchIndex][nextTeamSlot] = winnerTeamId;
      }
    }

    // Rechequear si ya hay campeón (final con ganador definido)
    const finalRound = room.bracket.rounds[room.bracket.rounds.length - 1];
    if (finalRound?.length === 1) {
      const finalMatch = finalRound[0];
      if (finalMatch.winner || (finalMatch.team1 && !finalMatch.team2) || (finalMatch.team2 && !finalMatch.team1)) {
        const championId = finalMatch.winner || finalMatch.team1 || finalMatch.team2;
        room.champion = room.teams.find(t => t.id === championId) || null;
        if (room.champion) room.state = 'finished';
      }
    }

    callback({ success: true, bracket: room.bracket });
    
    // Notificar a todos
    io.emit('beerpong-bracket-updated', {
      roomId: room.id,
      bracket: room.bracket,
      champion: room.champion
    });
  });

  // ==================== BEERPONG - OBTENER SALA ====================
  socket.on('beerpong-get-room', (data, callback) => {
    const { roomId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room) {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    callback({ success: true, room });
  });
}

export default { setupBeerpongSocketHandlers, generateBracket };
