import { v4 as uuidv4 } from 'uuid';
import { generateRoomCode } from './room.js';

// ==================== UTILIDADES ====================

/**
 * Obtiene el timer sin el intervalId (para enviar por socket.io)
 * @param {object} timer - Objeto timer de la room
 * @returns {object} - Timer limpio serializable
 */
function getCleanTimer(timer) {
  return {
    matchId: timer.matchId,
    matchLabel: timer.matchLabel,
    duration: timer.duration,
    remaining: timer.remaining,
    isRunning: timer.isRunning,
    startedAt: timer.startedAt
  };
}

/**
 * Genera calendario de round-robin para un grupo de equipos
 * Asegura que todos jueguen la misma cantidad de partidos
 * @param {Array} teamIds - IDs de equipos
 * @returns {Array} - Partidos generados
 */
function generateRoundRobin(teamIds) {
  const matches = [];
  const n = teamIds.length;
  
  if (n < 2) return matches;
  
  // Crear lista de equipos para rotar
  const teams = [...teamIds];
  const firstTeam = teams[0]; // Mantener primer equipo fijo
  const restTeams = teams.slice(1);
  
  // rounds = n - 1 (cada equipo juega contra todos los demás una vez)
  const totalRounds = n - 1;
  
  for (let round = 0; round < totalRounds; round++) {
    // Rotar los equipos restantes
    const lastTeam = restTeams.pop();
    restTeams.unshift(lastTeam);
    
    // Emparejar: primero vs resto[0], segundo vs resto[1], etc.
    const roundMatches = [];
    for (let i = 0; i < Math.floor(restTeams.length / 2); i++) {
      const team1 = restTeams[i];
      const team2 = restTeams[restTeams.length - 1 - i];
      
      if (team1 && team2) {
        roundMatches.push({ team1: firstTeam, team2: team1, round });
        roundMatches.push({ team1: restTeams[restTeams.length - 1 - i], team2: restTeams[i], round: round + totalRounds });
      }
    }
    
    // Si hay cantidad impar, emparejar los del medio
    if (restTeams.length % 2 === 1) {
      const midIndex = Math.floor(restTeams.length / 2);
      const midTeam = restTeams[midIndex];
      if (midTeam) {
        // Este equipo descansa esta ronda
      }
    }
    
    matches.push(...roundMatches);
  }
  
  // Reformatear para tener estructura consistente
  return matches.map((m, idx) => ({
    team1: m.team1,
    team2: m.team2,
    winner: null,
    bye: false,
    round: idx
  }));
}

/**
 * Genera round-robin simple y equitativo para cualquier cantidad de equipos
 * @param {Array} teamIds - IDs de equipos
 * @returns {Array} - Partidos generados
 */
function generateSimpleRoundRobin(teamIds) {
  const matches = [];
  const n = teamIds.length;
  
  if (n < 2) return matches;
  
  // Crear todas las posibles combinaciones de partidos
  const allPairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allPairs.push([teamIds[i], teamIds[j]]);
    }
  }
  
  // Barajar los partidos
  const shuffledPairs = allPairs.sort(() => Math.random() - 0.5);
  
  // Asignar a rondas para que todos jueguen en cada ronda (si es posible)
  // Por ahora, simplemente retornar todos los partidos
  shuffledPairs.forEach((pair, idx) => {
    matches.push({
      team1: pair[0],
      team2: pair[1],
      winner: null,
      bye: false,
      round: idx
    });
  });
  
  return matches;
}

/**
 * Calcula clasificación de grupo basada en victorias
 * @param {Array} matches - Partidos del grupo
 * @param {Array} teamIds - IDs de equipos en el grupo
 * @returns {Array} - Equipos ordenados por puntuación
 */
