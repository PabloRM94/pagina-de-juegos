import { useState, useCallback, useEffect } from 'react';
import { api, ENDPOINTS } from '../api/index.js';

/**
 * Hook para gestionar contadores
 * @param {string|null} token - Token de autenticación
 * @returns {object} - { counters, users, loading, updateCounter, refreshCounters }
 */
export function useCounters(token) {
  const [counters, setCounters] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  /**
   * Cargar contadores y usuarios
   */
  const refreshCounters = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const [countersRes, usersRes] = await Promise.all([
        api.get(ENDPOINTS.COUNTERS),
        api.get(ENDPOINTS.USERS)
      ]);
      
      if (countersRes.success) {
        const countersMap = {};
        countersRes.counters.forEach(c => {
          countersMap[c.user_id] = c;
        });
        setCounters(countersMap);
      }
      
      if (usersRes.success) {
        setUsers(usersRes.users);
      }
    } catch (err) {
      console.error('Error loading counters:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  /**
   * Actualizar un contador
   */
  const updateCounter = useCallback(async (userId, counterType, action) => {
    if (!token) return;
    
    try {
      const response = await api.post(
        ENDPOINTS.COUNTER_BY_USER(userId),
        { counterType, action }
      );
      
      return response;
    } catch (err) {
      console.error('Error updating counter:', err);
      return { success: false, error: 'Error actualizando contador' };
    }
  }, [token]);
  
  // Cargar datos al inicio
  useEffect(() => {
    if (token) {
      refreshCounters();
    }
  }, [token, refreshCounters]);
  
  return {
    counters,
    users,
    loading,
    updateCounter,
    refreshCounters
  };
}

export default useCounters;
