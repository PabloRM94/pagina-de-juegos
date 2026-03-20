import { useState } from 'react';
import { Card } from '../components/index.js';
import { api, ENDPOINTS } from '../api/index.js';

/**
 * Vista de Admin
 * Configuración del viaje y Turbo Lata
 * @param {object} props
 * @param {object} props.user - Usuario actual
 * @param {object} props.users - Lista de usuarios
 * @param {array} props.counterTypes - Tipos de contadores disponibles
 * @param {object} props.tripConfig - Configuración del viaje
 * @param {object} props.turboState - Estado del turbo
 * @param {function} props.onConfigUpdate - Callback para actualizar config
 * @param {function} props.onToggleTurbo - Callback para togglear turbo
 * @param {function} props.onTriggerTurbo - Callback para activar turbo
 * @param {function} props.onCancelTurbo - Callback para cancelar turbo
 * @param {function} props.onConfigTurbo - Callback para configurar turbo
 * @param {function} props.onCreateCounterType - Callback para crear tipo de contador
 * @param {function} props.onDeleteCounterType - Callback para eliminar tipo de contador
 * @param {function} props.onNavigateToWaiting - Callback para ir a cuenta atrás
 */
export function AdminView({
  user,
  users,
  counterTypes,
  tripConfig,
  turboState,
  onConfigUpdate,
  onToggleTurbo,
  onTriggerTurbo,
  onCancelTurbo,
  onConfigTurbo,
  onCreateCounterType,
  onDeleteCounterType,
  onNavigateToWaiting
}) {
  const [newCounterName, setNewCounterName] = useState('');
  const [newCounterIcon, setNewCounterIcon] = useState('🔢');
  const [showAddCounter, setShowAddCounter] = useState(false);
  // Solo admins pueden ver esta vista
  if (!user?.isAdmin) {
    return (
      <div className="p-4 pb-24">
        <div className="max-w-md mx-auto text-center pt-10">
          <p className="text-gray-400">No tienes acceso a esta sección</p>
        </div>
      </div>
    );
  }

  // Buscar el usuario objetivo del turbo
  const targetUser = users?.find(u => u.id === turboState?.current_target_user_id);

  return (
    <div className="p-4 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white">⚙️ Admin</h1>
          <p className="text-gray-400">Gestión del viaje</p>
        </div>
        
        {/* Configuración del Viaje */}
        <Card className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border-purple-500/30">
          <h3 className="text-xl font-bold text-white mb-4">✈️ Configuración del Viaje</h3>
          
          <div className="space-y-4">
            {/* Fecha de inicio */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha de inicio</label>
              <input
                type="datetime-local"
                className="input-field w-full"
                defaultValue={tripConfig?.start_date ? tripConfig.start_date.slice(0, 16) : ''}
                onChange={async (e) => {
                  const newDate = new Date(e.target.value).toISOString().replace('T', ' ').slice(0, 19);
                  const result = await api.post(ENDPOINTS.TRIP_CONFIG, { start_date: newDate });
                  if (result.success) {
                    onConfigUpdate({ ...tripConfig, start_date: newDate });
                  }
                }}
              />
            </div>
            
            {/* Fecha de fin */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha de fin</label>
              <input
                type="datetime-local"
                className="input-field w-full"
                defaultValue={tripConfig?.end_date ? tripConfig.end_date.slice(0, 16) : ''}
                onChange={async (e) => {
                  const newDate = new Date(e.target.value).toISOString().replace('T', ' ').slice(0, 19);
                  const result = await api.post(ENDPOINTS.TRIP_CONFIG, { end_date: newDate });
                  if (result.success) {
                    onConfigUpdate({ ...tripConfig, end_date: newDate });
                  }
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
                  const result = await api.post(ENDPOINTS.TRIP_CONFIG, { admin_only: newValue });
                  if (result.success) {
                    onConfigUpdate({ ...tripConfig, admin_only: newValue });
                  }
                }}
                className={`w-12 h-6 rounded-full transition-all ${tripConfig?.admin_only === 1 ? 'bg-indigo-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${tripConfig?.admin_only === 1 ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
              </button>
            </div>
            
            {/* Toggle: Modo Invitado */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div className="text-left">
                <p className="text-white font-medium">
                  {tripConfig?.guest_mode === 1 ? '👤 Modo invitado activo' : '👤 Modo invitado'}
                </p>
                <p className="text-gray-400 text-xs">
                  {tripConfig?.guest_mode === 1 ? 'Permite entrada sin registro' : 'Desactivado para pruebas'}
                </p>
              </div>
              <button
                onClick={async () => {
                  const currentValue = tripConfig?.guest_mode === 1 ? 1 : 0;
                  const newValue = currentValue === 1 ? 0 : 1;
                  const result = await api.post(ENDPOINTS.TRIP_CONFIG, { guest_mode: newValue });
                  if (result.success) {
                    onConfigUpdate({ ...tripConfig, guest_mode: newValue });
                  }
                }}
                className={`w-12 h-6 rounded-full transition-all ${tripConfig?.guest_mode === 1 ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${tripConfig?.guest_mode === 1 ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
              </button>
            </div>

            {/* Toggle: Mostrar banner de PWA */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div className="text-left">
                <p className="text-white font-medium">
                  {tripConfig?.show_pwa_banner === 0 ? '📱 Banner PWA oculto' : '📱 Banner PWA visible'}
                </p>
                <p className="text-gray-400 text-xs">
                  {tripConfig?.show_pwa_banner === 0 ? 'No se muestra el banner de instalación' : 'Muestra el banner para instalar la app'}
                </p>
              </div>
              <button
                onClick={async () => {
                  const currentValue = tripConfig?.show_pwa_banner === 0 ? 0 : 1;
                  const newValue = currentValue === 1 ? 0 : 1;
                  const result = await api.post(ENDPOINTS.TRIP_CONFIG, { show_pwa_banner: newValue });
                  if (result.success) {
                    onConfigUpdate({ ...tripConfig, show_pwa_banner: newValue });
                  }
                }}
                className={`w-12 h-6 rounded-full transition-all ${tripConfig?.show_pwa_banner !== 0 ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${tripConfig?.show_pwa_banner !== 0 ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
              </button>
            </div>

            {/* Botones de control */}
            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                onClick={async () => {
                  const result = await api.post(ENDPOINTS.TRIP_CONFIG, { trip_started: true });
                  if (result.success) {
                    onConfigUpdate({ ...tripConfig, trip_started: true });
                  }
                }}
              >
                🚀 Iniciar Viaje
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={async () => {
                  const result = await api.post(ENDPOINTS.TRIP_CONFIG, { trip_started: false });
                  if (result.success) {
                    onConfigUpdate({ ...tripConfig, trip_started: false });
                  }
                }}
              >
                ⏪ Reiniciar
              </button>
            </div>
            
            {/* Ver cuenta atrás */}
            {onNavigateToWaiting && (
              <button
                className="btn-secondary w-full"
                onClick={onNavigateToWaiting}
              >
                ⏰ Ver Cuenta Atrás
              </button>
            )}
          </div>
        </Card>
        
        {/* Gestión de Contadores */}
        <Card className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">📊 Contadores</h3>
            <button
              onClick={() => setShowAddCounter(!showAddCounter)}
              className="text-green-400 font-bold text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {showAddCounter ? '✕' : '+'}
            </button>
          </div>
          
          {showAddCounter && (
            <div className="mb-4 p-3 bg-white/5 rounded-xl space-y-3">
              <input
                type="text"
                placeholder="Nombre del contador"
                className="input-field w-full"
                value={newCounterName}
                onChange={(e) => setNewCounterName(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  className="input-field flex-1"
                  value={newCounterIcon}
                  onChange={(e) => setNewCounterIcon(e.target.value)}
                >
                  <option value="🔢">🔢 Números</option>
                  <option value="🍕">🍕 Pizza</option>
                  <option value="☕">☕ Café</option>
                  <option value="🍷">🍷 Vino</option>
                  <option value="🥤">🥤 Trago</option>
                  <option value="🍔">🍔 Hamburguesa</option>
                  <option value="🎮">🎮 Videojuego</option>
                  <option value="⚽">⚽ Fútbol</option>
                  <option value="🏊">🏊 Natación</option>
                  <option value="🚬">🚬 Cigarrillo</option>
                  <option value="💊">💊 Pastilla</option>
                </select>
                <button
                  onClick={async () => {
                    if (newCounterName.trim()) {
                      await onCreateCounterType(newCounterName, newCounterIcon);
                      setNewCounterName('');
                      setNewCounterIcon('🔢');
                      setShowAddCounter(false);
                    }
                  }}
                  className="btn-primary"
                >
                  Añadir
                </button>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            {counterTypes?.filter(c => !c.is_fixed).map(counter => (
              <div key={counter.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{counter.icon}</span>
                  <span className="text-white">{counter.name}</span>
                </div>
                <button
                  onClick={() => onDeleteCounterType(counter.id)}
                  className="text-red-400 hover:text-red-300 text-2xl p-2 cursor-pointer"
                >
                  🗑️
                </button>
              </div>
            ))}
            {(!counterTypes || counterTypes.filter(c => !c.is_fixed).length === 0) && (
              <p className="text-gray-400 text-sm text-center py-2">
                No hay contadores personalizados
              </p>
            )}
          </div>
        </Card>
        
        {/* Turbo Lata */}
        <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-500/30">
          <h3 className="text-xl font-bold text-white mb-4">🥫 Turbo Lata</h3>
          
          <div className="space-y-4">
            {/* Toggle activo */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <p className="text-white font-medium">
                {turboState?.active ? '✅ Turbo Activo' : '❌ Turbo Inactivo'}
              </p>
              <button
                onClick={() => onToggleTurbo(!turboState?.active)}
                className={`w-12 h-6 rounded-full transition-all ${turboState?.active ? 'bg-red-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${turboState?.active ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
              </button>
            </div>
            
            {/* Configuración de confirmaciones requeridas */}
            <div className="p-3 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-white font-medium">Confirmaciones requeridas:</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onConfigTurbo(turboState?.required_confirmations - 1)}
                    disabled={turboState?.required_confirmations <= 1}
                    className="w-8 h-8 rounded-full bg-gray-600 text-white font-bold disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="text-white font-bold text-xl w-8 text-center">
                    {turboState?.required_confirmations || 3}
                  </span>
                  <button
                    onClick={() => onConfigTurbo(turboState?.required_confirmations + 1)}
                    className="w-8 h-8 rounded-full bg-gray-600 text-white font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Cantidad de personas que deben confirmar que el target bebió
              </p>
            </div>
            
            {/* Estado actual del turbo */}
            {turboState?.active && (
              <>
                {turboState?.current_target_user_id ? (
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-red-400 text-lg mb-1">Objetivo actual:</p>
                    <p className="text-white text-2xl font-bold">{targetUser?.name || 'Cargando...'}</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {turboState.current_confirmations} / {turboState.required_confirmations} confirmaciones
                    </p>
                    <button
                      className="btn-secondary w-full mt-4"
                      onClick={onCancelTurbo}
                    >
                      ❌ Cancelar Turbo
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 mb-3">Sin objetivo seleccionado</p>
                  </div>
                )}
                
                {/* Nuevo turbo */}
                <button
                  className="btn-warning w-full"
                  onClick={onTriggerTurbo}
                >
                  🎯 Nuevo Turbo
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default AdminView;