function calculateStandings(matches, teamIds) {
  const standings = {};
  
  teamIds.forEach(id => {
    standings[id] = { teamId: id, wins: 0, losses: 0, draws: 0, points: 0 };
  });
  
  matches.forEach(match => {
    if (!match.winner) return;
    
    if (match.bye) {
      standings[match.team1].wins++;
      standings[match.team1].points += 3;
    } else if (match.team2 === null) {
      standings[match.team1].wins++;
      standings[match.team1].points += 3;
    } else {
      standings[match.winner].wins++;
      standings[match.winner].points += 3;
      
      const loser = match.winner === match.team1 ? match.team2 : match.team1;
      if (standings[loser]) {
        standings[loser].losses++;
      }
    }
  });
  
  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.wins - a.wins;
  });
}

/**
 * Calcula la estructura de grupos para modo Liga
 * @param {number} teamsCount - Total de equipos
 * @returns {Object} - Distribución de grupos
 */
function calculateLigaStructure(teamsCount) {
  if (teamsCount <= 5) {
    return {
      numGroups: 1,
      teamsPerGroup: teamsCount,
      needKnockout: teamsCount >= 4
    };
  } else {
    // 6-12 equipos: 2 grupos
    const group1Size = Math.floor(teamsCount / 2);
    const group2Size = teamsCount - group1Size;
    return {
      numGroups: 2,
      teamsPerGroup: [group1Size, group2Size],
      needKnockout: true
    };
  }
}

/**
 * Calcula la estructura de eliminación para modo Playoff
 * Usa potencia de 2 SUPERIOR para que todos tengan oportunidad
 * @param {number} teamsCount - Total de equipos
 * @returns {Object} - Configuración de byes y rondas
 */
function calculatePlayoffStructure(teamsCount) {
  // Usar potencia de 2 SUPERIOR (próxima)
  // 2 -> 2
  // 3-4 -> 4
  // 5-8 -> 8
  // 9-12 -> 16
  const nextPower = Math.pow(2, Math.ceil(Math.log2(teamsCount)));
  const byes = nextPower - teamsCount;
  
  // Determinar el número de rondas hasta la final
  const rounds = Math.ceil(Math.log2(nextPower));
  
  return {
    nextPower,
    byes,
    rounds
  };
}

/**
 * Distribuye equipos en grupos de manera equilibrada
 * @param {Array} teams - Equipos barajeados
 * @param {Array} groupSizes - Tamaños de cada grupo
 * @returns {Array} - Grupos de equipos
 */
function distributeTeamsToGroups(teams, groupSizes) {
  const groups = [];
  let teamIndex = 0;
  
  groupSizes.forEach(size => {
    const group = [];
    for (let i = 0; i < size; i++) {
      if (teamIndex < teams.length) {
        group.push(teams[teamIndex]);
        teamIndex++;
      }
    }
    groups.push(group);
  });
  
  return groups;
}

// ==================== GENERADORES DE BRACKET ====================

/**
 * Genera bracket para modo Liga
 * @param {Array} teams - Array de equipos
 * @param {number} teamsCount - Cantidad de equipos
 * @returns {Object} - Bracket completo
 */
