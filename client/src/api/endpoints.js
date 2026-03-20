// Endpoints de la API
export const ENDPOINTS = {
  // Auth
  REGISTER: '/api/register',
  LOGIN: '/api/login',
  RESET_PASSWORD_DIRECT: '/api/reset-password-direct',
  
  // Trip
  TRIP_CONFIG: '/api/trip/config',
  
  // Users
  USERS: '/api/users',
  
  // Counters
  COUNTERS: '/api/counters',
  COUNTER_BY_USER: (userId) => '/api/counters/' + userId,
  COUNTER_HISTORY: '/api/counters/history',
  COUNTER_TYPES: '/api/counter-types',
  
  // Turbo
  TURBO_STATE: '/api/turbo/state',
  TURBO_TOGGLE: '/api/turbo/toggle',
  TURBO_TRIGGER: '/api/turbo/trigger',
  TURBO_CONFIRM: '/api/turbo/confirm',
  TURBO_CANCEL: '/api/turbo/cancel',
  TURBO_CONFIG: '/api/turbo/config',

  // Checklist
  CHECKLIST: '/api/checklist',
  CHECKLIST_TOGGLE: (id) => '/api/checklist/' + id + '/toggle',
  CHECKLIST_DELETE: (id) => '/api/checklist/' + id,
  
  // User
  UPDATE_USER_NAME: (userId) => '/api/users/' + userId + '/name',
};

export default ENDPOINTS;
