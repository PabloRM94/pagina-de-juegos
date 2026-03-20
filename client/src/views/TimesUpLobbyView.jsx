import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Lobby de Time's Up
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function TimesUpLobbyView({ onNavigate }) {
  const { socket } = useSocket();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [withSounds, setWithSounds] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [inRoom, setInRoom] = useState(false); // Nuevo estado para saber si ya está en sala

  // Crear partida
  const handleCreate = async () => {
    console.log('=== handleCreate llamado ===');
    if (!playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }

    setIsCreating(true);
    setError('');

    console.log('Creando partida timesup:', { teamCount, withSounds, playerName });

    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('timesup-create', { teamCount, withSounds, playerName }, (response) => {
          console.log('timesup-create response:', response);
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      // El host ya está creado en la sala, no necesita unirse
      setRoomId(result.roomId);
      sessionStorage.setItem('timesup_roomId', result.roomId);
      sessionStorage.setItem('timesup_host', socket.id); // Guardar que somos host
      setInRoom(true);
      setIsHost(true);
      setPlayers([{ id: socket.id, name: playerName, isHost: true }]);
    } catch (err) {
      console.error('Error al crear:', err);
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Unirse a partida
  const handleJoin = async () => {
    if (!playerName.trim() || !roomId.trim()) {
      setError('Ingresa tu nombre y el código de sala');
      return;
    }

    setIsJoining(true);
    setError('');

    const roomIdUpper = roomId.toUpperCase();
    console.log('=== INTENTANDO UNIRSE ===');
    console.log('roomId enviado:', roomIdUpper);
    console.log('playerName:', playerName);

    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('timesup-join', {
          roomId: roomIdUpper,
          playerName,
          avatarStyle: 'avataaars',
          avatarSeed: playerName
        }, (response) => {
          console.log('=== RESPUESTA DEL SERVIDOR ===');
          console.log('response:', response);
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      console.log('=== UNIÓN EXITOSA ===');
      console.log('result.room.id (del servidor):', result.room.id);

      // Asegurar que el roomId se guarde en mayúsculas
      const normalizedRoomId = result.room.id.toUpperCase();
      
      setInRoom(true);
      setRoomId(normalizedRoomId);
      sessionStorage.setItem('timesup_roomId', normalizedRoomId);
      sessionStorage.setItem('timesup_host', result.room.host); // Guardar el host de la sala
      console.log('Guardado en sessionStorage:', normalizedRoomId);
      setPlayers(result.room.players.map(p => ({ 
        id: p.id, 
        name: p.name,
        isHost: p.id === result.room.host
      })));
      setIsHost(result.room.host === socket.id);
    } catch (err) {
      console.error('=== ERROR AL UNIRSE ===');
      console.error('err:', err);
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  // Iniciar asignación de capitanes (solo host)
  const handleStart = async () => {
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('timesup-assign-captains', { roomId }, (response) => {
          console.log('timesup-assign-captains response:', response);
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      // No navegamos aquí, el socket emitirá el evento y la vista cambiará
    } catch (err) {
      console.error('Error al asignar capitanes:', err);
      setError(err.message);
    }
  };

  // Escuchar eventos de socket
  useEffect(() => {
    // Escuchar desconexiones para debugging
    const handleDisconnect = (reason) => {
      console.log('[SOCKET DISCONNECT] reason:', reason);
    };
    
    const handleConnectError = (err) => {
      console.log('[SOCKET CONNECT ERROR]', err);
    };
    
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    
    const handlePlayerJoined = (data) => {
      console.log('Player joined:', data);
      setPlayers(prev => {
        // Verificar si el jugador ya existe para evitar duplicados
        const exists = prev.some(p => p.id === data.player.id);
        if (exists) return prev;
        return [...prev, data.player];
      });
    };

    const handleCaptainsAssigned = (data) => {
      console.log('[handleCaptainsAssigned] === INICIO ===');
      console.log('[handleCaptainsAssigned] socket.id:', socket.id);
      console.log('[handleCaptainsAssigned] socket.connected:', socket.connected);
      
      // ASEGURAR que tenemos el roomId correcto - siempre de sessionStorage primero
      const storedRoomId = sessionStorage.getItem('timesup_roomId');
      
      // Si ya tenemos un roomId en sessionStorage, usarlo
      // Si no lo tenemos (esto no debería pasar si el join fue exitoso), no podemos continuar
      if (!storedRoomId) {
        console.error('[handleCaptainsAssigned] ERROR: No hay roomId en sessionStorage');
        console.log('[handleCaptainsAssigned] roomId state:', roomId);
        alert('Error: No se encontró la sala. Volvé al lobby.');
        return;
      }
      
      console.log('[handleCaptainsAssigned] roomId from sessionStorage:', storedRoomId);
      console.log('[handleCaptainsAssigned] teams:', data.teams?.length);
      console.log('[handleCaptainsAssigned] state:', data.state);
      
      // IMPORTANTE: Usar el roomId del servidor como source of truth
      const serverRoomId = data.roomId || storedRoomId;
      console.log('[handleCaptainsAssigned] roomId del servidor:', serverRoomId);
      
      try {
        // Guardar datos en sessionStorage - usar roomId del SERVIDOR
        sessionStorage.setItem('timesup_roomId', serverRoomId);
        sessionStorage.setItem('timesup_teams', JSON.stringify(data.teams));
        sessionStorage.setItem('timesup_config', JSON.stringify({
          teamCount: data.teams?.length || 2,
          totalRounds: data.teams?.length > 0 ? 4 : 3
        }));
        
        console.log('[handleCaptainsAssigned] Datos guardados en sessionStorage con roomId del servidor');
        console.log('[handleCaptainsAssigned] Navegando a TIMESUP_TEAM_NAME...');
        
        // Cuando se asignan capitanes, navegar a la siguiente vista
        onNavigate(VIEWS.TIMESUP_TEAM_NAME);
        
        console.log('[handleCaptainsAssigned] === FIN ===');
      } catch (err) {
        console.error('[handleCaptainsAssigned] ERROR:', err);
      }
    };

    const handleDebugLog = (data) => {
      console.log('[SERVER LOG]:', data.message);
    };

    socket.on('timesup-player-joined', handlePlayerJoined);
    socket.on('timesup-captains-assigned', handleCaptainsAssigned);
    socket.on('debug-log', handleDebugLog);

    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('timesup-player-joined', handlePlayerJoined);
      socket.off('timesup-captains-assigned', handleCaptainsAssigned);
      socket.off('debug-log', handleDebugLog);
    };
  }, [socket, onNavigate]);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-white mb-2">⏱️ Time's Up!</h1>
          <p className="text-gray-400">Adivina palabras en equipo</p>
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

        {/* Opciones de creación (solo si no está en sala Y no ha escrito código) */}
        {!inRoom && !roomId && (
          <div className="space-y-4">
            {/* Número de equipos */}
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
              <label className="block text-gray-400 text-sm mb-3">Número de equipos</label>
              <div className="flex gap-2">
                {[2, 3, 4].map(num => (
                  <button
                    type="button"
                    key={num}
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
              <p className="text-gray-500 text-xs mt-2">Activar ronda adicional con sonidos</p>
            </div>

            {/* Botón crear */}
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
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
          </div>
        )}

        {/* Unirse a partida - siempre visible si no está en sala */}
        {!inRoom && (
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-2">Código de sala</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => {
                console.log('Input código cambió a:', e.target.value.toUpperCase());
                setRoomId(e.target.value.toUpperCase());
              }}
              placeholder="Ingresa el código"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 uppercase"
              maxLength={8}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={isJoining}
              className="w-full mt-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {isJoining ? 'Uniendo...' : 'Unirse a Partida'}
            </button>
          </div>
        )}

        {/* Sala creada - Mostrar código y jugadores (solo si ya está unido) */}
        {inRoom && (
          <div className="space-y-4">
            {/* Código de sala */}
            <div className="bg-indigo-500/20 rounded-2xl p-4 border border-indigo-500/50 text-center">
              <p className="text-gray-400 text-sm">Código de sala</p>
              <p className="text-3xl font-bold text-indigo-400 tracking-wider">{roomId}</p>
              <p className="text-gray-500 text-xs mt-2">Compartilo con tus amigos</p>
            </div>

            {/* Jugadores */}
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-3">Jugadores ({players.length})</p>
              <div className="space-y-2">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-white">{player.name}</span>
                    {player.isHost && (
                      <span className="text-xs bg-indigo-500/50 text-indigo-300 px-2 py-1 rounded">Host</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Botón iniciar (solo host) - requiere al menos 2 jugadores */}
            {isHost && (
              <button
                onClick={handleStart}
                disabled={players.length < 2}
                className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
                  players.length < 2
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {players.length < 2 
                  ? `Necesitas al menos 2 jugadores (tienes ${players.length})`
                  : 'Asignar Capitanes'}
              </button>
            )}

            {!isHost && (
              <div className="text-center text-gray-500">
                <p>Esperando que el host inicie...</p>
              </div>
            )}
          </div>
        )}

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

export default TimesUpLobbyView;