function generateLigaBracket(teams, teamsCount) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5).slice(0, teamsCount);
  
  if (teamsCount < 2) {
    return {
      mode: 'liga',
      groupStage: { groups: [], matches: [], standings: [] },
      knockout: { rounds: [] },
      teams: shuffled,
      champion: shuffled[0] || null
    };
  }
  
  const structure = calculateLigaStructure(teamsCount);
  
  if (structure.numGroups === 1) {
    // === UN GRUPO (2-5 equipos) ===
    const groupTeams = shuffled.map(t => t.id);
    const groupMatches = generateSimpleRoundRobin(groupTeams);
    
    const standings = calculateStandings(groupMatches, groupTeams);
    
    // Si hay 4+ equipos, agregar semis + final
    let knockout = { rounds: [] };
    if (structure.needKnockout) {
      knockout.rounds.push([
        { team1: standings[0].teamId, team2: standings[3].teamId, winner: null, bye: false },
        { team1: standings[1].teamId, team2: standings[2].teamId, winner: null, bye: false }
      ]);
      knockout.rounds.push([
        { team1: null, team2: null, winner: null, bye: false }
      ]);
    } else {
      // Menos de 4 equipos - el líder es campeón
      return {
        mode: 'liga',
        groupStage: {
          groups: [{
            index: 0,
            name: 'Grupo Único',
            teams: groupTeams
          }],
          matches: groupMatches,
          standings: [standings]
        },
        knockout: { rounds: [] },
        teams: shuffled,
        champion: standings[0]?.teamId ? shuffled.find(t => t.id === standings[0].teamId) : null,
        config: { structure }
      };
    }
    
    return {
      mode: 'liga',
      groupStage: {
        groups: [{
          index: 0,
          name: 'Grupo Único',
          teams: groupTeams
        }],
        matches: groupMatches,
        standings: [standings]
      },
      knockout,
      teams: shuffled,
      config: { structure }
    };
    
  } else {
    // === DOS GRUPOS (6-12 equipos) ===
    const groupSizes = structure.teamsPerGroup;
    const groupedTeams = distributeTeamsToGroups(shuffled, groupSizes);
    
    const allGroupMatches = [];
    const allStandings = [];
    
    groupedTeams.forEach((group, groupIndex) => {
      const groupTeamIds = group.map(t => t.id);
      const groupMatches = generateSimpleRoundRobin(groupTeamIds);
      
      const finalGroupMatches = groupMatches.map(m => ({ ...m, groupIndex }));
      const standings = calculateStandings(finalGroupMatches, groupTeamIds);
      
      allGroupMatches.push(...finalGroupMatches);
      allStandings.push(standings);
    });
    
    // Cruces: 1º Grupo A vs 2º Grupo B, 1º Grupo B vs 2º Grupo A
    // SOLO si ambos equipos existen (sin byes)
    const groupAStandings = allStandings[0];
    const groupBStandings = allStandings[1];
    
    const knockoutRounds = [];
    
    // Semifinales: 1ºA vs 2ºB, 1ºB vs 2ºA
    const semiMatches = [];
    
    if (groupAStandings[0] && groupBStandings[1]) {
      semiMatches.push({
        team1: groupAStandings[0].teamId,
        team2: groupBStandings[1].teamId,
        winner: null,
        bye: false
      });
    }
    
    if (groupBStandings[0] && groupAStandings[1]) {
      semiMatches.push({
        team1: groupBStandings[0].teamId,
        team2: groupAStandings[1].teamId,
        winner: null,
        bye: false
      });
    }
    
    if (semiMatches.length > 0) {
      knockoutRounds.push(semiMatches);
    }
    
    // Final
    knockoutRounds.push([
      { team1: null, team2: null, winner: null, bye: false }
    ]);
    
    return {
      mode: 'liga',
      groupStage: {
        groups: groupedTeams.map((teams, i) => ({
          index: i,
          name: `Grupo ${String.fromCharCode(65 + i)}`,
          teams: teams.map(t => t.id)
        })),
        matches: allGroupMatches,
        standings: allStandings
      },
      knockout: { rounds: knockoutRounds },
      teams: shuffled,
      config: { structure }
    };
  }
}

/**
 * Genera bracket para modo Playoff
 * Estructura correcta según tabla:
 * | Equipos | Octavos | Cuartos | Semifinal | Final |
 * |---------|---------|---------|-----------|-------|
 * | 2 | - | - | 1 | - |
 * | 3 | - | - | 2 (1 bye) | 1 |
 * | 4 | - | - | 2 | 1 |
 * | 5 | - | 3 (1 bye) | 2 | 1 |
 * | 6 | - | 3 | 2 | 1 |
 * | 7 | - | 4 (1 bye) | 2 | 1 |
 * | 8 | - | 4 | 2 | 1 |
 * | 9 | 5 (1 bye) | 3 (1 bye) | 2 | 1 |
 * | 10 | 5 | 3 (1 bye) | 2 | 1 |
 * | 11 | 6 (1 bye) | 3 | 2 (1 bye) | 1 |
 * | 12 | 6 | 3 (2 bye) | 2 (1 bye) | 1 |
 */
