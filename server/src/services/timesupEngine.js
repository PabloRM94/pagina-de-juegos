// Time's Up! - Game Engine
// Juego de adivinanzas por equipos en 3-4 rondas

// Tiempos por ronda (en milisegundos)
export const ROUND_TIMES = {
  1: 60000,  // Descripción libre: 60s
  2: 60000,  // Una palabra: 60s
  3: 80000,  // Mímica: 80s
  4: 80000   // Sonidos: 80s
};

// Nombres de rondas
export const ROUND_NAMES = {
  1: 'Descripción Libre',
  2: 'Una Palabra',
  3: 'Mímica',
  4: 'Sonidos'
};

// Configuración por defecto de cada ronda
export const DEFAULT_ROUND_CONFIG = {
  1: { timePerTurn: 60000, failPassesTurn: false, allowSkip: true },
  2: { timePerTurn: 60000, failPassesTurn: true, allowSkip: true },
  3: { timePerTurn: 80000, failPassesTurn: true, allowSkip: true },
  4: { timePerTurn: 80000, failPassesTurn: true, allowSkip: false }
};

/**
 * Mezcla un array de palabras aleatoriamente (Fisher-Yates)
 * @param {Array} array - Array a mezclar
 * @returns {Array} - Array mezclado
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Crea el estado inicial de Time's Up para una sala
 * @param {number} teamCount - Número de equipos (2-4)
 * @param {boolean} withSounds - Si incluye ronda 4
 * @returns {object} - Estado inicial de timesup
 */
export function createTimesUpState(teamCount, withSounds = false) {
  return {
    state: 'lobby',  // lobby, team-names, words, playing, round-end, finished
    config: {
      teamCount,
      withSounds,
      totalRounds: withSounds ? 4 : 3,
      wordsPerPlayer: { min: 3, max: 10 }
    },
    teams: [],  // [{ id, name, captainId, players: [], score: 0 }]
    allWords: [],  // Pool de palabras (sin mezclar) - mismo para todas las rondas
    shuffledWords: [],  // Palabras mezcladas para la ronda actual
    playerWords: {},  // { socketId: ['pal1', 'pal2'] }
    playersReady: {},  // { socketId: true } - quien envió palabras
    captainsReady: [],  // socketIds de capitanes que nombraron equipo
    
    // Estado de juego
    currentRound: 1,
    currentTeamTurn: 0,  // Índice del equipo que tiene el turno
    currentPlayerIndex: 0,  // Índice del jugador dentro del equipo que describe
    wordsUsed: [],  // [wordIndex1, wordIndex2, ...] - palabras adivinadas en esta ronda
    wordsSeen: [],  // [wordIndex1, ...] - palabras vistas (skip) en esta ronda
    roundScores: {},  // { 1: {0: 0, 1: 0}, 2: {...} }
    currentTurnTimer: null,
    turnActive: false,
    currentDescribePlayer: null,  // socketId del jugador que describe
    startingTeam: 0,  // Equipo que inicia la ronda
    
    // Configuracion de cada ronda (puede ser editada por el host)
    roundConfig: {
      1: { timePerTurn: 60000, failPassesTurn: false, allowSkip: true },
      2: { timePerTurn: 60000, failPassesTurn: true, allowSkip: true },
      3: { timePerTurn: 80000, failPassesTurn: true, allowSkip: true },
      4: { timePerTurn: 80000, failPassesTurn: true, allowSkip: false }
    }
  };
}

/**
 * Asigna capitanes aleatorios a cada equipo
 * @param {Array} players - Array de jugadores
 * @param {number} teamCount - Número de equipos
 * @returns {Array} - Equipos con capitanes asignados
 */
export function assignCaptains(players, teamCount) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const teams = [];
  
  // Crear equipos vacíos
  for (let i = 0; i < teamCount; i++) {
    teams.push({
      id: i,
      name: `Equipo ${i + 1}`,
      captainId: null,
      players: [],
      score: 0
    });
  }
  
  // Asignar capitanes (primeros players como capitanes)
  for (let i = 0; i < teamCount && i < shuffled.length; i++) {
    teams[i].captainId = shuffled[i].id;
    teams[i].players.push(shuffled[i].id);
  }
  
  // Asignar demás jugadores al primer equipo disponible
  for (let i = teamCount; i < shuffled.length; i++) {
    const teamIndex = (i - teamCount) % teamCount;
    if (!teams[teamIndex].players.includes(shuffled[i].id)) {
      teams[teamIndex].players.push(shuffled[i].id);
    }
  }

  return teams;
}

