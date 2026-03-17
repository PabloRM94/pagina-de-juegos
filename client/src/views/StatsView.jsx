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
 * @param {array} props.counterTypes - Tipos de contadores disponibles
 */
export function StatsView({ counters, users, counterTypes }) {
  const [chartFilter, setChartFilter] = useState({ counterType: '' });
  
  const defaultCounterTypes = [
    { slug: 'cervezas', name: 'Cervezas', icon: '🍺' },
    { slug: 'banos_piscina', name: 'Baños Piscina', icon: '🚿' },
    { slug: 'agua_gas', name: 'Agua con Gas', icon: '💧' },
    { slug: 'turbolatas', name: 'Turbolatas', icon: '🥫' }
  ];
  
  const allCounterTypes = counterTypes || defaultCounterTypes;
  
  const getCustomCounters = (counter) => {
    if (!counter || !counter.custom_counters) return {};
    try {
      return JSON.parse(counter.custom_counters);
    } catch {
      return {};
    }
  };
  
  const getCounterValue = (counter, slug) => {
    const customCounters = getCustomCounters(counter);
    if (['cervezas', 'banos_piscina', 'agua_gas', 'turbolatas'].includes(slug)) {
      return counter?.[slug] || 0;
    }
    return customCounters[slug] || 0;
  };
  
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
        if (chartFilter.counterType) {
          return getCounterValue(c, chartFilter.counterType);
        }
        return allCounterTypes.reduce((sum, ct) => sum + getCounterValue(c, ct.slug), 0);
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
    const totals = {};
    allCounterTypes.forEach(c => {
      totals[c.slug] = 0;
    });
    
    Object.values(counters).forEach(c => {
      if (c) {
        allCounterTypes.forEach(counterType => {
          totals[counterType.slug] += getCounterValue(c, counterType.slug);
        });
      }
    });
    
    return totals;
  };

  const totals = calculateTotals();
  const totalGeneral = Object.values(totals).reduce((a, b) => a + b, 0);

  // Encontrar líderes
  const getLeader = (counterType) => {
    if (!counterType) return null;
    
    let maxValue = -1;
    let leader = null;
    
    realUsers.forEach(u => {
      const c = counters[u.id];
      if (c) {
        const value = getCounterValue(c, counterType);
        if (value > maxValue) {
          maxValue = value;
          leader = { name: u.name, value };
        }
      }
    });
    
    return leader;
  };

  // Obtener líderes de todos los contadores
  const leaders = allCounterTypes
    .map(counterType => ({
      ...counterType,
      leader: getLeader(counterType.slug)
    }))
    .filter(c => c.leader && c.leader.value > 0);

  // Colores para contadores
  const counterColors = {
    cervezas: 'text-amber-400',
    banos_piscina: 'text-cyan-400',
    agua_gas: 'text-blue-400',
    turbolatas: 'text-red-400'
  };

  const getCounterColor = (slug) => counterColors[slug] || 'text-green-400';

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
          <div className={`grid gap-4 ${allCounterTypes.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
            {allCounterTypes.map(counter => (
              <div key={counter.slug} className="text-center p-3 bg-white/5 rounded-xl">
                <p className={`text-3xl font-bold ${getCounterColor(counter.slug)}`}>{totals[counter.slug] || 0}</p>
                <p className="text-gray-400 text-sm">{counter.icon} {counter.name}</p>
              </div>
            ))}
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
            {leaders.map(item => (
              <div key={item.slug} className={`flex items-center justify-between p-3 rounded-xl ${getCounterColor(item.slug).replace('text-', 'bg-').replace('400', '500/10')}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-white">Más {item.name.toLowerCase()}</span>
                </div>
                <span className={`text-xl font-bold ${getCounterColor(item.slug)}`}>{item.leader.name} ({item.leader.value})</span>
              </div>
            ))}
            {leaders.length === 0 && (
              <p className="text-gray-400 text-center py-4">No hay datos suficientes para mostrar líderes</p>
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
              {allCounterTypes.map(c => (
                <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
              ))}
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
                  {allCounterTypes.map(c => (
                    <th key={c.slug} className="text-right py-2">{c.icon}</th>
                  ))}
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {realUsers.filter(u => counters[u.id]).map(u => {
                  const c = counters[u.id] || {};
                  const total = allCounterTypes.reduce((sum, ct) => sum + getCounterValue(c, ct.slug), 0);
                  return (
                    <tr key={u.id} className="text-white border-b border-gray-800">
                      <td className="py-2">{u.name}</td>
                      {allCounterTypes.map(counterType => (
                        <td key={counterType.slug} className="text-right">
                          {getCounterValue(c, counterType.slug)}
                        </td>
                      ))}
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
