// TimeUp New - Motor del juego local
// Toda la lógica del juego corre en el cliente sin servidor

// Tiempos por ronda (en milisegundos)
export const ROUND_TIMES = {
  1: 60000,  // Descripción Libre: 60s
  2: 60000,  // Una Palabra: 60s
  3: 80000,  // Mímica: 80s
  4: 80000    // Sonidos: 80s
};

// Nombres de rondas
export const ROUND_NAMES = {
  1: 'Descripción Libre',
  2: 'Una Palabra',
  3: 'Mímica',
  4: 'Sonidos'
};

// Banco de 50 palabras por defecto
export const DEFAULT_WORD_BANK = [
  // Animales (10)
  'perro', 'gato', 'león', 'elefante', 'jirafa',
  'mono', 'pájaro', 'pez', 'caballo', 'vaca',
  // Objetos (10)
  'silla', 'mesa', 'teléfono', 'reloj', 'cama',
  'lámpara', 'ventana', 'puerta', 'coche', 'libro',
  // Comidas (10)
  'pizza', 'pasta', 'arroz', 'hamburguesa', 'helado',
  'pan', 'queso', 'huevo', 'manzana', 'plátano',
  // Acciones (10)
  'correr', 'saltar', 'dormir', 'comer', 'beber',
  'cantar', 'bailar', 'nadar', 'escribir', 'leer',
  // Misc (10)
  'fútbol', 'tenis', 'música', 'película', 'playa',
  'montaña', 'sol', 'lluvia', 'agua', 'fuego'
];

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
 * Crea el estado inicial del juego
 * @param {Array} teams - Array de equipos [{ id, name, players: [playerNames] }]
 * @param {Array} words - Array de palabras
 * @param {boolean} withSounds - Si incluye ronda 4
 * @returns {object} - Estado inicial
 */
export function createLocalState(teams, words, withSounds = false) {
  const shuffledWords = shuffleArray(words);
  
  return {
    state: 'playing', // playing, round-end, finished
    config: {
      teamCount: teams.length,
      withSounds,
      totalRounds: withSounds ? 4 : 3
    },
    teams: teams.map((t, i) => ({
      id: i,
      name: t.name,
      players: t.players || [],
      score: 0
    })),
    allWords: words,
    shuffledWords,
    wordsUsed: [],     // Palabras adivinadas en esta ronda
    wordsSeen: [],     // Palabras saltadas en esta ronda
    
    // Estado de juego
    currentRound: 1,
    currentTeamTurn: 0,    // Índice del equipo que tiene el turno
    currentPlayerIndex: 0, // Índice del jugador dentro del equipo
    turnActive: false,
    currentWord: null,
    roundScores: {},  // { 1: {0: 0, 1: 0}, 2: {...} }
    startingTeam: 0,  // Equipo que inicia cada ronda
    
    // Configuración de cada ronda
    roundConfig: { ...DEFAULT_ROUND_CONFIG }
  };
}

/**
 * Inicia un nuevo turno
 */
export function startTurn(state) {
  const team = state.teams[state.currentTeamTurn];
  if (!team || team.players.length === 0) {
    return { ...state, turnActive: false, currentWord: null };
  }
  
  // Obtener siguiente palabra
  const currentWord = getCurrentWord(state);
  const roundConfig = state.roundConfig[state.currentRound];
  
  return {
    ...state,
    turnActive: true,
    currentWord,
    currentPlayerIndex: 0, // Siempre empieza el primer jugador del equipo
    wordsUsed: [],
    wordsSeen: []
  };
}

/**
 * Marca una palabra como adivinada (correcto)
 */
export function markCorrect(state) {
  if (!state.turnActive || !state.currentWord) return state;
  
  const wordIndex = state.shuffledWords.indexOf(state.currentWord);
  const teamId = state.currentTeamTurn;
  
  // Verificar si ya fue usada
  if (wordIndex === -1 || state.wordsUsed.includes(wordIndex)) {
    return state;
  }
  
  // Agregar a palabras usadas
  const newWordsUsed = [...state.wordsUsed, wordIndex];
  
  // Actualizar score del equipo
  const newTeams = state.teams.map((team, i) => 
    i === teamId 
      ? { ...team, score: team.score + 1 }
      : team
  );
  
  // Inicializar roundScores si no existe
  const roundScores = { ...state.roundScores };
  if (!roundScores[state.currentRound]) {
    roundScores[state.currentRound] = {};
    for (let i = 0; i < state.config.teamCount; i++) {
      roundScores[state.currentRound][i] = 0;
    }
  }
  roundScores[state.currentRound][teamId] = (roundScores[state.currentRound][teamId] || 0) + 1;
  
  // Obtener siguiente palabra
  const nextWord = getNextWord(state, newWordsUsed, state.wordsSeen);
  
  return {
    ...state,
    teams: newTeams,
    wordsUsed: newWordsUsed,
    roundScores,
    currentWord: nextWord
  };
}

/**
 * Marca como respuesta incorrecta (pierde turno)
 */
export function markWrong(state) {
  const roundConfig = state.roundConfig[state.currentRound];
  
  // Si failPassesTurn es false, simplemente pasas a la siguiente palabra
  if (!roundConfig.failPassesTurn) {
    const nextWord = getNextWord(state, state.wordsUsed, state.wordsSeen);
    return {
      ...state,
      currentWord: nextWord
    };
  }
  
  // Si failPassesTurn es true, termina el turno
  return endTurn(state);
}

/**
 * Salta la palabra actual (no cuenta como correcta)
 */
