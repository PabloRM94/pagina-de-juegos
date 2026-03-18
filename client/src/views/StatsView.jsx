import { useState } from 'react';
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
import { Card } from '../components/index.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Filtra usuarios reales (no invitados - tienen ID positivo)
 */
const filterRealUsers = (users) => users.filter(u => u.id > 0);

/**
 * Vista de Estadísticas
 * Muestra gráficos y estadísticas de los contadores
 * @param {object} props
 * @param {object} props.counters - Contadores de todos los usuarios
 * @param {object} props.users - Lista de usuarios
 */
export function StatsView({ counters, users }) {
  const [chartFilter, setChartFilter] = useState({ counterType: '' });
  
  // Filtrar usuarios reales (no invitados)
  const realUsers = filterRealUsers(users);
  
  // Configuración del gráfico
  const chartData = {
    labels: realUsers.filter(u => counters[u.id]).map(u => u.name),
    datasets: [{
      label: 'Cantidad',
      data: realUsers.filter(u => counters[u.id]).map(u => {
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

  // Calcular totales
  const calculateTotals = () => {
    const totals = {
      cervezas: 0,
      banos_piscina: 0,
      agua_gas: 0,
      turbolatas: 0
    };
    
    Object.values(counters).forEach(c => {
      if (c) {
        totals.cervezas += c.cervezas || 0;
        totals.banos_piscina += c.banos_piscina || 0;
        totals.agua_gas += c.agua_gas || 0;
        totals.turbolatas += c.turbolatas || 0;
      }
    });
    
    return totals;
  };

  const totals = calculateTotals();
  const totalGeneral = totals.cervezas + totals.banos_piscina + totals.agua_gas + totals.turbolatas;

  // Encontrar líderes
  const getLeader = (counterType) => {
    if (!counterType) return null;
    
    let maxValue = -1;
    let leader = null;
    
    realUsers.forEach(u => {
      const c = counters[u.id];
      if (c && c[counterType] > maxValue) {
        maxValue = c[counterType];
        leader = { name: u.name, value: c[counterType] };
      }
    });
    
    return leader;
  };

  const leaderCervezas = getLeader('cervezas');
  const leaderTurbolatas = getLeader('turbolatas');
  const leaderAgua = getLeader('agua_gas');

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white">📊 Estadísticas</h1>
          <p className="text-gray-400">Resumen del viaje</p>
        </div>

        {/* Totales generales */}
        <Card className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30">
          <h3 className="text-xl font-bold text-white mb-4 text-center">📈 Totales</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className="text-3xl font-bold text-amber-400">{totals.cervezas}</p>
              <p className="text-gray-400 text-sm">🍺 Cervezas</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className="text-3xl font-bold text-cyan-400">{totals.banos_piscina}</p>
              <p className="text-gray-400 text-sm">🚿 Baños</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className="text-3xl font-bold text-blue-400">{totals.agua_gas}</p>
              <p className="text-gray-400 text-sm">💧 Agua Gas</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className="text-3xl font-bold text-red-400">{totals.turbolatas}</p>
              <p className="text-gray-400 text-sm">🥫 Turbolatas</p>
            </div>
          </div>
          <div className="text-center mt-4 p-3 bg-white/10 rounded-xl">
            <p className="text-2xl font-bold text-white">{totalGeneral}</p>
            <p className="text-gray-400 text-sm">Total general</p>
          </div>
        </Card>

        {/* Líderes */}
        <Card>
          <h3 className="text-xl font-bold text-white mb-4">🏆 Líderes</h3>
          <div className="space-y-3">
            {leaderCervezas && (
              <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🍺</span>
                  <span className="text-white">Más cervezas</span>
                </div>
                <span className="text-xl font-bold text-amber-400">{leaderCervezas.name} ({leaderCervezas.value})</span>
              </div>
            )}
            {leaderTurbolatas && (
              <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🥫</span>
                  <span className="text-white">Más turbolatas</span>
                </div>
                <span className="text-xl font-bold text-red-400">{leaderTurbolatas.name} ({leaderTurbolatas.value})</span>
              </div>
            )}
            {leaderAgua && (
              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💧</span>
                  <span className="text-white">Más agua con gas</span>
                </div>
                <span className="text-xl font-bold text-blue-400">{leaderAgua.name} ({leaderAgua.value})</span>
              </div>
            )}
          </div>
        </Card>

        {/* Gráfico */}
        <Card>
          <h3 className="text-xl font-bold text-white mb-4">📊 Evolución por usuario</h3>
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

        {/* Tabla de usuarios */}
        <Card>
          <h3 className="text-xl font-bold text-white mb-4">👥 Detalle por usuario</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">Usuario</th>
                  <th className="text-right py-2">🍺</th>
                  <th className="text-right py-2">🚿</th>
                  <th className="text-right py-2">💧</th>
                  <th className="text-right py-2">🥫</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {realUsers.filter(u => counters[u.id]).map(u => {
                  const c = counters[u.id] || {};
                  const total = (c.cervezas || 0) + (c.banos_piscina || 0) + (c.agua_gas || 0) + (c.turbolatas || 0);
                  return (
                    <tr key={u.id} className="text-white border-b border-gray-800">
                      <td className="py-2">{u.name}</td>
                      <td className="text-right text-amber-400">{c.cervezas || 0}</td>
                      <td className="text-right text-cyan-400">{c.banos_piscina || 0}</td>
                      <td className="text-right text-blue-400">{c.agua_gas || 0}</td>
                      <td className="text-right text-red-400">{c.turbolatas || 0}</td>
                      <td className="text-right font-bold">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default StatsView;