function generatePlayoffBracket(teams, teamsCount) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5).slice(0, teamsCount);
  
  if (teamsCount < 2) {
    return { mode: 'playoff', knockout: { rounds: [] }, teams: shuffled, champion: shuffled[0] || null };
  }
  
  const teamIds = shuffled.map(t => t.id);
  const knockoutRounds = [];
  
  // Función auxiliar para crear partido
  function createMatch(t1, t2) {
    return { team1: t1, team2: t2, winner: null, bye: !t1 || !t2 };
  }
  
  // Crea una ronda y devuelve los equipos que tienen bye (pasan directo)
  // teamsList: lista de equipos para esta ronda
  // totalMatches: cantidad de partidos en esta ronda
  // byes: cantidad de equipos que pasan directo a siguiente ronda
  function createRound(teamsList, totalMatches, byes) {
    const matches = [];
    
    // Equipos que realmente juegan en esta ronda
    const playingTeams = teamsList.slice(0, teamsList.length - byes);
    // Equipos que tienen bye (pasan directo)
    const byeTeams = teamsList.slice(teamsList.length - byes);
    
    // Crear partidos entre equipos que juegan
    while (playingTeams.length >= 2) {
      matches.push(createMatch(playingTeams.shift(), playingTeams.shift()));
    }
    
    // Si queda 1 equipo sin par, tiene bye
    if (playingTeams.length === 1) {
      matches.push(createMatch(playingTeams.shift(), null));
    }
    
    // Llenar con placeholders para completar los partidos de esta ronda
    while (matches.length < totalMatches) {
      matches.push(createMatch(null, null));
    }
    
    return { matches, byeTeams };
  }
  
  // === 2 equipos: Semifinal (1 partido) ===
  if (teamsCount === 2) {
    const r1 = createRound(teamIds, 1, 0);
    knockoutRounds.push(r1.matches);
    // No hay final - el ganador es el campeón
  }
  
  // === 3 equipos: Semifinal (2 partidos, 1 bye) → Final (1) ===
  else if (teamsCount === 3) {
    const r1 = createRound(teamIds, 2, 1);
    knockoutRounds.push(r1.matches);
    const r2 = createRound(r1.byeTeams, 1, 0);
    knockoutRounds.push(r2.matches);
  }
  
  // === 4 equipos: Semifinal (2) → Final (1) ===
  else if (teamsCount === 4) {
    const r1 = createRound(teamIds, 2, 0);
    knockoutRounds.push(r1.matches);
    const r2 = createRound([], 1, 0);
    knockoutRounds.push(r2.matches);
  }
  
  // === 5 equipos: Cuartos (3 + 1 bye) → Semifinal (2) → Final (1) ===
  else if (teamsCount === 5) {
    const r1 = createRound(teamIds, 3, 1);
    knockoutRounds.push(r1.matches);
    const r2 = createRound(r1.byeTeams, 2, 0);
    knockoutRounds.push(r2.matches);
    const r3 = createRound([], 1, 0);
    knockoutRounds.push(r3.matches);
  }
  
  // === 6 equipos: Cuartos (3) → Semifinal (2) → Final (1) ===
  else if (teamsCount === 6) {
    const r1 = createRound(teamIds, 3, 0);
    knockoutRounds.push(r1.matches);
    const r2 = createRound([], 2, 0);
    knockoutRounds.push(r2.matches);
    const r3 = createRound([], 1, 0);
    knockoutRounds.push(r3.matches);
  }
  
  // === 7 equipos: Cuartos (4 + 1 bye) → Semifinal (2) → Final (1) ===
  else if (teamsCount === 7) {
    const r1 = createRound(teamIds, 4, 1);
    knockoutRounds.push(r1.matches);
    const r2 = createRound(r1.byeTeams, 2, 0);
    knockoutRounds.push(r2.matches);
    const r3 = createRound([], 1, 0);
    knockoutRounds.push(r3.matches);
  }
  
  // === 8 equipos: Cuartos (4) → Semifinal (2) → Final (1) ===
  else if (teamsCount === 8) {
    const r1 = createRound(teamIds, 4, 0);
    knockoutRounds.push(r1.matches);
    const r2 = createRound([], 2, 0);
    knockoutRounds.push(r2.matches);
    const r3 = createRound([], 1, 0);
    knockoutRounds.push(r3.matches);
  }
  
  // === 9 equipos: Octavos (5 + 1 bye) → Cuartos (3 + 1 bye) → Semifinal (2) → Final (1) ===
  else if (teamsCount === 9) {
    const r1 = createRound(teamIds, 5, 1);
    knockoutRounds.push(r1.matches);
    const r2 = createRound(r1.byeTeams, 3, 1);
    knockoutRounds.push(r2.matches);
    const r3 = createRound(r2.byeTeams, 2, 0);
    knockoutRounds.push(r3.matches);
    const r4 = createRound([], 1, 0);
    knockoutRounds.push(r4.matches);
  }
  
  // === 10 equipos: Octavos (5) → Cuartos (3 + 1 bye) → Semifinal (2) → Final (1) ===
  else if (teamsCount === 10) {
    const r1 = createRound(teamIds, 5, 0);
    knockoutRounds.push(r1.matches);
    const r2 = createRound(r1.byeTeams, 3, 1);
    knockoutRounds.push(r2.matches);
    const r3 = createRound(r2.byeTeams, 2, 0);
    knockoutRounds.push(r3.matches);
    const r4 = createRound([], 1, 0);
    knockoutRounds.push(r4.matches);
  }
  
  // === 11 equipos: Octavos (6 + 1 bye) → Cuartos (3) → Semifinal (2 + 1 bye) → Final (1) ===
  else if (teamsCount === 11) {
    const r1 = createRound(teamIds, 6, 1);
    knockoutRounds.push(r1.matches);
    const r2 = createRound(r1.byeTeams, 3, 0);
    knockoutRounds.push(r2.matches);
    const r3 = createRound(r2.byeTeams, 2, 1);
    knockoutRounds.push(r3.matches);
    const r4 = createRound(r3.byeTeams, 1, 0);
    knockoutRounds.push(r4.matches);
  }
  
  // === 12 equipos: Octavos (6) → Cuartos (3 + 2 bye) → Semifinal (2 + 1 bye) → Final (1) ===
  else { // 12
    const r1 = createRound(teamIds, 6, 0);
    knockoutRounds.push(r1.matches);
    const r2 = createRound(r1.byeTeams, 3, 2);
    knockoutRounds.push(r2.matches);
    const r3 = createRound(r2.byeTeams, 2, 1);
    knockoutRounds.push(r3.matches);
    const r4 = createRound(r3.byeTeams, 1, 0);
    knockoutRounds.push(r4.matches);
  }
  
  return { mode: 'playoff', knockout: { rounds: knockoutRounds }, teams: shuffled, config: { teamsCount } };
}

