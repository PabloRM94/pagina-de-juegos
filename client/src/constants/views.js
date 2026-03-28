// Constantes de vistas
export const VIEWS = {
  LOGIN: 'login',
  REGISTER: 'register',
  RESET_PASSWORD: 'reset-password',
  WAITING: 'waiting',
  DASHBOARD: 'dashboard',
  GAMES: 'games',
  CHECKLIST: 'checklist',
  GAME: 'game',
  GAME_LOBBY: 'game-lobby',
  HIDDEN: 'hidden',
  ENCOUNTER_RESULT: 'encounter-result',
  STATS: 'stats',
  ADMIN: 'admin',
  GAME_WINNER: 'game-winner',
  // Time's Up views
  TIMESUP_LOBBY: 'timesup-lobby',
  TIMESUP_TEAM_NAME: 'timesup-team-name',
  TIMESUP_WORD_INPUT: 'timesup-word-input',
  TIMESUP_PLAY: 'timesup-play',
  TIMESUP_ROUND_RESULT: 'timesup-round-result',
  TIMESUP_FINAL_RESULT: 'timesup-final-result',
  // Time's Up New (Local) views
  TIMESUP_NEW_LOBBY: 'timesup-new-lobby',
  TIMESUP_NEW_WORDS: 'timesup-new-words',
  TIMESUP_NEW_PLAY: 'timesup-new-play',
  TIMESUP_NEW_PASS: 'timesup-new-pass',
  TIMESUP_NEW_ROUND_RESULT: 'timesup-new-round-result',
  TIMESUP_NEW_FINAL: 'timesup-new-final',
  // Apuestas views
  APUESTAS_LOBBY: 'apuestas-lobby',
  APUESTAS_CONFIG: 'apuestas-config',
  APUESTAS_PLAY: 'apuestas-play',
  APUESTAS_RESULT: 'apuestas-result',
  APUESTAS_FINAL: 'apuestas-final',
  // BeerPong Tournament views
  BEERPONG_LOBBY: 'beerpong-lobby',
  BEERPONG_SETUP: 'beerpong-setup',
  BEERPONG_BRACKET: 'beerpong-bracket',
  BEERPONG_FINAL: 'beerpong-final'
};

// URLs de API
export const SERVER_URL = import.meta.env.VITE_SERVER_URL 
  ? import.meta.env.VITE_SERVER_URL.replace(/\/$/, '') 
  : 'http://localhost:3001';