export function skipWord(state) {
  const roundConfig = state.roundConfig[state.currentRound];
  
  if (!roundConfig.allowSkip) return state;
  if (!state.currentWord) return state;
  
  const wordIndex = state.shuffledWords.indexOf(state.currentWord);
  if (wordIndex === -1) return state;
  
  // Agregar a palabras vistas (solo para esta ronda)
  const newWordsSeen = [...state.wordsSeen, wordIndex];
  
  // Obtener siguiente palabra
  const nextWord = getNextWord(state, state.wordsUsed, newWordsSeen);
  
  return {
    ...state,
    wordsSeen: newWordsSeen,
    currentWord: nextWord
  };
}

/**
 * Obtiene la siguiente palabra disponible
 */
function getNextWord(state, wordsUsed, wordsSeen) {
  // Primera pasada: buscar palabra que NO esté usada NI recientemente vista
  for (let i = 0; i < state.shuffledWords.length; i++) {
    if (!wordsUsed.includes(i) && !wordsSeen.includes(i)) {
      return state.shuffledWords[i];
    }
  }
  
  // Segunda pasada: cualquier palabra no usada
  for (let i = 0; i < state.shuffledWords.length; i++) {
    if (!wordsUsed.includes(i)) {
      return state.shuffledWords[i];
    }
  }
  
  return null;
}

/**
 * Obtiene la palabra actual del pool
 */
export function getCurrentWord(state) {
  return getNextWord(state, state.wordsUsed, state.wordsSeen);
}

/**
 * Termina el turno actual y pasa al siguiente equipo
 */
export function endTurn(state) {
  // siguiente equipo
  const nextTeamTurn = (state.currentTeamTurn + 1) % state.config.teamCount;
  
  return {
    ...state,
    turnActive: false,
    currentTeamTurn: nextTeamTurn,
    currentPlayerIndex: 0,
    currentWord: null
  };
}

/**
 * Pasa al siguiente jugador dentro del mismo equipo
 */
export function nextPlayerInTeam(state) {
  const team = state.teams[state.currentTeamTurn];
  if (!team || team.players.length <= 1) {
    return endTurn(state);
  }
  
  const nextIndex = (state.currentPlayerIndex + 1) % team.players.length;
  
  return {
    ...state,
    currentPlayerIndex: nextIndex
  };
}

/**
 * Termina la ronda actual
 */
export function endRound(state) {
  const isLastRound = state.currentRound >= state.config.totalRounds;
  
  return {
    ...state,
    state: isLastRound ? 'finished' : 'round-end',
    turnActive: false
  };
}

/**
 * Inicia una nueva ronda
 */
export function startNewRound(state) {
  const nextRound = state.currentRound + 1;
  
  // Alternar equipo inicial
  const nextStartingTeam = (state.startingTeam + 1) % state.config.teamCount;
  
  // Resetear palabras usadas/vistas
  // Mezclar palabras nuevamente
  const newShuffledWords = shuffleArray(state.allWords);
  
  return {
    ...state,
    state: 'playing',
    currentRound: nextRound,
    currentTeamTurn: nextStartingTeam,
    currentPlayerIndex: 0,
    wordsUsed: [],
    wordsSeen: [],
    shuffledWords: newShuffledWords,
    startingTeam: nextStartingTeam,
    turnActive: false,
    currentWord: null
  };
}

/**
 * Obtiene la clasificación actual por equipos
 */
export function getLeaderboard(state) {
  return state.teams
    .map((team, index) => ({
      teamId: index,
      teamName: team.name,
      score: team.score,
      roundScores: state.roundScores
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Determina el equipo ganador
 */
export function getWinner(state) {
  const leaderboard = getLeaderboard(state);
  if (leaderboard.length === 0) return null;
  
  const maxScore = leaderboard[0].score;
  const winners = leaderboard.filter(t => t.score === maxScore);
  
  if (winners.length === 1) {
    return state.teams[winners[0].teamId];
  }
  
  // Empate - retornar primero
  return state.teams[winners[0].teamId];
}

/**
 * Obtiene la configuración de una ronda específica
 */
export function getRoundConfig(state, roundNumber) {
  return state.roundConfig[roundNumber] || DEFAULT_ROUND_CONFIG[roundNumber];
}

/**
 * Actualiza la configuración de una ronda
 */
export function updateRoundConfig(state, roundNumber, config) {
  return {
    ...state,
    roundConfig: {
      ...state.roundConfig,
      [roundNumber]: {
        ...state.roundConfig[roundNumber],
        ...config
      }
    }
  };
}

/**
 * Obtiene el jugador actual que debe describir
 */
export function getCurrentPlayer(state) {
  const team = state.teams[state.currentTeamTurn];
  if (!team || team.players.length === 0) return null;
  
  return team.players[state.currentPlayerIndex] || team.players[0];
}

/**
 * Obtiene las palabras restantes
 */
export function getRemainingWordsCount(state) {
  return state.shuffledWords.length - state.wordsUsed.length;
}

/**
 * Verifica si todas las palabras fueron usadas
 */
export function areAllWordsUsed(state) {
  return state.wordsUsed.length >= state.shuffledWords.length;
}

export default {
  ROUND_TIMES,
  ROUND_NAMES,
  DEFAULT_WORD_BANK,
  DEFAULT_ROUND_CONFIG,
  shuffleArray,
  createLocalState,
  startTurn,
  markCorrect,
  markWrong,
  skipWord,
  getCurrentWord,
  endTurn,
  nextPlayerInTeam,
  endRound,
  startNewRound,
  getLeaderboard,
  getWinner,
  getRoundConfig,
  updateRoundConfig,
  getCurrentPlayer,
  getRemainingWordsCount,
  areAllWordsUsed
};
