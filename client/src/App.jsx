import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Socket singleton - se crea una sola vez
// URL del servidor: usa variable de entorno en producción, localhost en desarrollo
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const getSocket = (() => {
  let socket = null;
  return () => {
    if (!socket) {
      socket = io(SERVER_URL);
    }
    return socket;
  };
})();

// Vistas disponibles
const VIEWS = {
  HOME: 'home',
  JOIN: 'join',
  LOBBY: 'lobby',
  HIDDEN: 'hidden',
  GAME: 'game',
  ENCOUNTER_RESULT: 'encounter-result'
};

// Avatares disponibles (estilos de DiceBear)
const AVATAR_STYLES = [
  { id: 'adventurer', name: 'Aventurero' },
  { id: 'avataaars', name: 'Avatar' },
  { id: 'big-smile', name: 'Sonriente' },
  { id: 'micah', name: 'Micah' },
  { id: 'open-peeps', name: 'Minimalista' },
  { id: 'thumbs', name: 'Thumbnails' },
];

// Generar种子 para avatares determinísticos
const getAvatarUrl = (style, seed) => {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
};

// Componente Avatar
function Avatar({ src, alt, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  };
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white/20 shadow-lg ${className}`}
    />
  );
}

// Componente Card
function Card({ children, className = '' }) {
  return (
    <div className={`glass-card p-6 ${className}`}>
      {children}
    </div>
  );
}

// Componente Badge de estado
function StatusBadge({ status }) {
  const statusClasses = {
    waiting: 'status-waiting',
    hidden: 'status-hidden',
    eliminated: 'status-eliminated'
  };
  
  const statusLabels = {
    waiting: 'Visible',
    hidden: 'Escondido',
    eliminated: 'Eliminado'
  };
  
  return (
    <span className={`status-badge ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

// Componente Selector de Avatar (minimalista)
function AvatarSelector({ selectedStyle, onSelect }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">Estilo de avatar</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {AVATAR_STYLES.map(style => (
          <button
            key={style.id}
            onClick={() => onSelect(style.id)}
            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all duration-200 ${
              selectedStyle === style.id 
                ? 'ring-2 ring-indigo-500 scale-110' 
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <img 
              src={getAvatarUrl(style.id, 'preview')}
              alt={style.name}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState(VIEWS.HOME);
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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Socket singleton
  const socket = getSocket();

  // Control de conexión del socket
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Conectado al servidor:', socket.id);
      setSocketConnected(true);
      setError('');
    });

    socket.on('disconnect', () => {
      console.log('Desconectado del servidor');
      setSocketConnected(false);
      setError('Conexión perdida. Intentando reconectar...');
    });

    socket.on('connect_error', (err) => {
      console.error('Error de conexión:', err);
      setSocketConnected(false);
      setError('No se puede conectar al servidor. Verificá que esté corriendo.');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, []);

  useEffect(() => {
    // Escuchar actualizaciones de sala
    socket.on('room-updated', (updatedRoom) => {
      setRoom(updatedRoom);
      console.log('Room updated:', updatedRoom.state);
      
      // Actualizar el jugador actual con los datos más recientes
      const me = updatedRoom.players.find(p => p.id === player?.id);
      if (me) {
        setPlayer(me);
      }
      
      // Actualizar vista según estado
      if (updatedRoom.state === 'lobby' || updatedRoom.state === 'ready') {
        const me = updatedRoom.players.find(p => p.id === player?.id);
        if (me?.isHidden) {
          setView(VIEWS.HIDDEN);
        } else {
          setView(VIEWS.LOBBY);
        }
      } else if (updatedRoom.state === 'playing') {
        const me = updatedRoom.players.find(p => p.id === player?.id);
        console.log('Playing state - me:', me);
        if (me?.isAlive && !me?.eliminated) {
          setView(VIEWS.GAME);
        } else {
          setView(VIEWS.HIDDEN);
        }
      } else if (updatedRoom.state === 'finished') {
        setView(VIEWS.HIDDEN);
      }
    });

    // Escuchar cuando todos están escondidos
    socket.on('all-hidden', (data) => {
      setRoom(data.room);
    });

    // Escuchar cuando empieza el juego
    socket.on('game-started', (data) => {
      setRoom(data.room);
      const me = data.room.players.find(p => p.id === player?.id);
      if (me?.isAlive && !me?.eliminated) {
        setView(VIEWS.GAME);
      }
    });

    // Escuchar propuesta de encuentro
    socket.on('encounter-proposed', (data) => {
      setPendingEncounters(prev => ({
        ...prev,
        [data.encounterId]: data
      }));
    });

    // Escuchar encuentro cancelado
    socket.on('encounter-cancelled', (data) => {
      setPendingEncounters(prev => {
        const updated = { ...prev };
        delete updated[data.encounterId];
        return updated;
      });
    });

    // Escuchar resultado de encuentro
    socket.on('encounter-resolved', (result) => {
      console.log('Encuentro resuelto:', result);
      setLastEncounter(result);
      setView(VIEWS.ENCOUNTER_RESULT);
      setPendingEncounters({});
      
      // Si el jugador actual fue eliminado, actualizar su estado
      if (result.loser?.id === player?.id) {
        setPlayer(prev => ({ ...prev, eliminated: true, isAlive: false }));
      }
    });

    // Escuchar encuentro denegado
    socket.on('encounter-denied', (data) => {
      console.log('Encuentro denegado:', data);
      setEncounterDenied(data);
      setPendingEncounters(prev => {
        const updated = { ...prev };
        delete updated[data.encounterId];
        return updated;
      });
    });

    return () => {
      socket.off('room-updated');
      socket.off('all-hidden');
      socket.off('game-started');
      socket.off('encounter-proposed');
      socket.off('encounter-cancelled');
      socket.off('encounter-resolved');
    };
  }, [player]);

  // Generar seed para el avatar
  const getAvatarSeed = () => {
    if (avatarSeed.trim()) return avatarSeed.trim();
    return playerName.trim() || Math.random().toString(36).substring(7);
  };

  // Obtener URL del avatar del jugador
  const getMyAvatarUrl = () => {
    return getAvatarUrl(avatarStyle, getAvatarSeed());
  };

  // Obtener avatar de otro jugador (usando su nombre como seed)
  const getPlayerAvatarUrl = (playerName) => {
    return getAvatarUrl(avatarStyle, playerName);
  };

  const createRoom = () => {
    if (!playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }
    
    if (!socketConnected) {
      setError('No hay conexión con el servidor. Esperando reconexión...');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    console.log('Creando sala...');
    socket.emit('create-room', {}, (response) => {
      console.log('Respuesta create-room:', response);
      if (response.success) {
        console.log('Sala creada:', response.roomId);
        socket.emit('join-room', { 
          roomId: response.roomId, 
          playerName: playerName.trim(),
          avatarStyle: avatarStyle,
          avatarSeed: getAvatarSeed()
        }, (joinResponse) => {
          console.log('Respuesta join-room:', joinResponse);
          setIsLoading(false);
          if (joinResponse.success) {
            setRoom(joinResponse.room);
            setPlayer(joinResponse.player);
            setView(VIEWS.LOBBY);
            setError('');
          } else {
            setError(joinResponse.error || 'Error al unirse a la sala');
          }
        });
      } else {
        setIsLoading(false);
        setError(response.error || 'Error al crear la sala');
      }
    });
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) {
      setError('Ingresa tu nombre y el código de sala');
      return;
    }
    
    socket.emit('join-room', { 
      roomId: roomCode.trim().toUpperCase(), 
      playerName: playerName.trim(),
      avatarStyle: avatarStyle,
      avatarSeed: getAvatarSeed()
    }, (response) => {
      if (response.success) {
        setRoom(response.room);
        setPlayer(response.player);
        // Determinar vista según estado
        if (response.room.state === 'lobby' || response.room.state === 'ready') {
          if (response.player.isHidden) {
            setView(VIEWS.HIDDEN);
          } else {
            setView(VIEWS.LOBBY);
          }
        } else if (response.room.state === 'playing') {
          setView(VIEWS.GAME);
        }
        setError('');
      } else {
        setError(response.error);
      }
    });
  };

  const setHidden = () => {
    if (!room) return;
    
    socket.emit('set-hidden', { roomId: room.id }, (response) => {
      if (response.success) {
        setRoom(response.room);
        setView(VIEWS.HIDDEN);
      } else {
        setError(response.error);
      }
    });
  };

  const proposeEncounter = () => {
    if (!room || !selectedOpponent) return;
    
    socket.emit('propose-encounter', { 
      roomId: room.id, 
      opponentId: selectedOpponent 
    }, (response) => {
      if (response.success) {
        setSelectedOpponent('');
      } else {
        setError(response.error);
      }
    });
  };

  const confirmEncounter = (encounterId) => {
    socket.emit('confirm-encounter', { 
      roomId: room.id, 
      encounterId 
    }, (response) => {
      if (!response.success) {
        setError(response.error);
      }
    });
  };

  const denyEncounter = (encounterId) => {
    socket.emit('deny-encounter', { 
      roomId: room.id, 
      encounterId 
    }, (response) => {
      if (!response.success) {
        setError(response.error);
      }
    });
  };

  const getCurrentPlayer = () => {
    if (!room || !player) return null;
    return room.players.find(p => p.id === player.id);
  };

  const currentPlayer = getCurrentPlayer();
  const myRole = room?.roles?.[player?.id];
  const aliveOpponents = room?.players?.filter(p => p.id !== player?.id && p.isAlive && !p.eliminated) || [];

  // ==================== PANTALLA: HOME ====================
  if (view === VIEWS.HOME) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-2xl animate-float">
              <span className="text-5xl">🎭</span>
            </div>
            <h1 className="text-4xl font-bold gradient-text mb-2">
              Juego del Escondite
            </h1>
            <p className="text-gray-400">Encuentra a tus amigos y ganá</p>
            
            {/* Indicador de conexión */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
              <span className={`text-xs ${socketConnected ? 'text-green-400' : 'text-red-400'}`}>
                {socketConnected ? 'Conectado' : 'Conectando...'}
              </span>
            </div>
          </div>

          <Card>
            {/* Nombre */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Tu nombre</label>
              <input
                type="text"
                className="input-field"
                placeholder="¿Cómo te llamás?"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar src={getMyAvatarUrl()} alt="Tu avatar" size="lg" />
              <div className="flex-1">
                <AvatarSelector 
                  selectedStyle={avatarStyle} 
                  onSelect={setAvatarStyle}
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-center mb-4 text-sm bg-red-500/10 p-3 rounded-lg">{error}</p>
            )}

            <div className="space-y-3">
              <button 
                className="btn-primary relative" 
                onClick={createRoom}
                disabled={isLoading || !socketConnected}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                    Creando sala...
                  </>
                ) : (
                  '🎮 Crear Sala'
                )}
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setView(VIEWS.JOIN)}
                disabled={isLoading}
              >
                📥 Unirse a Sala
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ==================== PANTALLA: UNIRSE ====================
  if (view === VIEWS.JOIN) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-xl">
              <span className="text-4xl">📥</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Unirse a Sala
            </h1>
            <p className="text-gray-400">Ingresá el código que te pasaron</p>
          </div>

          <Card>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Tu nombre</label>
              <input
                type="text"
                className="input-field"
                placeholder="¿Cómo te llamás?"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Código de sala</label>
              <input
                type="text"
                className="input-field text-center text-2xl tracking-[0.5em] font-bold uppercase"
                placeholder="XXXXXXXX"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>

            {error && (
              <p className="text-red-400 text-center mb-4 text-sm">{error}</p>
            )}

            <div className="space-y-3">
              <button className="btn-primary" onClick={joinRoom}>
                🚀 Unirse
              </button>
              <button className="btn-secondary" onClick={() => setView(VIEWS.HOME)}>
                ← Volver
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ==================== PANTALLA: LOBBY ====================
  if (view === VIEWS.LOBBY) {
    return (
      <div className="min-h-screen p-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pt-4">
            <h1 className="text-2xl font-bold text-white">Sala de Juego</h1>
            <p className="text-gray-400 text-sm">Código de la sala:</p>
            <div className="room-code-display mt-2">{room?.id}</div>
          </div>

          {/* Tu estado */}
          <Card>
            <div className="flex items-center gap-4">
              <Avatar src={getMyAvatarUrl()} alt="Tu avatar" size="lg" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{playerName}</h2>
                <p className="text-gray-400 text-sm">¡Listo para esconderse!</p>
              </div>
            </div>
            
            <button className="btn-success mt-6" onClick={setHidden}>
              ✓ Ya estoy escondido
            </button>
          </Card>

          {/* Jugadores */}
          <Card>
            <h3 className="section-title">Jugadores ({room?.players?.length || 0})</h3>
            <div className="space-y-2">
              {room?.players?.map((p) => (
                <div key={p.id} className="player-item">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      src={getPlayerAvatarUrl(p.name)} 
                      alt={p.name} 
                      size="sm" 
                    />
                    <span className="text-white font-medium">
                      {p.name} {p.id === player?.id && <span className="text-indigo-400">(vos)</span>}
                    </span>
                  </div>
                  <StatusBadge status={p.isHidden ? 'hidden' : 'waiting'} />
                </div>
              ))}
            </div>
          </Card>

          {/* Instrucciones */}
          <div className="text-center p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <p className="text-indigo-300 text-sm">
              📍 Escondete y luego marcá que estás listo
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Cuando todos estén escondidos, comenzará el juego
            </p>
          </div>

          {error && <p className="text-red-400 text-center text-sm">{error}</p>}

          <button 
            className="btn-secondary text-red-400 border-red-400/30 hover:bg-red-400/10"
            onClick={() => {
              setView(VIEWS.HOME);
              setRoom(null);
              setPlayer(null);
            }}
          >
            Salir de la Sala
          </button>
        </div>
      </div>
    );
  }

  // ==================== PANTALLA: ESPERANDO A OTROS ====================
  if (view === VIEWS.HIDDEN) {
    const allHidden = room?.players?.every(p => p.isHidden);
    
    return (
      <div className="min-h-screen p-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pt-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
              <span className="text-3xl">🏃</span>
            </div>
            <h1 className="text-2xl font-bold text-white">¡Escondido!</h1>
            <div className="room-code-display mt-2 text-2xl">{room?.id}</div>
          </div>

          {/* Estado del juego */}
          {room?.state === 'ready' && !allHidden && (
            <Card className="bg-amber-500/10 border-amber-500/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-amber-300">Esperando que todos se escondan...</span>
              </div>
            </Card>
          )}
          
          {room?.state === 'ready' && allHidden && (
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎮</span>
                <span className="text-emerald-300 font-medium">¡El juego está por comenzar!</span>
              </div>
            </Card>
          )}

          {/* Tu estado */}
          <Card>
            <div className="flex items-center gap-4">
              <Avatar src={getMyAvatarUrl()} alt="Tu avatar" size="lg" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{playerName}</h2>
                <StatusBadge status="hidden" />
              </div>
            </div>
            
            {myRole && (
              <div className="mt-4 p-3 bg-amber-500/10 rounded-xl text-center">
                <p className="text-gray-400 text-sm">Tu rol</p>
                <span className="role-badge mt-2 inline-block">{myRole.toUpperCase()}</span>
              </div>
            )}
            
            {room?.state === 'playing' && (
              <div className="mt-4 p-3 bg-emerald-500/10 rounded-xl text-center">
                <p className="text-emerald-400">🎯 ¡Busca a los demás jugadores!</p>
              </div>
            )}
          </Card>

          {/* Jugadores */}
          <Card>
            <h3 className="section-title">Jugadores ({room?.players?.length || 0})</h3>
            <div className="space-y-2">
              {room?.players?.map((p) => (
                <div key={p.id} className="player-item">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      src={getPlayerAvatarUrl(p.name)} 
                      alt={p.name} 
                      size="sm" 
                    />
                    <span className="text-white font-medium">
                      {p.name} {p.id === player?.id && <span className="text-indigo-400">(vos)</span>}
                    </span>
                  </div>
                  <StatusBadge status={
                    p.eliminated ? 'eliminated' : 
                    p.isHidden ? 'hidden' : 'waiting'
                  } />
                </div>
              ))}
            </div>
          </Card>

          {room?.state === 'playing' && (
            <button className="btn-primary" onClick={() => setView(VIEWS.GAME)}>
              🎮 Ir a Juego
            </button>
          )}

          {error && <p className="text-red-400 text-center text-sm">{error}</p>}

          <button 
            className="btn-secondary text-red-400 border-red-400/30 hover:bg-red-400/10"
            onClick={() => {
              setView(VIEWS.HOME);
              setRoom(null);
              setPlayer(null);
            }}
          >
            Salir de la Sala
          </button>
        </div>
      </div>
    );
  }

  // ==================== PANTALLA: JUEGO ====================
  if (view === VIEWS.GAME) {
    return (
      <div className="min-h-screen p-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pt-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 mb-4 animate-glow">
              <span className="text-3xl">🎯</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Encounters</h1>
            <div className="room-code-display mt-2 text-2xl">{room?.id}</div>
          </div>

          {/* Tu estado */}
          <Card>
            <div className="flex items-center gap-4">
              <Avatar src={getMyAvatarUrl()} alt="Tu avatar" size="lg" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{playerName}</h2>
                <StatusBadge status={currentPlayer?.eliminated ? 'eliminated' : 'hidden'} />
              </div>
            </div>
            
            {myRole && (
              <div className="mt-4 p-3 bg-amber-500/10 rounded-xl text-center">
                <p className="text-gray-400 text-sm">Tu rol</p>
                <span className="role-badge mt-2 inline-block">{myRole.toUpperCase()}</span>
              </div>
            )}
            
            {currentPlayer?.eliminated && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-xl text-center">
                <p className="text-red-400 text-lg">✖ Has sido eliminado</p>
              </div>
            )}
          </Card>

          {/* Notificaciones de encuentros propuestos */}
          {Object.values(pendingEncounters).some(e => e.targetId === player?.id) && (
            <Card className="bg-amber-500/10 border-amber-500/30">
              <h3 className="text-amber-400 font-semibold mb-4">⚠️ Te han propuesto un encuentro</h3>
              {Object.values(pendingEncounters)
                .filter(e => e.targetId === player?.id)
                .map(enc => (
                  <div key={enc.encounterId} className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Avatar src={getMyAvatarUrl()} alt="Vos" size="md" />
                      <span className="text-gray-400">vs</span>
                      <Avatar src={getPlayerAvatarUrl(enc.proposerName)} alt={enc.proposerName} size="md" />
                    </div>
                    <p className="text-white mb-4">
                      <strong className="text-indigo-400">{enc.proposerName}</strong> dice que se encontró contigo
                    </p>
                    <button 
                      className="btn-success" 
                      onClick={() => confirmEncounter(enc.encounterId)}
                    >
                      ✓ Confirmar encuentro
                    </button>
                    <button 
                      className="btn-secondary mt-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => denyEncounter(enc.encounterId)}
                    >
                      ✕ Denegar encuentro
                    </button>
                  </div>
                ))
              }
            </Card>
          )}

          {/* Notificación de encuentro denegado */}
          {encounterDenied && (
            <Card className="bg-red-500/10 border-red-500/30">
              <div className="text-center">
                <div className="text-4xl mb-4">🚫</div>
                <h3 className="text-red-400 font-semibold mb-2">Encuentro Denegado</h3>
                <p className="text-gray-300">
                  <strong className="text-white">{encounterDenied.deniedBy}</strong> ha denegado el encuentro con <strong className="text-white">{encounterDenied.deniedTo}</strong>
                </p>
                <p className="text-gray-500 text-sm mt-2">El encuentro ha sido cancelado</p>
                <button 
                  className="btn-secondary mt-4"
                  onClick={() => setEncounterDenied(null)}
                >
                  Entendido
                </button>
              </div>
            </Card>
          )}

          {/* Tus encuentros propuestos */}
          {Object.values(pendingEncounters).some(e => e.proposerId === player?.id) && (
            <Card>
              <h3 className="text-gray-400 font-semibold mb-4">⏳ Esperando confirmación</h3>
              {Object.values(pendingEncounters)
                .filter(e => e.proposerId === player?.id)
                .map(enc => (
                  <div key={enc.encounterId} className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <Avatar src={getMyAvatarUrl()} alt="Vos" size="md" />
                      <span className="text-gray-400">vs</span>
                      <Avatar src={getPlayerAvatarUrl(enc.targetName)} alt={enc.targetName} size="md" />
                    </div>
                    <p className="text-gray-400 text-sm">
                      Has propuesto encontrarte con <strong className="text-white">{enc.targetName}</strong>
                    </p>
                    <p className="text-gray-500 text-xs mt-2">Espera que confirme</p>
                  </div>
                ))
              }
            </Card>
          )}

          {/* Reportar encuentro */}
          {!currentPlayer?.eliminated && Object.keys(pendingEncounters).length === 0 && (
            <Card>
              <h3 className="section-title">Reportar Encuentro</h3>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">¿Con quién te encontraste?</label>
                <select 
                  className="input-field-select"
                  value={selectedOpponent}
                  onChange={(e) => setSelectedOpponent(e.target.value)}
                >
                  <option value="" className="text-gray-400">Seleccionar jugador</option>
                  {aliveOpponents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <button 
                className="btn-warning" 
                onClick={proposeEncounter}
                disabled={!selectedOpponent}
              >
                ✓ Proponer encuentro
              </button>
            </Card>
          )}

          {/* Jugadores */}
          <Card>
            <h3 className="section-title">Jugadores ({room?.players?.length || 0})</h3>
            <div className="space-y-2">
              {room?.players?.map((p) => (
                <div key={p.id} className="player-item">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      src={getPlayerAvatarUrl(p.name)} 
                      alt={p.name} 
                      size="sm" 
                    />
                    <span className="text-white font-medium">
                      {p.name} {p.id === player?.id && <span className="text-indigo-400">(vos)</span>}
                    </span>
                  </div>
                  <StatusBadge status={
                    p.eliminated ? 'eliminated' : 'hidden'
                  } />
                </div>
              ))}
            </div>
          </Card>

          {room?.state === 'finished' && (
            <Card className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30">
              <h3 className="text-center text-amber-400 text-xl font-bold mb-4">🏆 Ganador</h3>
              <div className="flex items-center justify-center gap-4">
                <Avatar 
                  src={getPlayerAvatarUrl(room.players.find(p => p.isAlive)?.name || 'Empate')} 
                  alt="Ganador" 
                  size="xl" 
                />
                <div>
                  <p className="text-3xl font-bold text-white">
                    {room.players.find(p => p.isAlive)?.name || 'Empate'}
                  </p>
                  <p className="text-gray-400 text-sm">¡Felicidades!</p>
                </div>
              </div>
            </Card>
          )}

          {error && <p className="text-red-400 text-center text-sm">{error}</p>}

          <button 
            className="btn-secondary text-red-400 border-red-400/30 hover:bg-red-400/10"
            onClick={() => {
              setView(VIEWS.HOME);
              setRoom(null);
              setPlayer(null);
            }}
          >
            Salir de la Sala
          </button>
        </div>
      </div>
    );
  }

  // ==================== PANTALLA: RESULTADO DE ENCUENTRO ====================
  const playerLost = lastEncounter?.loser?.id === currentPlayer?.id;
  
  if (view === VIEWS.ENCOUNTER_RESULT) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${playerLost ? 'bg-red-900/30' : ''}`}>
        <div className="w-full max-w-md">
          <Card className={`text-center ${playerLost ? 'border-red-500/50 bg-red-500/5' : ''}`}>
            <h2 className="text-2xl font-bold text-white mb-8">
              Resultado del Encuentro
            </h2>
            
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <Avatar 
                  src={getPlayerAvatarUrl(lastEncounter.player1.name)} 
                  alt={lastEncounter.player1.name} 
                  size="xl" 
                  className="mx-auto mb-2"
                />
                <p className="text-white font-medium">{lastEncounter.player1.name}</p>
                <span className="role-badge">{lastEncounter.player1.role.toUpperCase()}</span>
              </div>
              
              <div className="text-2xl">vs</div>
              
              <div className="text-center">
                <Avatar 
                  src={getPlayerAvatarUrl(lastEncounter.player2.name)} 
                  alt={lastEncounter.player2.name} 
                  size="xl" 
                  className="mx-auto mb-2"
                />
                <p className="text-white font-medium">{lastEncounter.player2.name}</p>
                <span className="role-badge">{lastEncounter.player2.role.toUpperCase()}</span>
              </div>
            </div>
            
            {lastEncounter.result === 'tie' ? (
              <div className="p-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl mb-6 text-center animate-win">
                <div className="flex justify-center items-center gap-2 mb-4">
                  <span className="text-4xl">🤝</span>
                </div>
                <p className="text-3xl font-bold text-blue-300">¡Sois aliados!</p>
                <p className="text-blue-400/70 mt-3 text-lg">Ambos eligieron {lastEncounter.player1.role}</p>
                <p className="text-gray-500 mt-4">Seguid buscando together 🕵️</p>
                
                {/* Corazones flotantes */}
                <div className="flex justify-center gap-2 mt-4">
                  <span className="text-2xl animate-pulse">💙</span>
                  <span className="text-2xl animate-pulse" style={{animationDelay: '0.2s'}}>💜</span>
                  <span className="text-2xl animate-pulse" style={{animationDelay: '0.4s'}}>💚</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {/* Ganador - Animación prominent */}
                <div className="p-6 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border-2 border-emerald-500/40 animate-win winner-glow">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-4xl">🏆</span>
                    <p className="text-3xl font-bold text-emerald-400">
                      ¡{lastEncounter.winner?.name} GANA!
                    </p>
                    <span className="text-4xl">🏆</span>
                  </div>
                  <p className="text-emerald-300/70 text-center">
                    {lastEncounter.winner?.name === currentPlayer?.name 
                      ? "¡Eres el maestro del escondite!" 
                      : "Se mantiene en juego"}
                  </p>
                </div>

                {/* Perdedor - Mensaje de lastima */}
                <div className="p-6 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl border-2 border-red-500/30 animate-lose">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-4xl">💔</span>
                    <p className="text-2xl font-bold text-red-400">
                      {lastEncounter.loser?.name} Eliminado
                    </p>
                    <span className="text-4xl">💔</span>
                  </div>
                  
                  {/* Mensaje personalizado si el usuario actual perdió */}
                  {lastEncounter.loser?.id === currentPlayer?.id ? (
                    <div className="mt-4 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                      <p className="text-red-300 text-lg font-medium">
                        😢 ¡Qué lástima! Has sido eliminado
                      </p>
                      <p className="text-red-400/60 text-sm mt-2">
                        Pero puedes seguir viendo la partida desde la sala
                      </p>
                    </div>
                  ) : (
                    <p className="text-red-400/60 text-center mt-2">
                      {lastEncounter.loser?.name} ha sido eliminado del juego
                    </p>
                  )}
                </div>

                {/* Resumen del encuentro */}
                <div className="flex justify-center items-center gap-4 py-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase mb-1">Movimiento</p>
                    <span className="role-badge text-lg">{lastEncounter.player1.role.toUpperCase()}</span>
                  </div>
                  <span className="text-2xl text-gray-500">vs</span>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase mb-1">Movimiento</p>
                    <span className="role-badge text-lg">{lastEncounter.player2.role.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            )}
            
            <button 
              className={`btn-primary ${lastEncounter.loser?.id === currentPlayer?.id ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' : ''}`}
              onClick={() => {
                setLastEncounter(null);
                // Si perdiste o ya estás eliminado, vas a ver la partida
                if (lastEncounter.loser?.id === currentPlayer?.id || currentPlayer?.eliminated) {
                  setView(VIEWS.HIDDEN);
                } else {
                  setView(VIEWS.GAME);
                }
              }}
            >
              {lastEncounter.loser?.id === currentPlayer?.id 
                ? 'Entendido' 
                : 'Continuar'}
            </button>
          </Card>

          {error && <p className="text-red-400 text-center text-sm mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return null;
}

export default App;
