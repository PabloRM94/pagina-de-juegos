// TimeUp New - Game Engine (Servidor)
// Juego de adivinanzas por equipos con asignación MANUAL de equipos

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
 * Crea el estado inicial de TimeUp New
 */
export function createTimesUpNewState(teamCount, withSounds = false) {
  return {
    state: 'lobby',  // lobby, teams, team-names, words, playing, round-end, finished
    config: {
      teamCount,
      withSounds,
      totalRounds: withSounds ? 4 : 3,
      wordsPerPlayer: { min: 3, max: 10 }
    },
    teams: [],  // [{ id, name, captainId, players: [], score: 0 }]
    allWords: [],
    shuffledWords: [],
    playerWords: {},  // { socketId: ['pal1', 'pal2'] }
    playersReady: {},  // { socketId: true }
    captainsReady: [],  // socketIds de capitanes que nombraron equipo
    
    // Estado de juego
    currentRound: 1,
    currentTeamTurn: 0,
    currentPlayerIndex: 0,
    wordsUsed: [],  // Palabras adivinadas en esta ronda
    wordsSeen: [],  // Palabras vistas (skip) en esta ronda
    roundScores: {},  // { 1: {0: 0, 1: 0}, 2: {...} }
    turnActive: false,
    currentWord: null,
    startingTeam: 0,
    
    // Configuración de cada ronda
    roundConfig: { ...DEFAULT_ROUND_CONFIG }
  };
}

/**
 * Asigna jugadores a equipos MANualmente (desde el host)
 * @param {Array} teams - Equipos con estructura { id, name, players: [socketIds] }
 * @returns {Array} - Equipos con captainId asignado (primer jugador)
 */
export function assignCaptainsToTeams(teams) {
  return teams.map(team => ({
    ...team,
    captainId: team.players.length > 0 ? team.players[0] : null
  }));
}

/**
 * Obtiene la palabra actual
 */
export function getCurrentWord(timesupState) {
  // Buscar palabra que NO esté usada NI vista
  for (let i = 0; i < timesupState.shuffledWords.length; i++) {
    if (!timesupState.wordsUsed.includes(i) && !timesupState.wordsSeen.includes(i)) {
      return timesupState.shuffledWords[i];
    }
  }
  
  // Segunda pasada: cualquier palabra no usada
  for (let i = 0; i < timesupState.shuffledWords.length; i++) {
    if (!timesupState.wordsUsed.includes(i)) {
      return timesupState.shuffledWords[i];
    }
  }
  
  return null;
}

/**
 * Obtiene la siguiente palabra
 */
function getNextWord(timesupState) {
  return getCurrentWord(timesupState);
}

/**
 * Marca una palabra como adivinada (correcto)
 */
export function markWordGuessed(timesupState, word) {
  const wordIndex = timesupState.shuffledWords.indexOf(word);
  const teamId = timesupState.currentTeamTurn;
  
  if (wordIndex === -1 || timesupState.wordsUsed.includes(wordIndex)) {
    return timesupState;
  }
  
  timesupState.wordsUsed.push(wordIndex);
  timesupState.teams[teamId].score += 1;
  
  // Inicializar roundScores
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
 * Marca una palabra como vista (skip)
 */
export function markWordSeen(timesupState, word) {
  const wordIndex = timesupState.shuffledWords.indexOf(word);
  
  if (wordIndex === -1) return timesupState;
  
  if (!timesupState.wordsSeen.includes(wordIndex)) {
    timesupState.wordsSeen.push(wordIndex);
  }
  
  return timesupState;
}

/**
 * Obtiene palabras restantes
 */
export function getRemainingWordsCount(timesupState) {
  return timesupState.shuffledWords.length - timesupState.wordsUsed.length;
}

/**
 * Inicia un turno
 */
export function startTurn(timesupState) {
  const team = timesupState.teams[timesupState.currentTeamTurn];
  if (!team || team.players.length === 0) {
    return { ...timesupState, turnActive: false, currentWord: null };
  }
  
  const currentWord = getCurrentWord(timesupState);
  
  return {
    ...timesupState,
    turnActive: true,
    currentWord,
    currentPlayerIndex: 0
  };
}

/**
 * Pasa al siguiente equipo
 */
export function nextTeamTurn(timesupState) {
  timesupState.currentTeamTurn = (timesupState.currentTeamTurn + 1) % timesupState.config.teamCount;
  timesupState.currentPlayerIndex = 0;
  timesupState.turnActive = false;
  timesupState.currentWord = null;
  
  return timesupState;
}

/**
 * Pasa al siguiente jugador dentro del equipo
 */
export function nextPlayerInTeam(timesupState) {
  const team = timesupState.teams[timesupState.currentTeamTurn];
  if (!team || team.players.length === 0) return timesupState;
  
  timesupState.currentPlayerIndex = (timesupState.currentPlayerIndex + 1) % team.players.length;
  timesupState.turnActive = false;
  
  return timesupState;
}

/**
 * Termina el turno
 */
export function endTurn(timesupState) {
  timesupState.turnActive = false;
  timesupState.currentWord = null;
  return timesupState;
}

/**
 * Inicia una nueva ronda
 */
export function startNewRound(timesupState) {
  timesupState.currentRound += 1;
  timesupState.currentTeamTurn = 0;
  timesupState.currentPlayerIndex = 0;
  timesupState.wordsUsed = [];
  timesupState.wordsSeen = [];
  timesupState.turnActive = false;
  timesupState.currentWord = null;
  
  // Mezclar palabras nuevamente
  timesupState.shuffledWords = shuffleArray(timesupState.allWords);
  
  // Alternar equipo inicial
  timesupState.startingTeam = (timesupState.startingTeam + 1) % timesupState.config.teamCount;
  timesupState.currentTeamTurn = timesupState.startingTeam;
  
  return timesupState;
}

/**
 * Termina la ronda actual
 */
export function endRound(timesupState) {
  const isLastRound = timesupState.currentRound >= timesupState.config.totalRounds;
  timesupState.state = isLastRound ? 'finished' : 'round-end';
  timesupState.turnActive = false;
  
  return timesupState;
}

/**
 * Obtiene la clasificación
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
 * Obtiene el equipo ganador
 */
export function getWinner(timesupState) {
  const leaderboard = getLeaderboard(timesupState);
  if (leaderboard.length === 0) return null;
  
  const maxScore = leaderboard[0].score;
  const winners = leaderboard.filter(t => t.score === maxScore);
  
  if (winners.length === 1) {
    return timesupState.teams[winners[0].teamId];
  }
  
  return timesupState.teams[winners[0].teamId];
}

/**
 * Obtiene la configuración de una ronda
 */
export function getRoundConfig(timesupState, roundNumber) {
  return timesupState.roundConfig[roundNumber] || DEFAULT_ROUND_CONFIG[roundNumber];
}

/**
 * Actualiza la configuración de una ronda
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

/**
 * Obtiene el jugador actual que debe describir
 */
export function getCurrentPlayer(timesupState) {
  const team = timesupState.teams[timesupState.currentTeamTurn];
  if (!team || team.players.length === 0) return null;
  
  return team.players[timesupState.currentPlayerIndex];
}

export default {
  ROUND_TIMES,
  ROUND_NAMES,
  DEFAULT_ROUND_CONFIG,
  shuffleArray,
  createTimesUpNewState,
  assignCaptainsToTeams,
  getCurrentWord,
  markWordGuessed,
  markWordSeen,
  getRemainingWordsCount,
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
  getCurrentPlayer
};
