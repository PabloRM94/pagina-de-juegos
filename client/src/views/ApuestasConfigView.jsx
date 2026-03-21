import { useState, useEffect } from 'react';
import { getSocket } from '../hooks/useSocket.js';
import { VIEWS } from '../constants/views.js';

export default function ApuestasConfigView({ onNavigate }) {
  const socket = getSocket();
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [targetNumber, setTargetNumber] = useState(5);
  const [rounds, setRounds] = useState(1);
  const [isSettingConfig, setIsSettingConfig] = useState(false);
  const [error, setError] = useState('');
  const [roundWinners, setRoundWinners] = useState([]);

  useEffect(() => {
    const roomData = window.__apuestasRoom;
    const playerData = window.__apuestasPlayer;
    if (roomData) {
      setRoom(roomData);
      if (roomData.config?.targetNumber) {
        setTargetNumber(roomData.config.targetNumber);
      }
      if (roomData.config?.rounds) {
        setRounds(roomData.config.rounds);
      }
      if (roomData.roundWinners) {
        setRoundWinners(roomData.roundWinners);
      }
    }
    if (playerData) setPlayer(playerData);

    // Escuchar cuando el host configura el juego
    const handleConfigSet = (data) => {
      console.log('>>> handleConfigSet recibido:', data);
      const currentRoom = window.__apuestasRoom;
      if (currentRoom && data.roomId === currentRoom.id) {
        const newRoom = {
          ...currentRoom,
          state: data.state,
          config: { ...currentRoom.config, targetNumber: data.targetNumber, rounds: data.rounds },
          roundWinners: data.roundWinners || []
        };
        setRoom(newRoom);
        window.__apuestasRoom = newRoom;
        setTargetNumber(data.targetNumber);
        setRounds(data.rounds);
        setRoundWinners(data.roundWinners || []);
        
        // Si no estamos ya en la vista de config, navegar automáticamente
        // (Esto es para los no-host que están en el lobby)
        onNavigate(VIEWS.APUESTAS_CONFIG);
      }
    };

    // Escuchar cuando inicia el juego
    const handleRoundStarted = (data) => {
      console.log('>>> handleRoundStarted recibido:', data);
      const currentRoom = window.__apuestasRoom;
      console.log('>>> currentRoom:', currentRoom?.id, 'data.roomId:', data.roomId);
      
      if (currentRoom && data.roomId === currentRoom.id) {
        console.log('>>> Navegando a ApuestasPlayView...');
        const updatedRoom = {
          ...currentRoom,
          state: 'playing',
          config: { ...currentRoom.config, targetNumber: data.targetNumber }
        };
        window.__apuestasRoom = updatedRoom;
        setRoom(updatedRoom);
        onNavigate(VIEWS.APUESTAS_PLAY);
      }
    };

    socket.on('apuestas-config-set', handleConfigSet);
    socket.on('apuestas-round-started', handleRoundStarted);

    return () => {
      socket.off('apuestas-config-set', handleConfigSet);
      socket.off('apuestas-round-started', handleRoundStarted);
    };
  }, [onNavigate]);

  const isHost = room && player && room.host === player.id;

  const handleSetConfig = () => {
    if (!isHost) return;
    
    setIsSettingConfig(true);
    socket.emit('apuestas-set-config', {
      roomId: room.id,
      targetNumber,
      rounds
    }, (response) => {
      if (response.success) {
        const updatedRoom = {
          ...room,
          state: 'config',
          config: { ...room.config, targetNumber, rounds }
        };
        setRoom(updatedRoom);
        window.__apuestasRoom = updatedRoom;
        setError('');
      } else {
        setError(response.error);
      }
      setIsSettingConfig(false);
    });
  };

  const handleStartRound = () => {
    if (!isHost) return;
    
    console.log('>>> handleStartRound llamado, roomId:', room.id);
    socket.emit('apuestas-start', { roomId: room.id }, (response) => {
      console.log('>>> respuesta apuestas-start:', response);
      if (!response.success) {
        setError(response.error);
      }
    });
  };

  const handleLeave = () => {
    if (room) {
      socket.emit('apuestas-leave', { roomId: room.id });
    }
    window.__apuestasRoom = null;
    window.__apuestasPlayer = null;
    onNavigate(VIEWS.GAMES);
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleLeave} className="text-gray-400 hover:text-white">
            ← Salir
          </button>
          <h1 className="text-xl font-bold">Configurar</h1>
          <div className="w-16"></div>
        </div>

        {/* Info del juego */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm">Objetivo</p>
            <p className="text-6xl font-bold text-yellow-400">{targetNumber}.0000</p>
            <p className="text-gray-500 text-xs mt-2">segundos</p>
          </div>
        </div>

        {isHost ? (
          <>
            {/* Selector de número */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold mb-4">Elige el número objetivo</h2>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setTargetNumber(num)}
                    className={`w-10 h-10 rounded-lg font-bold ${
                      targetNumber === num
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de rondas */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold mb-4">Mejor de...</h2>
              <div className="flex gap-2 justify-center">
                {[1, 3, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRounds(r)}
                    className={`px-6 py-3 rounded-lg font-semibold ${
                      rounds === r
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {r} {r === 1 ? 'ronda' : 'rondas'}
                  </button>
                ))}
              </div>
            </div>

            {/* Botones de acción */}
            {room.state === 'config' ? (
              <button
                onClick={handleStartRound}
                className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-xl"
              >
                Comenzar Intento
              </button>
            ) : (
              <button
                onClick={handleSetConfig}
                disabled={isSettingConfig}
                className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-xl disabled:opacity-50"
              >
                {isSettingConfig ? 'Guardando...' : 'Confirmar Configuración'}
              </button>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg mt-4">
                {error}
              </div>
            )}

            <div className="mt-6 text-center text-gray-500 text-sm">
              <p>El objetivo es {targetNumber} segundos.</p>
              <p>El jugador que se acerque más gana la ronda.</p>
              <p>Mejor de {rounds} rondas.</p>
            </div>

            {/* Historial de winners por ronda */}
            {roundWinners.length > 0 && (
              <div className="mt-6 bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Ganadores por Ronda</h3>
                <div className="space-y-2">
                  {roundWinners.map((rw, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-700 rounded p-2">
                      <span className="text-gray-400">Ronda {rw.round}</span>
                      <span className="font-semibold text-yellow-400">{rw.winnerName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Vista de no-host */
          <div className="text-center">
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              {room.state === 'lobby' ? (
                <>
                  <p className="text-gray-400 mb-4">Esperando que el host configure el juego...</p>
                  <div className="animate-pulse">
                    <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto animate-spin"></div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mb-2">El host ha configurado el juego</p>
                  <p className="text-yellow-400 font-bold text-3xl mb-2">{targetNumber}.0000</p>
                  <p className="text-blue-400 mb-4">Mejor de {rounds} {rounds === 1 ? 'ronda' : 'rondas'}</p>
                  <p className="text-gray-500">Esperando que el host inicie...</p>
                  <div className="animate-pulse mt-4">
                    <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full mx-auto animate-spin"></div>
                  </div>
                </>
              )}
            </div>
            
            {/* Botón de salir para no-host */}
            <button
              onClick={handleLeave}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
            >
              Salir de la sala
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
