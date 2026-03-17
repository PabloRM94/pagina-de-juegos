import { AVATAR_STYLES, getAvatarUrl } from '../constants/avatars.js';

/**
 * Obtiene un seed de avatar basado en preferencias del usuario
 * @param {string} avatarSeed - Seed personalizado
 * @param {string} fallbackName - Nombre para usar como seed si no hay seed personalizado
 * @returns {string} - Seed para el avatar
 */
export const getAvatarSeed = (avatarSeed, fallbackName) => 
  avatarSeed?.trim() || fallbackName?.trim() || Math.random().toString(36).substring(7);

/**
 * Obtiene la URL del avatar del usuario actual
 * @param {string} avatarStyle - Estilo de avatar seleccionado
 * @param {string} avatarSeed - Seed personalizado
 * @returns {string} - URL del avatar
 */
export const getMyAvatarUrl = (avatarStyle, avatarSeed) => 
  getAvatarUrl(avatarStyle, getAvatarSeed(avatarSeed));

/**
 * Obtiene la URL del avatar de otro jugador
 * @param {string} avatarStyle - Estilo de avatar (debe ser el mismo para todos)
 * @param {string} name - Nombre del jugador para usar como seed
 * @returns {string} - URL del avatar
 */
export const getPlayerAvatarUrl = (avatarStyle, name) => 
  getAvatarUrl(avatarStyle, name);

export { AVATAR_STYLES, getAvatarUrl };
