import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const getSocket = (() => {
  let socket = null;
  return () => {
    if (!socket) socket = io(SERVER_URL);
    return socket;
  };
})();

const VIEWS = {
  LOGIN: 'login',
  REGISTER: 'register',
  DASHBOARD: 'dashboard',
  GAME: 'game',
  GAME_LOBBY: 'game-lobby',
  HIDDEN: 'hidden',
  ENCOUNTER_RESULT: 'encounter-result'
};

const AVATAR_STYLES = [
  { id: 'adventurer', name: 'Aventurero' },
  { id: 'avataaars', name: 'Avatar' },
  { id: 'big-smile', name: 'Sonriente' },
  { id: 'micah', name: 'Micah' },
  { id: 'open-peeps', name: 'Minimalista' },
  { id: 'thumbs', name: 'Thumbnails' }
];

const getAvatarUrl = (style, seed) => `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;

function Avatar({ src, alt, size = 'md', className = '' }) {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-20 h-20', xl: 'w-32 h-32' };
  return <img src={src} alt={alt} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/20 shadow-lg ${className}`} />;
}

function Card({ children, className = '' }) {
  return <div className={`glass-card p-6 ${className}`}>{children}</div>;
}

function StatusBadge({ status }) {
  const cls = { waiting: 'status-waiting', hidden: 'status-hidden', eliminated: 'status-eliminated' };
  const lbl = { waiting: 'Visible', hidden: 'Escondido', eliminated: 'Eliminado' };
  return <span className={`status-badge ${cls[status]}`}>{lbl[status]}</span>;
}

function AvatarSelector({ selectedStyle, onSelect }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">Estilo de avatar</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {AVATAR_STYLES.map(s => (
          <button key={s.id} onClick={() => onSelect(s.id)}
            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${selectedStyle === s.id ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-60 hover:opacity-100'}`}>
            <img src={getAvatarUrl(s.id, 'preview')} alt={s.name} className="w-full h-full" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Countdown({ targetDate, onComplete }) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff > 0) {
        return { days: Math.floor(diff / (1000*60*60*24)), hours: Math.floor((diff/(1000*60*60))%24), minutes: Math.floor((diff/1000/60)%60), seconds: Math.floor((diff/1000)%60) };
      }
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };
    setTime(calc());
    const t = setInterval(() => { const nt = calc(); setTime(nt); if(nt.days===0 && nt.hours===0 && nt.minutes===0 && nt.seconds===0){ onComplete(); clearInterval(t); } }, 1000);
    return () => clearInterval(t);
  }, [targetDate, onComplete]);
  
  return (
    <div className="flex justify-center gap-4">
      {Object.entries(time).map(([u, v]) => (
        <div key={u} className="text-center">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-4 min-w-[80px]">
            <span className="text-4xl font-bold text-white">{String(v).padStart(2,'0')}</span>
          </div>
          <p className="text-gray-400 text-sm mt-2 capitalize">{u}</p>
        </div>
      ))}
    </div>
  );
}

function CounterCard({ title, icon, value, onInc, onDec, color }) {
  return (
    <Card className={`${color}`}>
      <div className="text-center">
        <div className="text-4xl mb-2">{icon}</div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-5xl font-bold text-white my-4">{value}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onDec} className="btn-secondary px-4">-</button>
          <button onClick={onInc} className="btn-primary px-4">+</button>
        </div>
      </div>
    </Card>
  );
}