// ==================== HANDLERS ====================

/**
 * Genera el bracket completo según modo de juego
 */
function generateBracket(teams, config) {
  const { teamsCount, gameMode } = config;
  
  if (gameMode === 'liga') {
    return generateLigaBracket(teams, teamsCount);
  } else {
    return generatePlayoffBracket(teams, teamsCount);
  }
}

/**
 * Procesa un partido y avanza a siguiente ronda
 */
function processMatch(bracket, stage, roundIndex, matchIndex, winnerTeamId) {
  if (stage === 'group') {
    const matches = bracket.groupStage.matches;
    const match = matches[matchIndex];
    
    if (!match || match.bye) return bracket;
    
    match.winner = winnerTeamId;
    
    const groupIndex = match.groupIndex;
    const groupTeams = bracket.groupStage.groups[groupIndex].teams;
    const groupMatches = matches.filter(m => m.groupIndex === groupIndex);
    bracket.groupStage.standings[groupIndex] = calculateStandings(groupMatches, groupTeams);
    
    // Verificar si todos los grupos están completos
    const allComplete = bracket.groupStage.groups.every((group, gi) => {
      const gMatches = matches.filter(m => m.groupIndex === gi);
      return gMatches.every(m => m.winner !== null);
    });
    
    if (allComplete) {
      bracket.state = 'knockout';
      
      // Si hay knockout y la primera ronda no tiene winners, prepararla
      if (bracket.knockout.rounds.length > 0) {
        const lastRound = bracket.knockout.rounds[bracket.knockout.rounds.length - 1];
        const winners = lastRound.filter(m => m.winner).map(m => m.winner);
        
        if (winners.length === 2 && bracket.knockout.rounds.length === 2) {
          // Ya tenemos semis con winners, preparar final
          bracket.knockout.rounds[1][0].team1 = winners[0];
          bracket.knockout.rounds[1][0].team2 = winners[1];
        }
      }
    }
    
  } else {
    const rounds = bracket.knockout.rounds;
    const round = rounds[roundIndex];
    const match = round[matchIndex];
    
    if (!match) return bracket;
    
    // Si hay bye (team2: null), el winner es el equipo que existe
    // El host debe confirmar manualmente en el UI
    // Por ahora, si hay bye, el equipo avanza automáticamente
    // Pero en las rondas de semifinal y final, siempre debe haber 2 equipos
    
    if (match.team1 && !match.team2) {
      // Equipo con bye - avanza automáticamente a la siguiente ronda
      match.winner = match.team1;
      match.bye = true;
    } else if (!match.team1 && match.team2) {
      match.winner = match.team2;
      match.bye = true;
    } else if (match.team1 && match.team2) {
      match.winner = winnerTeamId;
    }
    
    // Avanzar a siguiente ronda SOLO si hay winner
    if (!match.winner) return bracket;
    
    const isLastRound = roundIndex === rounds.length - 1;
    
    if (isLastRound) {
      // Es la última ronda (final) - el winner es el campeón
      bracket.champion = bracket.teams.find(t => t.id === match.winner);
      bracket.state = 'finished';
    } else {
      // Avanzar winner a la siguiente ronda
      const nextRoundIndex = roundIndex + 1;
      
      // Crear siguiente ronda si no existe
      if (!rounds[nextRoundIndex]) {
        const nextMatchCount = Math.ceil(round.length / 2);
        const nextRound = [];
        for (let i = 0; i < nextMatchCount; i++) {
          nextRound.push({ team1: null, team2: null, winner: null, bye: false });
        }
        rounds.push(nextRound);
      }
      
      // Asignar winner al siguiente partido
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const nextMatch = rounds[nextRoundIndex][nextMatchIndex];
      const nextSlot = matchIndex % 2 === 0 ? 'team1' : 'team2';
      
      nextMatch[nextSlot] = match.winner;
      
      // Verificar si el siguiente partido ya tiene ambos equipos (para pasar al siguiente)
      // Esto permite que cuando hay varios partidos en una ronda, cada winner vaya a su partido
    }
  }
  
  return bracket;
}

