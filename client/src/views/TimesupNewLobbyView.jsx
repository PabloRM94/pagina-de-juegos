import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { CopyButton } from '../components/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Lobby de TimeUp New (Multiplayer)
 * Crear o unirse a una sala
 */
export function TimesupNewLobbyView({ onNavigate }) {
  const { socket } = useSocket();
  
  // Estado
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [withSounds, setWithSounds] = useState(false);
  
  // Estados de UI
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [showRooms, setShowRooms] = useState(false);
  
  // Cargar nombre de sessionStorage
  useEffect(() => {
    const savedName = sessionStorage.getItem('playerName');
    if (savedName) setPlayerName(savedName);
  }, []);
  
  // Obtener salas activas
  useEffect(() => {
    const fetchRooms = () => {
      socket.emit('timesupnew-get-active-rooms', {}, (response) => {
        if (response.success) {
          setActiveRooms(response.rooms || []);
        }
      });
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [socket]);
  
  // Listeners de socket
  useEffect(() => {
    const handlePlayerJoined = (data) => {
      console.log('[TimesupNew] Player joined:', data);
      setPlayers(prev => {
        const exists = prev.some(p => p.id === data.player.id);
        if (exists) return prev;
        return [...prev, data.player];
      });
    };
    
    const handleTeamsAssigned = (data) => {
      console.log('[TimesupNew] Teams assigned:', data);
      sessionStorage.setItem('timesupnew_roomId', roomId);
      sessionStorage.setItem('timesupnew_teams', JSON.stringify(data.teams));
      onNavigate(VIEWS.TIMESUP_NEW_TEAMS);
    };
    
    const handleAllTeamsNamed = (data) => {
      console.log('[TimesupNew] All teams named:', data);
      sessionStorage.setItem('timesupnew_state', JSON.stringify({ state: 'words' }));
      onNavigate(VIEWS.TIMESUP_NEW_WORDS);
    };
    
    socket.on('timesupnew-player-joined', handlePlayerJoined);
    socket.on('timesupnew-teams-assigned', handleTeamsAssigned);
    socket.on('timesupnew-all-teams-named', handleAllTeamsNamed);
    
    return () => {
      socket.off('timesupnew-player-joined', handlePlayerJoined);
      socket.off('timesupnew-teams-assigned', handleTeamsAssigned);
      socket.off('timesupnew-all-teams-named', handleAllTeamsNamed);
    };
  }, [socket, roomId, onNavigate]);
  
  // Crear sala
  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }
    
    setIsCreating(true);
    setError('');
    
    // Guardar nombre
    sessionStorage.setItem('playerName', playerName);
    
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('timesupnew-create', {
          teamCount,
          withSounds,
          playerName
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      
      setRoomId(result.roomId);
      setInRoom(true);
      setIsHost(true);
      setPlayers(result.room.players);
      sessionStorage.setItem('timesupnew_roomId', result.roomId);
      sessionStorage.setItem('timesupnew_host', socket.id);
      sessionStorage.setItem('timesupnew_teamCount', teamCount);
      sessionStorage.setItem('timesupnew_withSounds', withSounds);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };
  
  // Unirse a sala
  const handleJoin = async () => {
    if (!playerName.trim() || !roomId.trim()) {
      setError('Ingresa tu nombre y el código de sala');
      return;
    }
    
    setIsJoining(true);
    setError('');
    
    sessionStorage.setItem('playerName', playerName);
    
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('timesupnew-join', {
          roomId: roomId.toUpperCase(),
          playerName
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      
      setInRoom(true);
      setRoomId(result.room.id);
      setIsHost(result.room.host === socket.id);
      setPlayers(result.room.players || []);
      sessionStorage.setItem('timesupnew_roomId', result.room.id);
      sessionStorage.setItem('timesupnew_host', result.room.host);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
  };
  
  // Pantalla de sala creada/unido
  if (inRoom) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pt-4">
            <h1 className="text-3xl font-bold text-white mb-2">🎯 TimeUp New</h1>
            <p className="text-gray-400">Sala creada</p>
          </div>
          
          {/* Código de sala */}
          <div className="bg-indigo-500/20 rounded-2xl p-4 border border-indigo-500/50 text-center">
            <p className="text-gray-400 text-sm">Código de sala</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-3xl font-bold text-indigo-400 tracking-wider">{roomId}</p>
              <CopyButton text={roomId} />
            </div>
          </div>
          
          {/* Jugadores */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-3">Jugadores ({players.length})</p>
            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                  <span className="text-white">{player.name}</span>
                  {player.id === sessionStorage.getItem('timesupnew_host') && (
                    <span className="text-xs bg-indigo-500/50 text-indigo-300 px-2 py-1 rounded">Host</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Volver */}
          <button
            onClick={() => onNavigate(VIEWS.GAMES)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ← Volver a Juegos
          </button>
        </div>
      </div>
    );
  }
  
  // Pantalla de lobby (antes de unirse/crear)
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-white mb-2">🎯 TimeUp New</h1>
          <p className="text-gray-400">Multijugador - Un móvil</p>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}
        
        {/* Nombre del jugador */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <label className="block text-gray-400 text-sm mb-2">Tu nombre</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Ingresa tu nombre"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
        
        {/* Crear partida */}
        <div className="space-y-4">
          {/* Número de equipos */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-3">Número de equipos</label>
            <div className="flex gap-2">
              {[2, 3, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTeamCount(num)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    teamCount === num
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num} equipos
                </button>
              ))}
            </div>
          </div>
          
          {/* Ronda de sonidos */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-300">Ronda 4: Sonidos</span>
              <button
                type="button"
                onClick={() => setWithSounds(!withSounds)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  withSounds ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  withSounds ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          </div>
          
          {/* Botón crear */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !playerName.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {isCreating ? 'Creando...' : 'Crear Partida'}
          </button>
          
          {/* Separador */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-700"></div>
            <span className="text-gray-500 text-sm">o</span>
            <div className="flex-1 h-px bg-gray-700"></div>
          </div>
          
          {/* Unirse a partida */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-2">Código de sala</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Ingresa el código"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 uppercase"
              maxLength={6}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={isJoining || !playerName.trim() || !roomId.trim()}
              className="w-full mt-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {isJoining ? 'Uniendo...' : 'Unirse a Partida'}
            </button>
          </div>
          
          {/* Ver salas activas */}
          <button
            type="button"
            onClick={() => setShowRooms(!showRooms)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>📋</span>
            <span>{showRooms ? 'Ocultar Salas' : `Salas Activas (${activeRooms.length})`}</span>
          </button>
          
          {/* Lista de salas activas */}
          {showRooms && activeRooms.length > 0 && (
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700 space-y-2">
              {activeRooms.map(room => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setRoomId(room.id);
                    setShowRooms(false);
                  }}
                  className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{room.id}</span>
                    <div className="text-right">
                      <span className="text-indigo-400 font-medium">{room.playerCount} jugadores</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Volver a juegos */}
        <button
          onClick={() => onNavigate(VIEWS.GAMES)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          ← Volver a Juegos
        </button>
      </div>
    </div>
  );
}

export default TimesupNewLobbyView;
