import { useState } from 'react';
import { Card, CounterCard } from '../components/index.js';

/**
 * Filtra usuarios reales (no invitados - tienen ID positivo)
 */
const filterRealUsers = (users) => users.filter(u => u.id > 0);

/**
 * Vista del Dashboard principal (Simplificado)
 * Solo contadores y Turbo Lata
 * @param {object} props
 * @param {object} props.user - Usuario actual
 * @param {object} props.counters - Contadores
 * @param {object} props.users - Usuarios
 * @param {function} props.onUpdateCounter - Callback para actualizar contador
 * @param {object} props.turboState - Estado del turbo
 * @param {function} props.onToggleTurbo - Callback para togglear turbo
 * @param {function} props.onTriggerTurbo - Callback para activar turbo
 * @param {function} props.onConfirmTurbo - Callback para confirmar turbo
 * @param {function} props.onCancelTurbo - Callback para cancelar turbo
 */
export function DashboardView({
  user,
  counters,
  users,
  onUpdateCounter,
  turboState,
  onToggleTurbo,
  onTriggerTurbo,
  onConfirmTurbo,
  onCancelTurbo
}) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  
  // Filtrar usuarios reales (no invitados)
  const realUsers = filterRealUsers(users);
  
  // El usuario seleccionado para admin (si es admin, puede elegir; si no, es el mismo)
  const isAdmin = user?.isAdmin === 1 || user?.isAdmin === true;
  const targetUserId = isAdmin && selectedUserId ? selectedUserId : user?.id;
  
  // No mostrar contadores si es invitado
  if (user?.isGuest) {
    return (
      <div className="p-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center pt-4">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400">Bienvenido, {user?.name}</p>
          </div>
          
          <Card className="bg-gray-800/50 border-gray-700">
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-white mb-2">Modo Invitado</h3>
              <p className="text-gray-400 text-sm">
                Los invitados no tienen contadores.<br/>
                ¡Podés jugar a los minijuegos!
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  
  const myCounters = counters[targetUserId] || {
    cervezas: 0,
    banos_piscina: 0,
    agua_gas: 0,
    turbolatas: 0
  };
  
  const targetUser = realUsers.find(u => u.id === turboState?.current_target_user_id);
  
  return (
    <div className="p-4 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400">Bienvenido, {user?.name}</p>
        </div>
        
        {/* Selector de usuario para admin */}
        {isAdmin && (
          <Card className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30">
            <h3 className="text-white font-bold mb-3">👤 Gestionar contadores de:</h3>
            <select
              className="input-field-select"
              value={selectedUserId || user?.id}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
            >
              <option value={user?.id}>Mis contadores</option>
              {realUsers.filter(u => u.id !== user?.id).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {selectedUserId && selectedUserId !== user?.id && (
              <button
                className="btn-secondary w-full mt-2 text-sm"
                onClick={() => setSelectedUserId(null)}
              >
                Volver a mis contadores
              </button>
            )}
          </Card>
        )}
        
        {/* Contadores */}
        <div className="grid grid-cols-2 gap-3">
          <CounterCard
            title="Cervezas"
            icon="🍺"
            value={myCounters.cervezas}
            onInc={() => onUpdateCounter(targetUserId, 'cervezas', 'increment')}
            onDec={() => onUpdateCounter(targetUserId, 'cervezas', 'decrement')}
            color="bg-amber-500/10"
          />
          <CounterCard
            title="Baños Piscina"
            icon="🚿"
            value={myCounters.banos_piscina}
            onInc={() => onUpdateCounter(targetUserId, 'banos_piscina', 'increment')}
            onDec={() => onUpdateCounter(targetUserId, 'banos_piscina', 'decrement')}
            color="bg-cyan-500/10"
          />
          <CounterCard
            title="Agua con Gas"
            icon="💧"
            value={myCounters.agua_gas}
            onInc={() => onUpdateCounter(targetUserId, 'agua_gas', 'increment')}
            onDec={() => onUpdateCounter(targetUserId, 'agua_gas', 'decrement')}
            color="bg-blue-500/10"
          />
          <CounterCard
            title="Turbolatas"
            icon="🥫"
            value={myCounters.turbolatas}
            onInc={() => onUpdateCounter(targetUserId, 'turbolatas', 'increment')}
            onDec={() => onUpdateCounter(targetUserId, 'turbolatas', 'decrement')}
            color="bg-red-500/10"
          />
        </div>
        
        {/* Turbo Lata */}
        <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-500/30">
          <h3 className="text-xl font-bold text-white mb-4">🥫 Turbo Lata</h3>
          {turboState?.active ? (
            turboState?.current_target_user_id ? (
              <div className="text-center">
                <p className="text-red-400 text-lg mb-2">¡Alguien tiene que beber!</p>
                <p className="text-white text-2xl font-bold mb-4">{targetUser?.name}</p>
                <p className="text-gray-400 mb-4">
                  {turboState.current_confirmations} / {turboState.required_confirmations} confirmaciones
                </p>
                {user?.id !== turboState.current_target_user_id && (
                  <button onClick={onConfirmTurbo} className="btn-primary">
                    Confirmar que lo bebió
                  </button>
                )}
                {isAdmin && (
                  <button onClick={onCancelTurbo} className="btn-secondary mt-2 w-full">
                    ❌ Cancelar Turbo
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse">🎲</div>
                <p className="text-yellow-400 text-lg mb-2">¡Elegiendo víctima!</p>
                <p className="text-gray-400 text-sm">Alguien será elegido en cualquier momento...</p>
                {user?.isAdmin && (
                  <button onClick={onTriggerTurbo} className="btn-warning mt-4">
                    🎯 Forzar Selección
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="text-center">
              <div className="text-5xl mb-4">😴</div>
              <p className="text-gray-400 text-lg mb-2">Turbo Lata en reposo</p>
              <p className="text-gray-500 text-sm mb-4">
                Cuando se active, alguien será elegido al azar para beber
              </p>
              <div className="flex justify-center gap-2">
                <div className="px-4 py-2 bg-white/5 rounded-lg">
                  <span className="text-gray-400 text-sm">Tus turbolatas:</span>
                  <span className="text-red-400 font-bold text-2xl ml-2">{myCounters.turbolatas}</span>
                </div>
              </div>
              {user?.isAdmin && (
                <button onClick={() => onToggleTurbo(true)} className="btn-primary mt-4">
                  🚀 Activar Turbo Lata
                </button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default DashboardView;