// ==================== SOCKET HANDLERS ====================

export function setupBeerpongSocketHandlers(io, socket, bepongRooms) {
  
  socket.on('beerpong-create', (data, callback) => {
    const { teamsCount, playersPerTeam, gameMode, playerName } = data;
    const roomId = generateRoomCode(bepongRooms);
    
    console.log('=== beerpong-create ===', { roomId, teamsCount, playersPerTeam, gameMode, socketId: socket.id });
    
    const bepongRoom = {
      id: roomId,
      host: socket.id,
      gameType: 'beerpong',
      config: { teamsCount, playersPerTeam, gameMode: gameMode || 'liga' },
      teams: [],
      state: 'setup',
      bracket: {
        mode: gameMode || 'liga',
        groupStage: { groups: [], matches: [], standings: [] },
        knockout: { rounds: [] },
        teams: []
      },
      champion: null,
      createdAt: Date.now(),
      // Timer por partido
      matchTimer: {
        matchId: null,
        matchLabel: '',
        duration: 600, // 10 minutos por defecto (en segundos)
        remaining: 600,
        isRunning: false,
        startedAt: null,
        intervalId: null
      }
    };
    
    bepongRooms.set(roomId, bepongRoom);
    
    console.log('Sala beerpong creada:', roomId);
    callback({ success: true, roomId, room: bepongRoom });
  });

  socket.on('beerpong-add-team', (data, callback) => {
    const { roomId, teamName, players } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    // Cualquier jugador puede añadir equipos (no solo el host)
    if (room.state !== 'setup') {
      callback({ success: false, error: 'El torneo ya ha comenzado' });
      return;
    }
    
    if (room.teams.length >= room.config.teamsCount) {
      callback({ success: false, error: 'Máximo de equipos alcanzado' });
      return;
    }
    
    const team = {
      id: room.teams.length + 1,
      name: teamName,
      players: players
    };
    
    room.teams.push(team);
    
    io.emit('beerpong-teams-updated', {
      roomId: room.id,
      teams: room.teams
    });
    
    callback({ success: true, teams: room.teams });
  });

  socket.on('beerpong-start', (data, callback) => {
    const { roomId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    // Cualquier jugador puede iniciar el torneo (no solo el host)
    if (room.teams.length !== room.config.teamsCount) {
      callback({ success: false, error: `Necesitas ${room.config.teamsCount} equipos` });
      return;
    }
    
    const bracketConfig = {
      teamsCount: room.config.teamsCount,
      gameMode: room.config.gameMode
    };
    
    room.bracket = generateBracket(room.teams, bracketConfig);
    
    if (room.bracket.mode === 'playoff') {
      room.state = 'knockout';
    } else {
      // Liga: primero grupo, luego knockout
      if (room.bracket.knockout.rounds.length > 0) {
        room.state = 'group';
      } else {
        // Solo grupo (2-3 equipos) - campeón directo
        room.champion = room.bracket.champion;
        room.state = 'finished';
      }
    }
    
    if (room.teams.length === 1) {
      room.champion = room.teams[0];
      room.state = 'finished';
    }

    console.log('Bracket generado:', room.id, { config: bracketConfig, state: room.state });

    callback({ success: true, bracket: room.bracket, state: room.state });

    io.emit('beerpong-bracket-updated', {
      roomId: room.id,
      bracket: room.bracket,
      champion: room.champion,
      state: room.state
    });
  });

  socket.on('beerpong-set-winner', (data, callback) => {
    const { roomId, stage, roundIndex, matchIndex, winnerTeamId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    // Cualquier jugador puede seleccionar ganadores (no solo el host)
    room.bracket = processMatch(room.bracket, stage, roundIndex, matchIndex, winnerTeamId);
    
    if (room.bracket.champion) {
      room.state = 'finished';
    } else if (room.bracket.state === 'knockout' && room.state === 'group') {
      room.state = 'knockout';
    }

    callback({ success: true, bracket: room.bracket, state: room.state });
    
    io.emit('beerpong-bracket-updated', {
      roomId: room.id,
      bracket: room.bracket,
      champion: room.champion,
      state: room.state
    });
  });

  socket.on('beerpong-get-room', (data, callback) => {
    const { roomId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room) {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    callback({ success: true, room });
  });

  // ===== TIMER HANDLERS =====

  // Configurar duración del timer (en cualquier momento)
  socket.on('beerpong-set-timer-duration', (data, callback) => {
    const { roomId, duration } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    // duration en minutos (1-60), convertir a segundos
    const seconds = Math.max(60, Math.min(3600, duration * 60));
    room.matchTimer.duration = seconds;
    
    // Si el timer no está corriendo, actualizar remaining también
    if (!room.matchTimer.isRunning) {
      room.matchTimer.remaining = seconds;
    }
    
    callback({ success: true, timer: getCleanTimer(room.matchTimer) });
    
    io.emit('beerpong-timer-sync', {
      roomId: room.id,
      timer: getCleanTimer(room.matchTimer)
    });
  });

  // Iniciar timer para un match específico
  socket.on('beerpong-start-timer', (data, callback) => {
    const { roomId, matchId, matchLabel } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    // Limpiar intervalo anterior si existe
    if (room.matchTimer.intervalId) {
      clearInterval(room.matchTimer.intervalId);
    }
    
    // Iniciar nuevo timer
    room.matchTimer.matchId = matchId;
    room.matchTimer.matchLabel = matchLabel || '';
    room.matchTimer.remaining = room.matchTimer.duration;
    room.matchTimer.isRunning = true;
    room.matchTimer.startedAt = Date.now();
    
    // Crear intervalo para countdown
    room.matchTimer.intervalId = setInterval(() => {
      room.matchTimer.remaining -= 1;
      
      if (room.matchTimer.remaining <= 0) {
        // Timer llegó a 0 - detener
        room.matchTimer.remaining = 0;
        room.matchTimer.isRunning = false;
        if (room.matchTimer.intervalId) {
          clearInterval(room.matchTimer.intervalId);
          room.matchTimer.intervalId = null;
        }
        
        // Emitir evento de timer finished
        io.emit('beerpong-timer-finished', {
          roomId: room.id,
          matchId: room.matchTimer.matchId,
          matchLabel: room.matchTimer.matchLabel
        });
      }
      
      // Broadcast sync cada segundo
      io.emit('beerpong-timer-sync', {
        roomId: room.id,
        timer: getCleanTimer(room.matchTimer)
      });
    }, 1000);
    
    callback({ success: true, timer: getCleanTimer(room.matchTimer) });
    
    io.emit('beerpong-timer-sync', {
      roomId: room.id,
      timer: getCleanTimer(room.matchTimer)
    });
  });

  // Pausar timer
  socket.on('beerpong-pause-timer', (data, callback) => {
    const { roomId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    if (!room.matchTimer.isRunning) {
      callback({ success: false, error: 'El timer no está corriendo' });
      return;
    }
    
    room.matchTimer.isRunning = false;
    if (room.matchTimer.intervalId) {
      clearInterval(room.matchTimer.intervalId);
      room.matchTimer.intervalId = null;
    }
    
    callback({ success: true, timer: getCleanTimer(room.matchTimer) });
    
    io.emit('beerpong-timer-sync', {
      roomId: room.id,
      timer: getCleanTimer(room.matchTimer)
    });
  });

  // Reanudar timer
  socket.on('beerpong-resume-timer', (data, callback) => {
    const { roomId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    if (room.matchTimer.isRunning || room.matchTimer.remaining <= 0) {
      callback({ success: false, error: 'El timer no puede ser reanudado' });
      return;
    }
    
    room.matchTimer.isRunning = true;
    room.matchTimer.startedAt = Date.now();
    
    // Crear nuevo intervalo
    room.matchTimer.intervalId = setInterval(() => {
      room.matchTimer.remaining -= 1;
      
      if (room.matchTimer.remaining <= 0) {
        room.matchTimer.remaining = 0;
        room.matchTimer.isRunning = false;
        if (room.matchTimer.intervalId) {
          clearInterval(room.matchTimer.intervalId);
          room.matchTimer.intervalId = null;
        }
        
        io.emit('beerpong-timer-finished', {
          roomId: room.id,
          matchId: room.matchTimer.matchId,
          matchLabel: room.matchTimer.matchLabel
        });
      }
      
      io.emit('beerpong-timer-sync', {
        roomId: room.id,
        timer: getCleanTimer(room.matchTimer)
      });
    }, 1000);
    
    callback({ success: true, timer: getCleanTimer(room.matchTimer) });
    
    io.emit('beerpong-timer-sync', {
      roomId: room.id,
      timer: getCleanTimer(room.matchTimer)
    });
  });

  // Obtener estado actual del timer
  socket.on('beerpong-get-timer', (data, callback) => {
    const { roomId } = data;
    const room = bepongRooms.get(roomId.toUpperCase());
    
    if (!room || room.gameType !== 'beerpong') {
      callback({ success: false, error: 'Sala no encontrada' });
      return;
    }
    
    callback({ success: true, timer: getCleanTimer(room.matchTimer) });
  });
}

export default { setupBeerpongSocketHandlers, generateBracket };