/**
 * Mezcla las palabras del pool común
 * @param {Array} allWords - Todas las palabras
 * @returns {Array} - Palabras mezcladas
 */
export function setupWords(allWords) {
  return shuffleArray(allWords);
}

/**
 * Obtiene el jugador que debe describir en el turno actual
 * @param {object} timesupState - Estado de timesup
 * @returns {string|null} - socketId del jugador que describe
 */
export function getCurrentDescribePlayer(timesupState) {
  const team = timesupState.teams[timesupState.currentTeamTurn];
  if (!team || team.players.length === 0) return null;
  
  const playerId = team.players[timesupState.currentPlayerIndex];
  return playerId || null;
}

/**
 * Obtiene la palabra actual del pool común
 * - No puede ser una palabra ya adivinada (wordsUsed)
 * - Evita mostrar palabras recently vistas (wordsSeen) para no repetir inmediatamente
 * @param {object} timesupState - Estado de timesup
 * @param {number} [avoidIndex] - Índice de palabra a evitar (la última vista)
 * @returns {string|null} - Palabra actual
 */
export function getCurrentWord(timesupState, avoidIndex = -1) {
  // Primera pasada: buscar palabra que NO esté usada NI recientemente vista
  for (let i = 0; i < timesupState.shuffledWords.length; i++) {
    if (i === avoidIndex) continue; // Evitar la palabra que queremos skippear
    if (!timesupState.wordsUsed.includes(i) && !timesupState.wordsSeen.includes(i)) {
      return timesupState.shuffledWords[i];
    }
  }
  
  // Segunda pasada: si no hay, buscar cualquier palabra no usada
  // (puede incluir wordsSeen, pero no la misma que evitamos)
  for (let i = 0; i < timesupState.shuffledWords.length; i++) {
    if (i === avoidIndex) continue;
    if (!timesupState.wordsUsed.includes(i)) {
      return timesupState.shuffledWords[i];
    }
  }
  
  return null;
}

/**
 * Obtiene las palabras restantes (para mostrar al cliente)
 * @param {object} timesupState - Estado de timesup
 * @returns {number} - Cantidad de palabras restantes
 */
export function getRemainingWordsCount(timesupState) {
  return timesupState.shuffledWords.length - timesupState.wordsUsed.length;
}

/**
 * Verifica si TODAS las palabras fueron adivinadas
 * @param {object} timesupState - Estado de timesup
 * @returns {boolean}
 */
export function areAllWordsGuessed(timesupState) {
  return timesupState.wordsUsed.length >= timesupState.shuffledWords.length;
}

/**
 * Marca una palabra como adivinada (correcto)
 * @param {object} timesupState - Estado de timesup
 * @param {string} word - Palabra adivinada
 * @returns {object} - Estado actualizado
 */
export function markWordGuessed(timesupState, word) {
  const wordIndex = timesupState.shuffledWords.indexOf(word);
  const teamId = timesupState.currentTeamTurn;
  
  // Solo agregar si no está ya usada
  if (wordIndex === -1 || timesupState.wordsUsed.includes(wordIndex)) {
    return timesupState;
  }
  
  timesupState.wordsUsed.push(wordIndex);
  timesupState.teams[teamId].score += 1;
  
  // Inicializar roundScores si no existe
  if (!timesupState.roundScores[timesupState.currentRound]) {
    timesupState.roundScores[timesupState.currentRound] = {};
    for (let i = 0; i < timesupState.config.teamCount; i++) {
      timesupState.roundScores[timesupState.currentRound][i] = 0;
    }
  }
  timesupState.roundScores[timesupState.currentRound][teamId] += 1;
  
  return timesupState;
}

/**
 * Marca una palabra como vista (skip) - no cuenta como adivinada
 * @param {object} timesupState - Estado de timesup
 * @param {string} word - Palabra saltada
 * @returns {object} - Estado actualizado
 */
export function markWordSeen(timesupState, word) {
  const wordIndex = timesupState.shuffledWords.indexOf(word);
  
  if (wordIndex === -1) return timesupState;
  
  // Agregar a wordsSeen solo si no está ya
  if (!timesupState.wordsSeen.includes(wordIndex)) {
    timesupState.wordsSeen.push(wordIndex);
  }
  
  return timesupState;
}

/**
 * Pasa al siguiente turno (equipo)
 * @param {object} timesupState - Estado de timesup
 * @returns {object} - Estado actualizado
 */
