import { useState, useCallback, useEffect } from 'react';
import { api, ENDPOINTS } from '../api/index.js';

/**
 * Hook para gestionar contadores
 * @param {string|null} token - Token de autenticación
 * @returns {object} - { counters, users, checklist, loading, updateCounter, refreshCounters, loadChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem }
 */
export function useCounters(token) {
  const [counters, setCounters] = useState({});
  const [users, setUsers] = useState([]);
  const [checklist, setChecklist] = useState([]);
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
  
  /**
   * Cargar checklist
   */
  const loadChecklist = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await api.get(ENDPOINTS.CHECKLIST);
      if (response.success) {
        setChecklist(response.items);
      }
    } catch (err) {
      console.error('Error loading checklist:', err);
    }
  }, [token]);
  
  /**
   * Agregar item a la checklist
   */
  const addChecklistItem = useCallback(async (text, section = '') => {
    if (!token) return;
    
    try {
      const response = await api.post(ENDPOINTS.CHECKLIST, { text, section });
      if (response.success) {
        await loadChecklist();
      }
      return response;
    } catch (err) {
      console.error('Error adding checklist item:', err);
      return { success: false, error: 'Error agregando tarea' };
    }
  }, [token, loadChecklist]);
  
  /**
   * Toggle item de la checklist
   */
  const toggleChecklistItem = useCallback(async (id) => {
    if (!token) return;
    
    try {
      const response = await api.put(ENDPOINTS.CHECKLIST_TOGGLE(id));
      if (response.success) {
        await loadChecklist();
      }
      return response;
    } catch (err) {
      console.error('Error toggling checklist item:', err);
      return { success: false, error: 'Error actualizando tarea' };
    }
  }, [token, loadChecklist]);
  
  /**
   * Eliminar item de la checklist
   */
  const deleteChecklistItem = useCallback(async (id) => {
    if (!token) return;
    
    try {
      const response = await api.delete(ENDPOINTS.CHECKLIST_DELETE(id));
      if (response.success) {
        await loadChecklist();
      }
      return response;
    } catch (err) {
      console.error('Error deleting checklist item:', err);
      return { success: false, error: 'Error eliminando tarea' };
    }
  }, [token, loadChecklist]);
  
  /**
   * Actualizar nombre de usuario
   */
  const updateUserName = useCallback(async (userId, newName) => {
    if (!token) return;
    
    try {
      const response = await api.put(ENDPOINTS.UPDATE_USER_NAME(userId), { name: newName });
      return response;
    } catch (err) {
      console.error('Error updating user name:', err);
      return { success: false, error: 'Error actualizando nombre' };
    }
  }, [token]);
  
  // Cargar datos al inicio
  useEffect(() => {
    if (token) {
      refreshCounters();
      loadChecklist();
    }
  }, [token, refreshCounters, loadChecklist]);
  
  return {
    counters,
    users,
    checklist,
    loading,
    updateCounter,
    refreshCounters,
    loadChecklist,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    updateUserName
  };
}

export default useCounters;
