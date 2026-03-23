import { useState, useCallback, useEffect } from 'react';
import { api, setApiToken, ENDPOINTS } from '../api/index.js';

// Keys para localStorage
const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
  GUEST: 'guest_session'
};

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
  const [loading, setLoading] = useState(true); // Empezamos en true para evitar flash
  const [error, setError] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  
  // Función para validar el token con el servidor
  const validateToken = useCallback(async (tokenToValidate) => {
    try {
      const response = await api.get(ENDPOINTS.VALIDATE, {
        headers: { Authorization: `Bearer ${tokenToValidate}` }
      });
      if (response.success) {
        return { valid: true, user: response.user };
      }
      return { valid: false, user: null };
    } catch (err) {
      console.error('Error validando token:', err);
      return { valid: false, user: null };
    }
  }, []);
  
  // Verificar si hay una sesión guardada al iniciar
  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Verificar sesión de usuario registrado
      const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      
      if (savedToken && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          // Revalidar con el servidor
          const validation = await validateToken(savedToken);
          
          if (validation.valid) {
            setToken(savedToken);
            setUser(validation.user);
          } else {
            // Token inválido, limpiar
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
          }
        } catch (e) {
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER);
        }
      } else {
        // 2. Verificar sesión de invitado
        const savedGuest = localStorage.getItem(STORAGE_KEYS.GUEST);
        if (savedGuest) {
          try {
            const guestData = JSON.parse(savedGuest);
            setUser(guestData.user);
            setIsGuest(true);
            setToken('guest-token');
          } catch (e) {
            localStorage.removeItem(STORAGE_KEYS.GUEST);
          }
        }
      }
      setLoading(false);
    };
    
    initializeAuth();
  }, [validateToken]);
  
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
        // Persistir en localStorage
        localStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
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
        // Persistir en localStorage
        localStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
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
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.GUEST);
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
      localStorage.setItem(STORAGE_KEYS.GUEST, JSON.stringify({
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
