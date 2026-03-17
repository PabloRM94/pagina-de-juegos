import { Card } from '../components/index.js';
import { api, ENDPOINTS } from '../api/index.js';

/**
 * Vista de Admin
 * Configuración del viaje y Turbo Lata
 * @param {object} props
 * @param {object} props.user - Usuario actual
 * @param {object} props.tripConfig - Configuración del viaje
 * @param {object} props.turboState - Estado del turbo
 * @param {function} props.onConfigUpdate - Callback para actualizar config
 * @param {function} props.onToggleTurbo - Callback para togglear turbo
 * @param {function} props.onTriggerTurbo - Callback para activar turbo
 * @param {function} props.onNavigateToWaiting - Callback para ir a cuenta atrás
 */
export function AdminView({
  user,
  tripConfig,
  turboState,
  onConfigUpdate,
  onToggleTurbo,
  onTriggerTurbo,
  onNavigateToWaiting
}) {
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

  const targetUser = user?.id === turboState?.current_target_user_id 
    ? user 
    : null;

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
