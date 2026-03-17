import { useState, useCallback, useEffect } from 'react';
import { api, setApiToken, ENDPOINTS } from '../api/index.js';

/**
 * Hook para gestionar autenticación
 * @returns {object} - { user, token, login, register, logout, loading, error }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
  }, []);
  
  return {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user
  };
}

export default useAuth;
