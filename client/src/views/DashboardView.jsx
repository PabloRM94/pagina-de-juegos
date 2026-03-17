import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Card, CounterCard } from '../components/index.js';
import { api, ENDPOINTS } from '../api/index.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Vista del Dashboard principal
 * @param {object} props
 * @param {object} props.user - Usuario actual
 * @param {object} props.tripConfig - Configuración del viaje
 * @param {function} props.onLogout - Callback de logout
 * @param {function} props.onNavigateToGame - Callback para ir al juego
 * @param {function} props.onNavigateToWaiting - Callback para ir a la vista de espera
 * @param {object} props.counters - Contadores
 * @param {object} props.users - Usuarios
 * @param {function} props.onUpdateCounter - Callback para actualizar contador
 * @param {object} props.turboState - Estado del turbo
 * @param {function} props.onToggleTurbo - Callback para togglear turbo
 * @param {function} props.onTriggerTurbo - Callback para activar turbo
 * @param {function} props.onConfirmTurbo - Callback para confirmar turbo
 */
export function DashboardView({
  user,
  tripConfig,
  onLogout,
  onNavigateToGame,
  onNavigateToWaiting,
  counters,
  users,
  onUpdateCounter,
  turboState,
  onToggleTurbo,
  onTriggerTurbo,
  onConfirmTurbo
}) {
  const [chartFilter, setChartFilter] = useState({ counterType: '' });
  const [selectedUserId, setSelectedUserId] = useState(null);
  
  // El usuario seleccionado paraadmin (si es admin, puede elegir; si no, es el mismo)
  const isAdmin = user?.isAdmin === 1 || user?.isAdmin === true;
  const targetUserId = isAdmin && selectedUserId ? selectedUserId : user?.id;
  
  const myCounters = counters[targetUserId] || {
    cervezas: 0,
    banos_piscina: 0,
    agua_gas: 0,
    turbolatas: 0
  };
  
  const targetUser = users.find(u => u.id === turboState?.current_target_user_id);
  
  // Configuración del gráfico
  const chartData = {
    labels: users.filter(u => counters[u.id]).map(u => u.name),
    datasets: [{
      label: 'Cantidad',
      data: users.filter(u => counters[u.id]).map(u => {
        const c = counters[u.id];
        if (!c) return 0;
        return chartFilter.counterType
          ? c[chartFilter.counterType]
          : c.cervezas + c.agua_gas + c.turbolatas + c.banos_piscina;
      }),
      backgroundColor: [
        'rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)',
        'rgba(239,68,68,0.8)', 'rgba(139,92,246,0.8)', 'rgba(236,72,153,0.8)',
        'rgba(34,197,94,0.8)', 'rgba(234,179,8,0.8)', 'rgba(168,85,247,0.8)',
        'rgba(248,113,113,0.8)', 'rgba(52,211,153,0.8)', 'rgba(251,191,36,0.8)'
      ],
      borderRadius: 8
    }]
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#9ca3af' }
      },
      x: {
        ticks: { color: '#9ca3af' }
      }
    }
  };
  
  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onLogout} className="btn-secondary text-sm">Salir</button>
            <h1 className="text-2xl font-bold text-white">Dashboard Viaje</h1>
            <div className="w-16"></div>
          </div>
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
              {users.filter(u => u.id !== user?.id).map(u => (
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
        <div className="grid grid-cols-2 gap-4">
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
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 mb-4">Esperando a que el admin active...</p>
                {user?.isAdmin && (
                  <button onClick={onTriggerTurbo} className="btn-warning">
                    Activar Turbo Ahora
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="text-center">
              <p className="text-gray-400 mb-4">Turbo Lata desactivado</p>
              {user?.isAdmin && (
                <button onClick={() => onToggleTurbo(true)} className="btn-primary">
                  Activar Turbo Lata
                </button>
              )}
            </div>
          )}
          {user?.isAdmin && turboState?.active && turboState?.current_target_user_id && (
            <button onClick={onTriggerTurbo} className="btn-secondary w-full mt-4">
              Nuevo Turbo
            </button>
          )}
          {user?.isAdmin && turboState?.active && (
            <button onClick={() => onToggleTurbo(false)} className="btn-secondary w-full mt-2 text-red-400">
              Desactivar Turbo
            </button>
          )}
        </Card>
        
        {/* Configuración de admin */}
        {isAdmin && (
          <Card className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border-purple-500/30">
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
                    const result = await api.post(ENDPOINTS.TRIP_CONFIG, { start_date: newDate });
                    console.log('Start date update:', result);
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
                    const result = await api.post(ENDPOINTS.TRIP_CONFIG, { end_date: newDate });
                    console.log('End date update:', result);
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
                    console.log('Admin only toggle:', result);
                  }}
                  className={`w-12 h-6 rounded-full transition-all ${tripConfig?.admin_only === 1 ? 'bg-indigo-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${tripConfig?.admin_only === 1 ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  className="btn-primary flex-1"
                  onClick={async () => {
                    const result = await api.post(ENDPOINTS.TRIP_CONFIG, { trip_started: true });
                    console.log('Start trip:', result);
                  }}
                >
                  🚀 Iniciar Viaje
                </button>
                <button
                  className="btn-secondary flex-1"
                  onClick={async () => {
                    const result = await api.post(ENDPOINTS.TRIP_CONFIG, { trip_started: false });
                    console.log('Reset trip:', result);
                  }}
                >
                  ⏪ Reiniciar
                </button>
              </div>
              
              {onNavigateToWaiting && (
                <button
                  className="btn-secondary w-full mt-2"
                  onClick={onNavigateToWaiting}
                >
                  ⏰ Ver Cuenta Atrás
                </button>
              )}
            </div>
          </Card>
        )}
        
        {/* Gráfico */}
        <Card>
          <h3 className="text-xl font-bold text-white mb-4">📊 Evolución</h3>
          <div className="mb-4">
            <select
              className="input-field-select"
              value={chartFilter.counterType}
              onChange={e => setChartFilter(f => ({ ...f, counterType: e.target.value }))}
            >
              <option value="">Total</option>
              <option value="cervezas">Cervezas</option>
              <option value="agua_gas">Agua con Gas</option>
              <option value="turbolatas">Turbolatas</option>
              <option value="banos_piscina">Baños Piscina</option>
            </select>
          </div>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </Card>
        
        {/* Minijuegos */}
        <Card>
          <h3 className="text-xl font-bold text-white mb-4">🎮 Minijuegos</h3>
          <button className="btn-primary w-full" onClick={onNavigateToGame}>
            🎭 Juego del Escondite
          </button>
        </Card>
      </div>
    </div>
  );
}

export default DashboardView;
