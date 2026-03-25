import { useState, useEffect } from 'react';
import { api, ENDPOINTS } from '../api/index.js';
import { useAuth } from '../hooks/index.js';
import { getSocket } from '../hooks/useSocket.js';
import { Checklist } from '../components/index.js';

/**
 * Vista de Checklist en pestaña propia
 * Muestra múltiples secciones expansibles
 */
export function ChecklistView({ tripConfig, onNavigate }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  
  // Función para cargar datos (igual que WaitingView - sin useCallback)
  const loadData = async () => {
    console.log('[ChecklistView] loadData called, token:', !!token);
    try {
      const [itemsRes, sectionsRes] = await Promise.all([
        api.get(ENDPOINTS.CHECKLIST),
        api.get(ENDPOINTS.CHECKLIST_SECTIONS)
      ]);
      
      console.log('[ChecklistView] itemsRes:', itemsRes);
      console.log('[ChecklistView] sectionsRes:', sectionsRes);
      
      if (itemsRes.success) {
        setItems(itemsRes.items);
      }
      
      if (sectionsRes.success) {
        setSections(sectionsRes.sections);
      }
    } catch (err) {
      console.error('[ChecklistView] Error loading checklist:', err);
    }
  };
  
  // Cargar datos cuando cambia el token
  useEffect(() => {
    if (token) {
      console.log('[ChecklistView] Token available, loading data...');
      loadData();
    }
  }, [token]);
  
  // Escuchar actualizaciones del checklist via socket
  useEffect(() => {
    const socket = getSocket();
    
    const handleChecklistUpdated = () => {
      console.log('[ChecklistView] Checklist actualizado via socket, recargando...');
      loadData();
    };
    
    socket.on('checklist-updated', handleChecklistUpdated);
    
    return () => {
      socket.off('checklist-updated', handleChecklistUpdated);
    };
  }, []);

  // Handlers para el componente Checklist (igual que WaitingView)
  const handleAddItem = async (text, section = '') => {
    try {
      const response = await api.post(ENDPOINTS.CHECKLIST, { text, section });
      if (response.success) {
        loadData();
      }
      return response;
    } catch (err) {
      console.error('[ChecklistView] Error adding item:', err);
      return { success: false, error: 'Error agregando tarea' };
    }
  };

  const handleToggleItem = async (id) => {
    try {
      const response = await api.put(ENDPOINTS.CHECKLIST_TOGGLE(id));
      if (response.success) {
        loadData();
      }
      return response;
    } catch (err) {
      console.error('[ChecklistView] Error toggling item:', err);
      return { success: false, error: 'Error actualizando tarea' };
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const response = await api.delete(ENDPOINTS.CHECKLIST_DELETE(id));
      if (response.success) {
        loadData();
      }
      return response;
    } catch (err) {
      console.error('[ChecklistView] Error deleting item:', err);
      return { success: false, error: 'Error eliminando tarea' };
    }
  };

  // Contar items pendientes
  const pendingCount = items.filter(i => !i.completed).length;
  const totalCount = items.length;
  
  // Mensaje según estado del viaje
  const tripStarted = tripConfig?.trip_started;
  
  return (
    <div className="min-h-screen bg-gray-900 p-4 pb-24">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">✅ Checklist</h1>
          <p className="text-gray-400">
            {tripStarted 
              ? `Tienes ${pendingCount} tarea${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`
              : tripStarted === false
                ? '🚗 Aún puedes irte de viaje'
                : 'Cargando...'}
          </p>
        </div>
        
        {/* Componente Checklist - mismo que en WaitingView */}
        <Checklist
          items={items}
          onAddItem={handleAddItem}
          onToggleItem={handleToggleItem}
          onDeleteItem={handleDeleteItem}
        />
      </div>
    </div>
  );
}

export default ChecklistView;
