import { useState, useEffect } from 'react';
import { getSocket, saveRoomInfo } from '../hooks/useSocket.js';
import Avatar from '../components/Avatar.jsx';
import { CopyButton } from '../components/index.js';
import { VIEWS } from '../constants/views.js';

/**
 * Obtener sessionId del localStorage
 */
const getSessionId = () => {
  return localStorage.getItem('user_session_id');
};

export default function ApuestasLobbyView({ onNavigate }) {
  const socket = getSocket();
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);
  const [showRooms, setShowRooms] = useState(false);
  const [hostMessage, setHostMessage] = useState(null);
  
  // Limpiar mensaje de host después de 5 segundos
  useEffect(() => {
    if (hostMessage) {
      const timer = setTimeout(() => setHostMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [hostMessage]);
  
  // Obtener salas activas al montar el componente
  useEffect(() => {
    const fetchActiveRooms = () => {
      socket.emit('apuestas-get-active-rooms', {}, (response) => {
        if (response.success) {
          setActiveRooms(response.rooms || []);
        }
      });
    };
    
    fetchActiveRooms();
    
    // Actualizar cada 5 segundos
    const interval = setInterval(fetchActiveRooms, 5000);
    return () => clearInterval(interval);
  }, [socket]);
  
  // Unirse a sala desde la lista
  const handleJoinFromList = (code) => {
    setRoomCode(code);
    setShowRooms(false);
  };

  // Escuchar eventos de socket
  useEffect(() => {
    const handleApuestasPlayerJoined = (data) => {
      if (room && data.roomId === room.id) {
        setRoom(prev => {
          // Verificar si el jugador ya existe para evitar duplicados
          const exists = prev.players.some(p => p.id === data.player.id);
          if (exists) return prev;
          
          return {
            ...prev,
            players: [...prev.players, data.player]
          };
        });
      }
    };

    const handleApuestasPlayerLeft = (data) => {
      if (room && data.roomId === room.id) {
        setRoom(prev => ({
          ...prev,
          players: prev.players.filter(p => p.id !== data.playerId)
        }));
      }
    };

    const handleApuestasConfigSet = (data) => {
      console.log('>>> Lobby: handleApuestasConfigSet recibido:', data);
      if (room && data.roomId === room.id) {
        setRoom(prev => ({
          ...prev,
          state: data.state,
          config: {
            ...prev.config,
            targetNumber: data.targetNumber,
            rounds: data.rounds
          }
        }));
        
        // Actualizar también en window
        const updatedRoom = {
          ...room,
          state: data.state,
          config: {
            ...room.config,
            targetNumber: data.targetNumber,
            rounds: data.rounds
          }
        };
        window.__apuestasRoom = updatedRoom;
        
        // Navegar automáticamente a la vista de configuración
        console.log('>>> Navegando a APUESTAS_CONFIG desde Lobby...');
        onNavigate(VIEWS.APUESTAS_CONFIG);
      }
    };

    socket.on('apuestas-player-joined', handleApuestasPlayerJoined);
    socket.on('apuestas-player-left', handleApuestasPlayerLeft);
    socket.on('apuestas-config-set', handleApuestasConfigSet);
    
    // Host events
    const handleYouAreHost = (data) => {
      console.log('[ApuestasLobby] ¡Ahora eres el host!', data);
      setHostMessage({ type: 'new-host', message: `¡Ahora eres el host! Has reemplazado a ${data.oldHostName}` });
    };
    
    const handleHostRestored = (data) => {
      console.log('[ApuestasLobby] Has recuperado el host:', data);
      setHostMessage({ type: 'host-restored', message: '¡Has recuperado el rol de host!' });
    };
    
    const handleHostRemoved = (data) => {
      console.log('[ApuestasLobby] Ya no eres host:', data);
      setHostMessage({ type: 'host-removed', message: data.message || 'El host original se ha reconectado' });
    };
    
    const handleHostChanged = (data) => {
      console.log('[ApuestasLobby] El host cambió:', data);
      if (data.newHostId === socket.id && !data.restored) {
        setHostMessage({ type: 'new-host', message: `¡Ahora eres el host! Has reemplazado a ${data.oldHostName}` });
      }
    };

    socket.on('you-are-host', handleYouAreHost);
    socket.on('host-restored', handleHostRestored);
    socket.on('host-removed', handleHostRemoved);
    socket.on('host-changed', handleHostChanged);

    return () => {
      socket.off('apuestas-player-joined', handleApuestasPlayerJoined);
      socket.off('apuestas-player-left', handleApuestasPlayerLeft);
      socket.off('apuestas-config-set', handleApuestasConfigSet);
      socket.off('you-are-host', handleYouAreHost);
      socket.off('host-restored', handleHostRestored);
      socket.off('host-removed', handleHostRemoved);
      socket.off('host-changed', handleHostChanged);
    };
  }, [room]);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Introduce tu nombre');
      return;
    }

    const sessionId = getSessionId();
    socket.emit('apuestas-create', {
      playerName: playerName.trim(),
      avatarStyle: 'adventurer',
      avatarSeed: playerName.trim(),
      sessionId
    }, (response) => {
      if (response.success) {
        setRoom(response.room);
        setPlayer(response.room.players[0]);
        window.__apuestasRoom = response.room;
        window.__apuestasPlayer = response.room.players[0];
        // Guardar info para reconexión
        sessionStorage.setItem('apuestas_roomId', response.room.id);
        sessionStorage.setItem('apuestas_sessionId', sessionId);
        setError('');
      } else {
        setError(response.error);
      }
    });
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      setError('Introduce tu nombre y el código de sala');
      return;
    }

    const sessionId = getSessionId();
    setIsJoining(true);
    socket.emit('apuestas-join', {
      roomId: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
      avatarStyle: 'adventurer',
      avatarSeed: playerName.trim(),
      sessionId
    }, (response) => {
      if (response.success) {
        setRoom(response.room);
        setPlayer(response.player);
        window.__apuestasRoom = response.room;
        window.__apuestasPlayer = response.player;
        // Guardar info para reconexión
        sessionStorage.setItem('apuestas_roomId', response.room.id);
        sessionStorage.setItem('apuestas_sessionId', sessionId);
        setError('');
      } else {
        setError(response.error);
      }
      setIsJoining(false);
    });
  };

  const isHost = room && player && room.host === player.id;
  const canStart = room && room.players.length >= 1 && room.state === 'lobby';

  const handleStartGame = () => {
    if (!canStart) return;
    
    // Ir a pantalla de configuración si es host
    if (isHost) {
      onNavigate(VIEWS.APUESTAS_CONFIG);
    }
  };

  const handleBack = () => {
    if (room) {
      socket.emit('apuestas-leave', { roomId: room.id });
    }
    setRoom(null);
    setPlayer(null);
    onNavigate(VIEWS.GAMES);
  };

  // Si ya estamos en una sala
  if (room) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={handleBack} className="text-gray-400 hover:text-white">
              ← Volver
            </button>
            <h1 className="text-xl font-bold">Apuestas</h1>
            <div className="w-16"></div>
          </div>

          {/* Código de sala */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
            <p className="text-gray-400 text-sm">Código de sala</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-3xl font-bold text-yellow-400 tracking-widest">{room.id}</p>
              <CopyButton text={room.id} />
            </div>
            <p className="text-gray-500 text-xs mt-2">Comparte este código con otros jugadores</p>
          </div>

          {/* Jugadores */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Jugadores ({room.players.length})</h2>
            <div className="space-y-3">
              {room.players.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 bg-gray-700 rounded">
                  <Avatar style="adventurer" seed={p.avatarSeed} size={40} />
                  <span className="flex-1">{p.name}</span>
                  {p.id === room.host && (
                    <span className="bg-yellow-600 text-xs px-2 py-1 rounded">HOST</span>
                  )}
                  {p.id === player?.id && (
                    <span className="bg-blue-600 text-xs px-2 py-1 rounded">TÚ</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Estado del juego - Solo mostrar cuando está en lobby */}
          {room.state === 'lobby' && (
            <div className="text-center">
              {isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={!canStart}
                  className={`w-full py-3 rounded-lg font-semibold ${
                    canStart 
                      ? 'bg-green-600 hover:bg-green-500 text-white' 
                      : 'bg-gray-700 text-gray-500'
                  }`}
                >
                  Configurar Juego
                </button>
              ) : (
                <p className="text-gray-400">Esperando que el host configure el juego...</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de login de sala
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <button onClick={() => onNavigate(VIEWS.GAMES)} className="text-gray-400 hover:text-white mb-6">
          ← Volver a Juegos
        </button>

        <h1 className="text-3xl font-bold text-center mb-8">Apuestas</h1>
        <p className="text-gray-400 text-center mb-8">Cronómetro de precisión - ¡El que más se acerque gana!</p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Tu nombre"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg">
              {error}
            </div>
          )}
          
          {/* Host Message */}
          {hostMessage && (
            <div className={`rounded-lg p-4 text-center font-medium ${
              hostMessage.type === 'new-host' || hostMessage.type === 'host-restored'
                ? 'bg-green-500/20 border border-green-500 text-green-400'
                : 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'
            }`}>
              👑 {hostMessage.message}
            </div>
          )}

          <button
            onClick={handleCreateRoom}
            className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
          >
            Crear Sala
          </button>

          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px bg-gray-700"></div>
            <span className="text-gray-500">o</span>
            <div className="flex-1 h-px bg-gray-700"></div>
          </div>
          
          {/* Botón ver salas activas */}
          <button
            onClick={() => setShowRooms(!showRooms)}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <span>📋</span>
            <span>{showRooms ? 'Ocultar Salas' : `Ver Salas Activas (${activeRooms.length})`}</span>
          </button>
          
          {/* Lista de salas activas */}
          {showRooms && activeRooms.length > 0 && (
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700 space-y-2 mt-4">
              <h3 className="text-gray-400 text-sm font-medium mb-3">Salas disponibles</h3>
              {activeRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => handleJoinFromList(room.id)}
                  className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-white font-medium">{room.id}</span>
                      <span className="text-gray-400 text-sm ml-2">Host: {room.hostName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-green-400 font-medium">{room.playerCount} jugadores</span>
                      <span className="text-gray-500 text-xs ml-2">{room.rounds} rondas</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {showRooms && activeRooms.length === 0 && (
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700 text-center mt-4">
              <p className="text-gray-400">No hay salas disponibles</p>
            </div>
          )}

          <input
            type="text"
            placeholder="Código de sala"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-xl tracking-widest mt-4"
            maxLength={8}
          />

          <button
            onClick={handleJoinRoom}
            disabled={isJoining}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50"
          >
            {isJoining ? 'Uniendo...' : 'Unirse a Sala'}
          </button>
        </div>
      </div>
    </div>
  );
}