export default function App() {
  const [view, setView] = useState(VIEWS.LOGIN);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tripConfig, setTripConfig] = useState(null);
  const [counters, setCounters] = useState({});
  const [users, setUsers] = useState([]);
  const [turboState, setTurboState] = useState(null);
  const [chartFilter, setChartFilter] = useState({ counterType: '' });
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [playerName, setPlayerName] = useState('');
  const [avatarStyle, setAvatarStyle] = useState('adventurer');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [pendingEncounters, setPendingEncounters] = useState({});
  const [lastEncounter, setLastEncounter] = useState(null);
  const [encounterDenied, setEncounterDenied] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  const socket = getSocket();
  
  const api = async (ep, opts = {}) => {
    const r = await fetch(`${SERVER_URL}${ep}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers }
    });
    return r.json();
  };
  
  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const [c, ct, u, t] = await Promise.all([api('/api/trip/config'), api('/api/counters'), api('/api/users'), api('/api/turbo/state')]);
        if (c.success) setTripConfig(c.config);
        if (ct.success) { const m = {}; ct.counters.forEach(x => m[x.user_id] = x); setCounters(m); }
        if (u.success) setUsers(u.users);
        if (t.success) setTurboState(t.turboState);
      } catch (e) { console.error(e); }
    };
    load();
  }, [token]);
  
  useEffect(() => {
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    
    socket.on('counter-updated', async () => {
      const r = await api('/api/counters');
      if (r.success) { const m = {}; r.counters.forEach(x => m[x.user_id] = x); setCounters(m); }
    });
    
    socket.on('turbo-state-changed', d => setTurboState(p => ({ ...p, active: d.active })));
    socket.on('turbo-triggered', d => setTurboState(p => ({ ...p, current_target_user_id: d.targetUserId, current_confirmations: 0 })));
    socket.on('turbo-confirmation-updated', d => setTurboState(p => ({ ...p, current_confirmations: d.currentConfirmations })));
    socket.on('turbo-completed', async () => {
      const r = await api('/api/turbo/state');
      if (r.success) setTurboState(r.turboState);
      const cr = await api('/api/counters');
      if (cr.success) { const m = {}; cr.counters.forEach(x => m[x.user_id] = x); setCounters(m); }
    });
    
    socket.on('room-updated', ur => { setRoom(ur); const me = ur.players.find(p => p.id === player?.id); if (me) setPlayer(me); });
    socket.on('encounter-proposed', d => setPendingEncounters(p => ({ ...p, [d.encounterId]: d })));
    socket.on('encounter-cancelled', d => { setPendingEncounters(p => { const n = {...p}; delete n[d.encounterId]; return n; }); });
    socket.on('encounter-resolved', r => { setLastEncounter(r); setView(VIEWS.ENCOUNTER_RESULT); setPendingEncounters({}); });
    socket.on('encounter-denied', d => { setEncounterDenied(d); setPendingEncounters(p => { const n = {...p}; delete n[d.encounterId]; return n; }); });
    
    return () => { ['connect','disconnect','counter-updated','turbo-state-changed','turbo-triggered','turbo-confirmation-updated','turbo-completed','room-updated','encounter-proposed','encounter-cancelled','encounter-resolved','encounter-denied'].forEach(e => socket.off(e)); };
  }, [socket, token, player]);
  
  const handleRegister = async () => {
    setIsLoading(true); setError('');
    const r = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: username, password }) });
    setIsLoading(false);
    if (r.success) { setToken(r.token); setUser(r.user); setView(VIEWS.DASHBOARD); }
    else setError(r.error);
  };
  
  const handleLogin = async () => {
    setIsLoading(true); setError('');
    const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ name: username, password }) });
    setIsLoading(false);
    if (r.success) { setToken(r.token); setUser(r.user); setView(VIEWS.DASHBOARD); }
    else setError(r.error);
  };
  
  const handleCounter = async (uid, ct, act) => {
    await api(`/api/counters/${uid}`, { method: 'POST', body: JSON.stringify({ counterType: ct, action: act }) });
  };
  
  const toggleTurbo = async (a) => {
    await api('/api/turbo/toggle', { method: 'POST', body: JSON.stringify({ active: a }) });
  };
  
  const triggerTurbo = async () => {
    await api('/api/turbo/trigger', { method: 'POST' });
  };
  
  const confirmTurbo = async () => {
    await api('/api/turbo/confirm', { method: 'POST' });
  };
  
  const chartData = {
    labels: users.filter(u => counters[u.id]).map(u => u.name),
    datasets: [{
      label: 'Cantidad',
      data: users.filter(u => counters[u.id]).map(u => {
        const c = counters[u.id];
        if (!c) return 0;
        return chartFilter.counterType ? c[chartFilter.counterType] : c.cervezas + c.agua_gas + c.turbolatas + c.banos_piscina;
      }),
      backgroundColor: ['rgba(59,130,246,0.8)','rgba(16,185,129,0.8)','rgba(245,158,11,0.8)','rgba(239,68,68,0.8)','rgba(139,92,246,0.8)','rgba(236,72,153,0.8)','rgba(34,197,94,0.8)','rgba(234,179,8,0.8)','rgba(168,85,247,0.8)','rgba(248,113,113,0.8)','rgba(52,211,153,0.8)','rgba(251,191,36,0.8)'],
      borderRadius: 8
    }]
  };
  
  const getAvatarSeed = () => avatarSeed.trim() || playerName.trim() || Math.random().toString(36).substring(7);
  const getMyAvatarUrl = () => getAvatarUrl(avatarStyle, getAvatarSeed());
  const getPlayerAvatarUrl = (n) => getAvatarUrl(avatarStyle, n);
  
  const createRoom = () => {
    if (!playerName.trim()) { setError('Ingresa tu nombre'); return; }
    socket.emit('create-room', {}, r => {
      if (r.success) {
        socket.emit('join-room', { roomId: r.roomId, playerName: playerName.trim(), avatarStyle, avatarSeed: getAvatarSeed() }, jr => {
          if (jr.success) { setRoom(jr.room); setPlayer(jr.player); setView(VIEWS.GAME_LOBBY); }
        });
      }
    });
  };
  
  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    socket.emit('join-room', { roomId: roomCode.trim().toUpperCase(), playerName: playerName.trim(), avatarStyle, avatarSeed: getAvatarSeed() }, r => {
      if (r.success) { setRoom(r.room); setPlayer(r.player); setView(r.room.state === 'playing' ? VIEWS.GAME : VIEWS.GAME_LOBBY); }
    });
  };
  
  const setHidden = () => {
    socket.emit('set-hidden', { roomId: room.id }, r => { if (r.success) { setRoom(r.room); setView(VIEWS.HIDDEN); } });
  };
  
  const proposeEncounter = () => {
    socket.emit('propose-encounter', { roomId: room.id, opponentId: selectedOpponent }, r => { if (r.success) setSelectedOpponent(''); });
  };
  
  const confirmEncounter = (eid) => { socket.emit('confirm-encounter', { roomId: room.id, encounterId: eid }, () => {}); };
  const denyEncounter = (eid) => { socket.emit('deny-encounter', { roomId: room.id, encounterId: eid }, () => {}); };
  
  const currentPlayer = room?.players?.find(p => p.id === player?.id);
  const aliveOpponents = room?.players?.filter(p => p.id !== player?.id && p.isAlive && !p.eliminated) || [];
  
  // ==================== LOGIN / REGISTER ====================
  if (view === VIEWS.LOGIN || view === VIEWS.REGISTER) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-2xl">
              <span className="text-5xl">🏖️</span>
            </div>
            <h1 className="text-4xl font-bold gradient-text mb-2">Viaje 2026</h1>
            <p className="text-gray-400">{view === VIEWS.LOGIN ? 'Iniciá sesión' : 'Creá tu cuenta'}</p>
          </div>
          <Card>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Nombre</label>
              <input type="text" className="input-field" placeholder="Tu nombre" value={username} onChange={e => setUsername(e.target.value)} disabled={isLoading} />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
              <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} />
            </div>
            {error && <p className="text-red-400 text-center mb-4 text-sm bg-red-500/10 p-3 rounded-lg">{error}</p>}
            <div className="space-y-3">
              <button className="btn-primary w-full" onClick={view === VIEWS.LOGIN ? handleLogin : handleRegister} disabled={isLoading}>
                {isLoading ? 'Cargando...' : view === VIEWS.LOGIN ? 'Iniciar Sesión' : 'Registrarse'}
              </button>
              <button className="btn-secondary w-full" onClick={() => setView(view === VIEWS.LOGIN ? VIEWS.REGISTER : VIEWS.LOGIN)}>
                {view === VIEWS.LOGIN ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  
  // ==================== WAITING (COUNTDOWN) ====================
  if (!tripConfig?.trip_started) {
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
            <Countdown targetDate={tripConfig?.start_date} onComplete={async () => {
              await api('/api/trip/config', { method: 'POST', body: JSON.stringify({ trip_started: true }) });
              const r = await api('/api/trip/config');
              if (r.success) setTripConfig(r.config);
            }} />
          </Card>
          
          {/* Panel de Admin para configurar viaje */}
          {user?.isAdmin && (
            <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-500/30">
              <h3 className="text-xl font-bold text-white mb-4">⚙️ Configuración del Viaje</h3>
              <div className="space-y-3">
                <button 
                  className="btn-primary"
                  onClick={async () => {
                    await api('/api/trip/config', { method: 'POST', body: JSON.stringify({ trip_started: true }) });
                    const r = await api('/api/trip/config');
                    if (r.success) setTripConfig(r.config);
                  }}
                >
                  🚀 Iniciar Viaje Ahora
                </button>
                <button 
                  className="btn-secondary text-red-400"
                  onClick={async () => {
                    await api('/api/trip/config', { method: 'POST', body: JSON.stringify({ trip_started: false }) });
                    const r = await api('/api/trip/config');
                    if (r.success) setTripConfig(r.config);
                  }}
                >
                  ⏪ Reiniciar Contador
                </button>
              </div>
            </Card>
          )}
          
          <div className="text-gray-500 text-sm">
            <p>Viaje: 27-29 Marzo 2026</p>
            <p>Usuario: {user?.name}</p>
          </div>
        </div>
      </div>
    );
  }
  
  // ==================== DASHBOARD ====================
  if (view === VIEWS.DASHBOARD) {
    const myC = counters[user?.id] || { cervezas: 0, banos_piscina: 0, agua_gas: 0, turbolatas: 0 };
    const targetUser = users.find(u => u.id === turboState?.current_target_user_id);
    
    return (
      <div className="min-h-screen p-4 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center pt-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { setView(VIEWS.LOGIN); setToken(null); setUser(null); }} className="btn-secondary text-sm">Salir</button>
              <h1 className="text-2xl font-bold text-white">Dashboard Viaje</h1>
              <div className="w-16"></div>
            </div>
            <p className="text-gray-400">Bienvenido, {user?.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <CounterCard title="Cervezas" icon="🍺" value={myC.cervezas} onInc={() => handleCounter(user.id, 'cervezas', 'increment')} onDec={() => handleCounter(user.id, 'cervezas', 'decrement')} color="bg-amber-500/10" />
            <CounterCard title="Baños Piscina" icon="🚿" value={myC.banos_piscina} onInc={() => handleCounter(user.id, 'banos_piscina', 'increment')} onDec={() => handleCounter(user.id, 'banos_piscina', 'decrement')} color="bg-cyan-500/10" />
            <CounterCard title="Agua con Gas" icon="💧" value={myC.agua_gas} onInc={() => handleCounter(user.id, 'agua_gas', 'increment')} onDec={() => handleCounter(user.id, 'agua_gas', 'decrement')} color="bg-blue-500/10" />
            <CounterCard title="Turbolatas" icon="🥫" value={myC.turbolatas} onInc={() => handleCounter(user.id, 'turbolatas', 'increment')} onDec={() => handleCounter(user.id, 'turbolatas', 'decrement')} color="bg-red-500/10" />
          </div>
          
          <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-500/30">
            <h3 className="text-xl font-bold text-white mb-4">🥫 Turbo Lata</h3>
            {turboState?.active ? (
              turboState?.current_target_user_id ? (
                <div className="text-center">
                  <p className="text-red-400 text-lg mb-2">¡Alguien tiene que beber!</p>
                  <p className="text-white text-2xl font-bold mb-4">{targetUser?.name}</p>
                  <p className="text-gray-400 mb-4">{turboState.current_confirmations} / {turboState.required_confirmations} confirmaciones</p>
                  {user?.id !== turboState.current_target_user_id && <button onClick={confirmTurbo} className="btn-primary">Confirmar que lo bebió</button>}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-400 mb-4">Esperando a que el admin active...</p>
                  {user?.isAdmin && <button onClick={triggerTurbo} className="btn-warning">Activar Turbo Ahora</button>}
                </div>
              )
            ) : (
              <div className="text-center">
                <p className="text-gray-400 mb-4">Turbo Lata desactivado</p>
                {user?.isAdmin && <button onClick={() => toggleTurbo(true)} className="btn-primary">Activar Turbo Lata</button>}
              </div>
            )}
            {user?.isAdmin && turboState?.active && turboState?.current_target_user_id && <button onClick={triggerTurbo} className="btn-secondary w-full mt-4">Nuevo Turbo</button>}
            {user?.isAdmin && turboState?.active && <button onClick={() => toggleTurbo(false)} className="btn-secondary w-full mt-2 text-red-400">Desactivar Turbo</button>}
          </Card>
          
          <Card>
            <h3 className="text-xl font-bold text-white mb-4">📊 Evolución</h3>
            <div className="mb-4">
              <select className="input-field-select" value={chartFilter.counterType} onChange={e => setChartFilter(f => ({ ...f, counterType: e.target.value }))}>
                <option value="">Total</option>
                <option value="cervezas">Cervezas</option>
                <option value="agua_gas">Agua con Gas</option>
                <option value="turbolatas">Turbolatas</option>
                <option value="banos_piscina">Baños Piscina</option>
              </select>
            </div>
            <div className="h-64"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } } }} /></div>
          </Card>
          
          <Card>
            <h3 className="text-xl font-bold text-white mb-4">🎮 Minijuegos</h3>
            <button className="btn-primary w-full" onClick={() => setView(VIEWS.GAME)}>🎭 Juego del Escondite</button>
          </Card>
        </div>
      </div>
    );
  }
  
  // ==================== GAME ====================
  if (view === VIEWS.GAME || view === VIEWS.GAME_LOBBY || view === VIEWS.HIDDEN) {
    return (
      <div className="min-h-screen p-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setView(VIEWS.DASHBOARD)} className="btn-secondary">← Dashboard</button>
            <h1 className="text-xl font-bold text-white">Escondite</h1>
            <div className="w-16"></div>
          </div>
          
          {!player && (
            <Card>
              <h3 className="text-white font-bold mb-4">Tu nombre en el juego</h3>
              <div className="flex items-center gap-4 mb-4">
                <Avatar src={getMyAvatarUrl()} alt="Tu avatar" size="lg" />
                <div className="flex-1">
                  <input type="text" className="input-field mb-3" placeholder="Tu nombre" value={playerName} onChange={e => setPlayerName(e.target.value)} />
                  <AvatarSelector selectedStyle={avatarStyle} onSelect={setAvatarStyle} />
                </div>
              </div>
              <button className="btn-primary w-full mb-3" onClick={createRoom}>Crear Sala</button>
              <div className="mt-4">
                <input type="text" className="input-field text-center" placeholder="Código sala" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} maxLength={8} />
                <button className="btn-secondary w-full mt-2" onClick={joinRoom}>Unirse</button>
              </div>
            </Card>
          )}
          
          {player && room && (
            <>
              <Card>
                <div className="text-center mb-4"><p className="text-gray-400">Sala</p><div className="room-code-display">{room.id}</div></div>
                <div className="flex items-center gap-4">
                  <Avatar src={getMyAvatarUrl()} alt="Tu avatar" size="lg" />
                  <div><h2 className="text-xl font-bold text-white">{player.name}</h2><StatusBadge status={currentPlayer?.isHidden ? 'hidden' : 'waiting'} /></div>
                </div>
                {view !== VIEWS.HIDDEN && !currentPlayer?.isHidden && <button className="btn-success mt-4 w-full" onClick={setHidden}>✓ Ya estoy escondido</button>}
              </Card>
              
              {Object.values(pendingEncounters).some(e => e.targetId === player?.id) && (
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <h3 className="text-amber-400 font-semibold mb-4">⚠️ Te han propuesto un encuentro</h3>
                  {Object.values(pendingEncounters).filter(e => e.targetId === player?.id).map(enc => (
                    <div key={enc.encounterId} className="text-center">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <Avatar src={getMyAvatarUrl()} alt="Vos" size="md" /><span className="text-gray-400">vs</span><Avatar src={getPlayerAvatarUrl(enc.proposerName)} alt={enc.proposerName} size="md" />
                      </div>
                      <button className="btn-success w-full mb-2" onClick={() => confirmEncounter(enc.encounterId)}>✓ Confirmar</button>
                      <button className="btn-secondary w-full text-red-400" onClick={() => denyEncounter(enc.encounterId)}>✕ Denegar</button>
                    </div>
                  ))}
                </Card>
              )}
              
              {encounterDenied && (
                <Card className="bg-red-500/10 border-red-500/30">
                  <div className="text-center"><div className="text-4xl mb-4">🚫</div><h3 className="text-red-400 font-semibold mb-2">Encuentro Denegado</h3><p className="text-gray-300">{encounterDenied.deniedBy} ha denegado el encuentro</p><button className="btn-secondary mt-4" onClick={() => setEncounterDenied(null)}>Entendido</button></div>
                </Card>
              )}
              
              {!currentPlayer?.eliminated && Object.keys(pendingEncounters).length === 0 && (
                <Card>
                  <h3 className="section-title">Reportar Encuentro</h3>
                  <select className="input-field-select mb-4" value={selectedOpponent} onChange={e => setSelectedOpponent(e.target.value)}>
                    <option value="">Seleccionar jugador</option>
                    {aliveOpponents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button className="btn-warning w-full" onClick={proposeEncounter} disabled={!selectedOpponent}>✓ Proponer encuentro</button>
                </Card>
              )}
              
              <Card>
                <h3 className="section-title">Jugadores ({room.players.length})</h3>
                <div className="space-y-2">
                  {room.players.map(p => (
                    <div key={p.id} className="player-item">
                      <div className="flex items-center gap-3">
                        <Avatar src={getPlayerAvatarUrl(p.name)} alt={p.name} size="sm" />
                        <span className="text-white font-medium">{p.name} {p.id === player?.id && <span className="text-indigo-400">(vos)</span>}</span>
                      </div>
                      <StatusBadge status={p.eliminated ? 'eliminated' : p.isHidden ? 'hidden' : 'waiting'} />
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    );
  }
  
  // ==================== ENCOUNTER RESULT ====================
  if (view === VIEWS.ENCOUNTER_RESULT) {
    const lost = lastEncounter?.loser?.id === currentPlayer?.id;
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${lost ? 'bg-red-900/30' : ''}`}>
        <div className="w-full max-w-md">
          <Card className={`text-center ${lost ? 'border-red-500/50 bg-red-500/5' : ''}`}>
            <h2 className="text-2xl font-bold text-white mb-8">Resultado del Encuentro</h2>
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center"><Avatar src={getPlayerAvatarUrl(lastEncounter.player1.name)} alt={lastEncounter.player1.name} size="xl" className="mx-auto mb-2" /><p className="text-white font-medium">{lastEncounter.player1.name}</p></div>
              <div className="text-2xl">vs</div>
              <div className="text-center"><Avatar src={getPlayerAvatarUrl(lastEncounter.player2.name)} alt={lastEncounter.player2.name} size="xl" className="mx-auto mb-2" /><p className="text-white font-medium">{lastEncounter.player2.name}</p></div>
            </div>
            {lastEncounter.result === 'tie' ? (
              <div className="p-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl mb-6"><p className="text-3xl font-bold text-blue-300">¡Sois aliados!</p></div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="p-6 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border-2 border-emerald-500/40"><p className="text-3xl font-bold text-emerald-400">¡{lastEncounter.winner?.name} GANA!</p></div>
                <div className="p-6 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl border-2 border-red-500/30"><p className="text-2xl font-bold text-red-400">{lastEncounter.loser?.name} Eliminado</p></div>
              </div>
            )}
            <button className="btn-primary" onClick={() => { setLastEncounter(null); setView(VIEWS.GAME); }}>Continuar</button>
          </Card>
        </div>
      </div>
    );
  }
  
  return null;
}
