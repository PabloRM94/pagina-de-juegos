// Constantes de vistas
export const VIEWS = {
  LOGIN: 'login',
  REGISTER: 'register',
  RESET_PASSWORD: 'reset-password',  // Simplified: username + new password + confirm
  WAITING: 'waiting',  // Vista de cuenta atrás
  DASHBOARD: 'dashboard',
  GAMES: 'games',
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
  // Apuestas views
  APUESTAS_LOBBY: 'apuestas-lobby',
  APUESTAS_CONFIG: 'apuestas-config',
  APUESTAS_PLAY: 'apuestas-play',
  APUESTAS_RESULT: 'apuestas-result',
  APUESTAS_FINAL: 'apuestas-final'
};

// URLs de API
export const SERVER_URL = import.meta.env.VITE_SERVER_URL 
  ? import.meta.env.VITE_SERVER_URL.replace(/\/$/, '') 
  : 'http://localhost:3001';
