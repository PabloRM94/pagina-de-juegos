import { useState, useMemo } from 'react';
import { ConfirmModal } from './ConfirmModal.jsx';

export function Checklist({ items, onAddItem, onToggleItem, onDeleteItem }) {
  const [newItemText, setNewItemText] = useState('');
  const [newSectionText, setNewSectionText] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  // Agrupar items por sección
  const sections = useMemo(() => {
    const itemsList = Array.isArray(items) ? items : [];
    const grouped = {};
    
    itemsList.forEach(item => {
      const sectionName = item.section || 'Sin sección';
      if (!grouped[sectionName]) {
        grouped[sectionName] = [];
      }
      grouped[sectionName].push(item);
    });
    
    return grouped;
  }, [items]);
  
  // Obtener secciones únicas para el dropdown
  const sectionNames = Object.keys(sections);
  
  const handleAdd = () => {
    const text = newItemText.trim();
    if (!text || text.length > 20) return;
    
    // Usar la sección seleccionada o la nueva sección
    let section = '';
    if (showNewSection && newSectionText.trim()) {
      section = newSectionText.trim();
    } else if (selectedSection) {
      section = selectedSection;
    }
    
    console.log('Agregando tarea:', text, 'en sección:', section);
    onAddItem(text, section);
    setNewItemText('');
    if (showNewSection) {
      setNewSectionText('');
      setShowNewSection(false);
    }
  };
  
  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      onDeleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };
  
  // Calcular progreso total
  const itemsList = Array.isArray(items) ? items : [];
  const totalItems = itemsList.length;
  const completedItems = itemsList.filter(i => i.completed).length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const isComplete = totalItems > 0 && completedItems === totalItems;
  
  const title = !isComplete ? '⏳ Checklist' : '✅ Checklist';
  
  return (
    <>
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        
        {/* Barra de progreso */}
        {totalItems > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progreso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: progress + '%' }}
              />
            </div>
          </div>
        )}
        
        {/* Selector de sección */}
        {!showNewSection && (
          <div className="flex gap-2 mb-2">
            <select 
              className="flex-1 px-3 py-2 text-sm text-white rounded-xl appearance-none cursor-pointer"
              style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                backgroundSize: '16px'
              }}
              value={selectedSection}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewSection(true);
                  setSelectedSection('');
                } else {
                  setSelectedSection(e.target.value);
                }
              }}
            >
              <option value="" style={{backgroundColor: '#1f2937'}}>Seleccionar sección...</option>
              {sectionNames.map(s => (
                <option key={s} value={s} style={{backgroundColor: '#1f2937'}}>{s}</option>
              ))}
              <option value="__new__" style={{backgroundColor: '#1f2937'}}>+ Nueva sección</option>
            </select>
          </div>
        )}
        
        {/* Input para nueva sección */}
        {showNewSection && (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newSectionText}
              onChange={(e) => setNewSectionText(e.target.value)}
              placeholder="Nombre de la sección..."
              maxLength={15}
              className="flex-1 px-3 py-2 text-sm text-white rounded-xl"
              style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)' 
              }}
            />
            <button 
              onClick={() => setShowNewSection(false)}
              className="px-2 py-1 text-gray-400 text-xs"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Input de tarea */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Nueva tarea..."
            maxLength={20}
            className="flex-1 px-3 py-2 text-white text-sm rounded-xl"
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)' 
            }}
          />
          <button 
            onClick={handleAdd}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold"
          >
            +
          </button>
        </div>
        
        {/* Lista de secciones y tareas */}
        <div className="space-y-4">
          {sectionNames.length === 0 ? (
            <p className="text-gray-500 text-center text-sm py-2">Sin tareas</p>
          ) : (
            sectionNames.map(sectionName => (
              <div key={sectionName}>
                <h4 className="text-sm font-bold text-amber-400 mb-1">{sectionName}</h4>
                <div className="space-y-1 pl-2">
                  {sections[sectionName].map((item) => (
                    <ItemRow 
                      key={item.id}
                      item={item}
                      onToggle={() => onToggleItem(item.id)}
                      onDeleteClick={() => setItemToDelete(item)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Mensaje cuando está completo */}
        {isComplete && (
          <p className="text-center text-green-400 font-bold text-sm mt-3">
            ¡Nos podemos ir de viaje! 🎉
          </p>
        )}
      </div>
      
      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Eliminar tarea"
        message={`¿Eliminar "${itemToDelete?.text}"?`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </>
  );
}

// Componente para cada tarea
function ItemRow({ item, onToggle, onDeleteClick }) {
  const isCompleted = Boolean(item.completed);
  
  return (
    <div className="flex items-center gap-2 bg-gray-800/50 rounded p-2">
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isCompleted ? '#f97316' : 'transparent',
          borderColor: isCompleted ? '#f97316' : '#6b7280'
        }}
      >
        {isCompleted && <span style={{color: 'white', fontSize: '10px'}}>✓</span>}
      </button>
      
      {/* Texto de la tarea */}
      <span 
        onClick={onToggle}
        className="flex-1 text-sm cursor-pointer"
        style={{ 
          color: isCompleted ? '#6b7280' : 'white', 
          textDecoration: isCompleted ? 'line-through' : 'none' 
        }}
      >
        {item.text}
      </span>
      
      {/* Botón X */}
      <button
        onClick={onDeleteClick}
        style={{ color: '#6b7280' }}
        className="hover:text-red-400 text-xs px-1"
      >
        ✕
      </button>
    </div>
  );
}

export default Checklist;