export function nextTeamTurn(timesupState) {
  const teamCount = timesupState.config.teamCount;
  timesupState.currentTeamTurn = (timesupState.currentTeamTurn + 1) % teamCount;
  timesupState.currentPlayerIndex = 0;
  timesupState.turnActive = false;
  
  return timesupState;
}

/**
 * Pasa al siguiente jugador dentro del mismo equipo
 * @param {object} timesupState - Estado de timesup
 * @returns {object} - Estado actualizado
 */
export function nextPlayerInTeam(timesupState) {
  const team = timesupState.teams[timesupState.currentTeamTurn];
  if (!team || team.players.length === 0) return timesupState;
  
  timesupState.currentPlayerIndex = 
    (timesupState.currentPlayerIndex + 1) % team.players.length;
  timesupState.turnActive = false;
  
  return timesupState;
}

/**
 * Inicia una nueva ronda - resetea palabras y alterna equipo inicial
 * @param {object} timesupState - Estado de timesup
 * @returns {object} - Estado actualizado
 */
export function startNewRound(timesupState) {
  timesupState.currentRound += 1;
  timesupState.currentTeamTurn = 0;
  timesupState.currentPlayerIndex = 0;
  timesupState.wordsUsed = [];  // Resetear palabras usadas
  timesupState.wordsSeen = [];  // Resetear palabras vistas
  timesupState.turnActive = false;
  timesupState.currentDescribePlayer = null;
  
  // Mezclar palabras nuevamente para la nueva ronda
  timesupState.shuffledWords = setupWords(timesupState.allWords);
  
  // Alternar equipo inicial (el que NO empezó la ronda anterior)
  timesupState.startingTeam = (timesupState.startingTeam + 1) % timesupState.config.teamCount;
  timesupState.currentTeamTurn = timesupState.startingTeam;
  
  return timesupState;
}

/**
 * Obtiene el equipo que inicia la ronda actual
 * @param {object} timesupState - Estado de timesup
 * @returns {number} - Índice del equipo
 */
export function getStartingTeam(timesupState) {
  return timesupState.startingTeam;
}

/**
 * Obtiene la clasificación actual por equipos
 * @param {object} timesupState - Estado de timesup
 * @returns {Array} - Array de { teamId, teamName, score, roundScores }
 */
export function getLeaderboard(timesupState) {
  return timesupState.teams
    .map((team, index) => ({
      teamId: index,
      teamName: team.name,
      score: team.score,
      roundScores: timesupState.roundScores
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Determina el equipo ganador
 * @param {object} timesupState - Estado de timesup
 * @returns {object|null} - Equipo ganador o null
 */
export function getWinner(timesupState) {
  const leaderboard = getLeaderboard(timesupState);
  if (leaderboard.length === 0) return null;
  
  const maxScore = leaderboard[0].score;
  const winners = leaderboard.filter(t => t.score === maxScore);
  
  if (winners.length === 1) {
    return timesupState.teams[winners[0].teamId];
  }
  
  // Empate - retornar primero
  return timesupState.teams[winners[0].teamId];
}

/**
 * Obtiene la configuración de una ronda específica
 * @param {object} timesupState - Estado de timesup
 * @param {number} roundNumber - Número de ronda (1-4)
 * @returns {object} - Configuración de la ronda
 */
export function getRoundConfig(timesupState, roundNumber) {
  return timesupState.roundConfig[roundNumber] || {
    timePerTurn: 60000,
    failPassesTurn: false,
    allowSkip: true
  };
}

/**
 * Actualiza la configuración de una ronda
 * @param {object} timesupState - Estado de timesup
 * @param {number} roundNumber - Número de ronda (1-4)
 * @param {object} config - Nueva configuración { timePerTurn, failPassesTurn, allowSkip }
 * @returns {object} - Estado actualizado
 */
export function updateRoundConfig(timesupState, roundNumber, config) {
  if (timesupState.roundConfig[roundNumber]) {
    timesupState.roundConfig[roundNumber] = {
      ...timesupState.roundConfig[roundNumber],
      ...config
    };
  }
  return timesupState;
}

export default {
  ROUND_TIMES,
  ROUND_NAMES,
  DEFAULT_ROUND_CONFIG,
  shuffleArray,
  createTimesUpState,
  assignCaptains,
  setupWords,
  getCurrentDescribePlayer,
  getCurrentWord,
  getRemainingWordsCount,
  areAllWordsGuessed,
  markWordGuessed,
  markWordSeen,
  nextTeamTurn,
  nextPlayerInTeam,
  startNewRound,
  getStartingTeam,
  getLeaderboard,
  getWinner,
  getRoundConfig,
  updateRoundConfig
};
