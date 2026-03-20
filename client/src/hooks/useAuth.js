import { useState, useCallback, useEffect } from 'react';
import { api, setApiToken, ENDPOINTS } from '../api/index.js';

/**
 * Genera un nombre de invitado aleatorio
 */
const generateGuestName = () => {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `Invitado-${random}`;
};

/**
 * Genera un avatar aleatorio
 */
const generateGuestAvatar = () => {
  const styles = ['adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles'];
  return styles[Math.floor(Math.random() * styles.length)];
};

/**
 * Hook para gestionar autenticación
 * @returns {object} - { user, token, login, register, logout, loginAsGuest, loading, error }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  
  // Verificar si hay una sesión de invitado guardada
  useEffect(() => {
    const savedGuest = localStorage.getItem('guest_session');
    if (savedGuest) {
      try {
        const guestData = JSON.parse(savedGuest);
        setUser(guestData.user);
        setIsGuest(true);
        // No hay token real para invitados, usamos uno falso
        setToken('guest-token');
      } catch (e) {
        localStorage.removeItem('guest_session');
      }
    }
  }, []);
  
  // Actualizar cliente API cuando cambia el token
  useEffect(() => {
    setApiToken(token);
  }, [token]);
  
  /**
   * Iniciar sesión
   */
  const login = useCallback(async (name, password) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post(ENDPOINTS.LOGIN, { name, password });
      
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        return { success: true };
      } else {
        setError(response.error);
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = 'Error de conexión';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Registrarse
   */
  const register = useCallback(async (name, password) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post(ENDPOINTS.REGISTER, { name, password });
      
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        return { success: true };
      } else {
        setError(response.error);
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = 'Error de conexión';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Cerrar sesión
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setError('');
    setIsGuest(false);
    localStorage.removeItem('guest_session');
  }, []);

  /**
   * Iniciar sesión como invitado (temporal, sin registro en BBdd)
   */
  const loginAsGuest = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Generar datos de invitado
      const guestName = generateGuestName();
      const guestAvatar = generateGuestAvatar();
      
      const guestUser = {
        id: -Date.now(), // ID negativo para identificar como guest
        name: guestName,
        isGuest: true,
        avatarStyle: guestAvatar,
        avatarSeed: guestName
      };
      
      // Guardar en estado y localStorage
      setUser(guestUser);
      setIsGuest(true);
      setToken('guest-token');
      
      // Guardar sesión en localStorage (para persistencia simple)
      localStorage.setItem('guest_session', JSON.stringify({
        user: guestUser
      }));
      
      return { success: true };
    } catch (err) {
      const errorMsg = 'Error al entrar como invitado';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Actualiza el usuario (para cuando cambia el nombre)
   */
  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);
  
  return {
    user,
    token,
    loading,
    error,
    isGuest,
    login,
    register,
    logout,
    loginAsGuest,
    updateUser,
    isAuthenticated: !!token && !!user
  };
}

export default useAuth;
