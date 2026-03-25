import { useState, useEffect, useMemo, useCallback } from 'react';
import { api, ENDPOINTS } from '../api/index.js';
import { useAuth } from '../hooks/index.js';
import { getSocket } from '../hooks/useSocket.js';
import { ConfirmModal } from '../components/index.js';

/**
 * Vista de Checklist en pestaña propia
 * Muestra múltiples secciones expansibles
 */
export function ChecklistView({ tripConfig, onNavigate }) {
  const { user, token } = useAuth();
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [newItemText, setNewItemText] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [showNewSectionInput, setShowNewSectionInput] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [sectionToDelete, setSectionToDelete] = useState(null);
  
  const isAdminUser = user?.isAdmin === 1 || user?.isAdmin === true;
  
  // Función para cargar datos
  const loadData = useCallback(async () => {
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
        // Expandir todas las secciones por defecto
        const expanded = {};
        sectionsRes.sections.forEach(s => {
          expanded[s.name] = true;
        });
        setExpandedSections(expanded);
      }
    } catch (err) {
      console.error('[ChecklistView] Error loading checklist:', err);
    }
  }, [token]);
  
  // Cargar datos cuando cambia el token
  useEffect(() => {
    if (token) {
      console.log('[ChecklistView] Token available, loading data...');
      loadData();
    }
  }, [token, loadData]);
  
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

  // Agrupar items por sección
  const itemsBySection = useMemo(() => {
    const grouped = {};
    
    items.forEach(item => {
      const sectionName = item.section || 'General';
      if (!grouped[sectionName]) {
        grouped[sectionName] = [];
      }
      grouped[sectionName].push(item);
    });
    
    return grouped;
  }, [items]);
  
  // Nombres de secciones para el dropdown (incluye las que ya tienen items)
  const allSectionNames = useMemo(() => {
    const names = new Set();
    // Agregar secciones de la DB
    sections.forEach(s => names.add(s.name));
    // Agregar secciones que tienen items
    items.forEach(i => {
      if (i.section) names.add(i.section);
    });
    return Array.from(names).sort();
  }, [sections, items]);
  
  // Toggle sección
  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };
  
  // Agregar item
  const handleAddItem = async () => {
    const text = newItemText.trim();
    if (!text || text.length > 20) return;
    
    // Usar la sección seleccionada o vacío para "General"
    const section = selectedSection || '';
    
    const response = await api.post(ENDPOINTS.CHECKLIST, { text, section });
    if (response.success) {
      await loadData();
      setNewItemText('');
      setSelectedSection('');
    }
  };
  
  // Toggle item
  const handleToggleItem = async (id) => {
    const response = await api.put(ENDPOINTS.CHECKLIST_TOGGLE(id));
    if (response.success) {
      await loadData();
    }
  };
  
  // Eliminar item
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    
    const response = await api.delete(ENDPOINTS.CHECKLIST_DELETE(itemToDelete.id));
    if (response.success) {
      await loadData();
    }
    setItemToDelete(null);
  };
  
  // Agregar sección (solo admin)
  const handleAddSection = async () => {
    const name = newSectionName.trim();
    if (!name) return;
    
    const response = await api.post(ENDPOINTS.CHECKLIST_SECTIONS, { name });
    if (response.success) {
      await loadData();
      setNewSectionName('');
      setShowNewSectionInput(false);
    }
  };
  
  // Eliminar sección (solo admin)
  const handleDeleteSection = async () => {
    if (!sectionToDelete) return;
    
    const response = await api.delete(ENDPOINTS.CHECKLIST_SECTION_DELETE(sectionToDelete.id));
    if (response.success) {
      await loadData();
    }
    setSectionToDelete(null);
  };
  
  // Contar items pendientes
  const pendingCount = items.filter(i => !i.completed).length;
  const totalCount = items.length;
  
  // Mensaje según estado del viaje
  const tripStarted = tripConfig?.trip_started;
  
  // Si hay secciones, mostrar grouped por secciones
  // Si no hay secciones pero hay items con section, también mostrar grouped
  const hasSections = allSectionNames.length > 0;
  
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
        
        {/* Agregar nueva tarea */}
        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          {/* Selector de sección - obligatorio si hay secciones */}
          {hasSections ? (
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
            >
              <option value="">Selecciona sección *</option>
              {allSectionNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : null}
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder={hasSections ? "Nueva tarea..." : "Crea una sección primero"}
              maxLength={20}
              disabled={hasSections && !selectedSection}
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
              onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
            />
            <button
              onClick={handleAddItem}
              disabled={!newItemText.trim() || (hasSections && !selectedSection)}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg"
            >
              +
            </button>
          </div>
          
          {!hasSections && (
            <p className="text-yellow-500 text-sm text-center">
              ⚠️ Crea una sección primero para poder agregar tareas
            </p>
          )}
          {hasSections && !selectedSection && (
            <p className="text-yellow-500 text-sm text-center">
              ⚠️ Selecciona una sección para agregar la tarea
            </p>
          )}
        </div>
        
        {/* Agregar sección (solo admin) */}
        {isAdminUser && (
          <div className="bg-gray-800 rounded-lg p-4">
            {showNewSectionInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="Nombre de sección..."
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSection()}
                />
                <button
                  onClick={handleAddSection}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg"
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowNewSectionInput(false);
                    setNewSectionName('');
                  }}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewSectionInput(true)}
                className="w-full text-gray-400 hover:text-white text-sm py-2"
              >
                + Nueva Sección
              </button>
            )}
          </div>
        )}
        
        {/* Lista de items por secciones o simple */}
        {hasSections ? (
          // Mostrar por secciones
          allSectionNames.map(sectionName => (
            <div key={sectionName} className="bg-gray-800 rounded-lg overflow-hidden">
              {/* Header de sección */}
              <button
                onClick={() => toggleSection(sectionName)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{expandedSections[sectionName] ? '📂' : '📁'}</span>
                  <span className="font-semibold text-white">{sectionName}</span>
                  <span className="text-gray-500 text-sm">
                    ({itemsBySection[sectionName]?.filter(i => !i.completed).length || 0}/{itemsBySection[sectionName]?.length || 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isAdminUser && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const section = sections.find(s => s.name === sectionName);
                        if (section) setSectionToDelete(section);
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      🗑️
                    </button>
                  )}
                  <span className="text-gray-400">{expandedSections[sectionName] ? '▲' : '▼'}</span>
                </div>
              </button>
              
              {/* Items de la sección */}
              {expandedSections[sectionName] && (
                <div className="px-4 pb-4 space-y-2">
                  {(itemsBySection[sectionName] || []).map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
                      <button
                        onClick={() => handleToggleItem(item.id)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          item.completed 
                            ? 'bg-green-600 border-green-600' 
                            : 'border-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {item.completed && '✓'}
                      </button>
                      <span className={`flex-1 ${item.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {item.text}
                      </span>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  
                  {(itemsBySection[sectionName] || []).length === 0 && (
                    <p className="text-gray-500 text-center py-2">No hay tareas en esta sección</p>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          // Sin secciones - mostrar lista simple
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
                <button
                  onClick={() => handleToggleItem(item.id)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    item.completed 
                      ? 'bg-green-600 border-green-600' 
                      : 'border-gray-500 hover:border-gray-400'
                  }`}
                >
                  {item.completed && '✓'}
                </button>
                <span className={`flex-1 ${item.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                  {item.text}
                </span>
                <button
                  onClick={() => setItemToDelete(item)}
                  className="text-gray-500 hover:text-red-400"
                >
                  🗑️
                </button>
              </div>
            ))}
            
            {items.length === 0 && (
              <p className="text-gray-500 text-center py-4">No hay tareas todavía</p>
            )}
          </div>
        )}
        
        {/* Modal de confirmación para eliminar item */}
        <ConfirmModal
          isOpen={!!itemToDelete}
          onConfirm={handleDeleteItem}
          onCancel={() => setItemToDelete(null)}
          title="Eliminar tarea"
          message={`¿Eliminar "${itemToDelete?.text}"?`}
        />
        
        {/* Modal de confirmación para eliminar sección */}
        <ConfirmModal
          isOpen={!!sectionToDelete}
          onConfirm={handleDeleteSection}
          onCancel={() => setSectionToDelete(null)}
          title="Eliminar sección"
          message={`¿Eliminar la sección "${sectionToDelete?.name}" y todas sus tareas?`}
        />
      </div>
    </div>
  );
}

export default ChecklistView;
