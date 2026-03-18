// Roles disponibles - SOLO piedra, papel, tijera
export const ROLES = ['piedra', 'papel', 'tijera'];

/**
 * Resuelve un encuentro entre dos roles
 * @param {string} role1 - Rol del primer jugador
 * @param {string} role2 - Rol del segundo jugador
 * @returns {string} - 'tie', 'player1', o 'player2'
 */
export function resolveEncounter(role1, role2) {
  if (role1 === role2) return 'tie';
  
  // Victoria de role1 sobre role2
  const wins = {
    piedra: ['tijera'],
    papel: ['piedra'],
    tijera: ['papel']
  };
  
  return wins[role1]?.includes(role2) ? 'player1' : 'player2';
}

/**
 * Asigna un rol balanceado (evitando duplicados si es posible)
 * @param {object} existingRoles - Roles existentes { socketId: role }
 * @returns {string} - Rol asignado
 */
export function assignBalancedRole(existingRoles) {
  // Contar cuántos de cada rol ya están asignados
  const roleCount = {};
  ROLES.forEach(role => roleCount[role] = 0);
  
  // Contar roles existentes entre jugadores vivos
  Object.values(existingRoles).forEach(role => {
    if (role) roleCount[role]++;
  });
  
  // Encontrar el rol con menos jugadores
  const minCount = Math.min(...Object.values(roleCount));
  const availableRoles = ROLES.filter(role => roleCount[role] === minCount);
  
  // Si hay roles disponibles con menos jugadores, elegir uno de ellos
  if (availableRoles.length > 0) {
    return availableRoles[Math.floor(Math.random() * availableRoles.length)];
  }
  
  // Si todos tienen la misma cantidad, elegir aleatorio
  return assignRandomRole();
}

/**
 * Asigna un rol aleatorio
 * @returns {string} - Rol asignado
 */
export function assignRandomRole() {
  return ROLES[Math.floor(Math.random() * ROLES.length)];
}

export default {
  ROLES,
  resolveEncounter,
  assignBalancedRole,
  assignRandomRole
};
