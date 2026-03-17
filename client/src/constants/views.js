// Constantes de vistas
export const VIEWS = {
  LOGIN: 'login',
  REGISTER: 'register',
  RESET_PASSWORD: 'reset-password',  // Simplified: username + new password + confirm
  WAITING: 'waiting',  // Vista de cuenta atrás
  DASHBOARD: 'dashboard',
  GAME: 'game',
  GAME_LOBBY: 'game-lobby',
  HIDDEN: 'hidden',
  ENCOUNTER_RESULT: 'encounter-result'
};

// URLs de API
export const SERVER_URL = import.meta.env.VITE_SERVER_URL 
  ? import.meta.env.VITE_SERVER_URL.replace(/\/$/, '') 
  : 'http://localhost:3001';
