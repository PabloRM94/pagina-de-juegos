import { useState } from 'react';
import { Card, Countdown, Checklist } from '../components/index.js';
import { api, ENDPOINTS } from '../api/index.js';

/**
 * Vista de espera (cuando el viaje no ha comenzado)
 * @param {object} props
 * @param {object} props.tripConfig - Configuración del viaje
 * @param {object} props.user - Usuario actual
 * @param {function} props.onConfigUpdate - Callback cuando se actualiza la config
 * @param {function} props.onNavigateToDashboard - Callback para ir al dashboard
 * @param {array} props.checklist - Lista de items de checklist
 * @param {function} props.onAddChecklistItem - Callback para agregar item
 * @param {function} props.onToggleChecklistItem - Callback para toggle item
 * @param {function} props.onDeleteChecklistItem - Callback para eliminar item
 * @param {function} props.onUpdateUserName - Callback para actualizar nombre
 */
export function WaitingView({ 
  tripConfig, 
  user, 
  onConfigUpdate, 
  onNavigateToDashboard,
  checklist,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onUpdateUserName
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  
  const handleConfigChange = async (key, value) => {
    console.log('=== CONFIG CHANGE ===');
    console.log('User:', user);
    console.log('isAdmin:', user?.isAdmin);
    console.log('Key:', key, 'Value:', value);
    
    const result = await api.post(ENDPOINTS.TRIP_CONFIG, { [key]: value });
    console.log('Result:', result);
    
    if (!result.success) {
      console.error('Error:', result.error);
      // No mostrar alert, solo logger en consola
      return;
    }
    
    const response = await api.get(ENDPOINTS.TRIP_CONFIG);
    if (response.success) {
      onConfigUpdate(response.config);
    }
  };
  
  const handleStartTrip = async () => {
    await handleConfigChange('trip_started', true);
  };
  
  const handleResetTrip = async () => {
    await handleConfigChange('trip_started', false);
  };
  
  const isAdmin = user?.isAdmin === 1 || user?.isAdmin === '1' || user?.isAdmin === true;
  
  const handleSaveName = async () => {
    if (!newName.trim() || newName.length < 2 || newName.length > 20) {
      setNameError('El nombre debe tener entre 2 y 20 caracteres');
      return;
    }
    
    const result = await onUpdateUserName(user.id, newName.trim());
    if (result.success) {
      setIsEditingName(false);
      setNameError('');
    } else {
      setNameError(result.error || 'Error al actualizar');
    }
  };
  
  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNewName(user?.name || '');
    setNameError('');
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 mb-6 shadow-2xl animate-float">
            <span className="text-5xl">⏰</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">¡El viaje se acerca!</h1>
          <p className="text-gray-400">Aún no estáis preparados para lo que viene...</p>
        </div>
        
        <Card className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border-purple-500/30">
          <p className="text-purple-300 mb-4">Tiempo restante</p>
          <Countdown
            targetDate={tripConfig?.start_date}
            onComplete={handleStartTrip}
          />
        </Card>
        
        {/* Checklist */}
        <Checklist
          items={checklist || []}
          onAddItem={onAddChecklistItem}
          onToggleItem={onToggleChecklistItem}
          onDeleteItem={onDeleteChecklistItem}
        />
        
        {/* Panel de Admin */}
        {isAdmin && (
          <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-500/30">
            <h3 className="text-xl font-bold text-white mb-4">⚙️ Configuración del Viaje</h3>
            
            <div className="space-y-3">
              <div className="text-left">
                <label className="block text-sm text-gray-400 mb-1">Fecha de inicio</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  defaultValue={tripConfig?.start_date ? tripConfig.start_date.slice(0, 16) : ''}
                  onChange={async (e) => {
                    const newDate = new Date(e.target.value).toISOString().replace('T', ' ').slice(0, 19);
                    await handleConfigChange('start_date', newDate);
                  }}
                />
              </div>
              
              <div className="text-left">
                <label className="block text-sm text-gray-400 mb-1">Fecha de fin</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  defaultValue={tripConfig?.end_date ? tripConfig.end_date.slice(0, 16) : ''}
                  onChange={async (e) => {
                    const newDate = new Date(e.target.value).toISOString().replace('T', ' ').slice(0, 19);
                    await handleConfigChange('end_date', newDate);
                  }}
                />
              </div>
              
              {/* Toggle: Solo admin o todos */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div className="text-left">
                  <p className="text-white font-medium">
                    {tripConfig?.admin_only === 1 ? '🔒 Modo solo admin' : '🌍 Modo todos'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {tripConfig?.admin_only === 1 ? 'Solo vos podés ver el dashboard' : 'Todos pueden ver el dashboard'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const currentValue = tripConfig?.admin_only === 1 ? 1 : 0;
                    const newValue = currentValue === 1 ? 0 : 1;
                    await handleConfigChange('admin_only', newValue);
                  }}
                  className={`w-12 h-6 rounded-full transition-all ${tripConfig?.admin_only === 1 ? 'bg-indigo-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${tripConfig?.admin_only === 1 ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
              
              <button className="btn-primary" onClick={handleStartTrip}>
                🚀 Iniciar Viaje Ahora
              </button>
              <button className="btn-secondary text-red-400" onClick={handleResetTrip}>
                ⏪ Reiniciar Contador
              </button>
              {onNavigateToDashboard && (
                <button className="btn-secondary w-full mt-2" onClick={onNavigateToDashboard}>
                  📊 Ver Contadores (sin iniciar viaje)
                </button>
              )}
            </div>
          </Card>
        )}
        
        <div className="text-gray-500 text-sm">
          <p>Viaje: 27-29 Marzo 2026</p>
          {isEditingName ? (
            <div className="mt-2">
              <div className="flex gap-2 justify-center items-center">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={20}
                  className="input-field w-32 text-center text-sm"
                  autoFocus
                />
                <button onClick={handleSaveName} className="btn-primary px-2 py-1 text-xs">
                  ✓
                </button>
                <button onClick={handleCancelEditName} className="btn-secondary px-2 py-1 text-xs">
                  ✕
                </button>
              </div>
              {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
            </div>
          ) : (
            <button 
              onClick={() => setIsEditingName(true)}
              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              {user?.name}
              <span className="text-xs">✏️</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WaitingView;
