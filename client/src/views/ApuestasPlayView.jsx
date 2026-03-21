import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../hooks/useSocket.js';
import { VIEWS } from '../constants/views.js';

export default function ApuestasPlayView({ onNavigate }) {
  const socket = getSocket();
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [hasStopped, setHasStopped] = useState(false);
  const [myTime, setMyTime] = useState(null);
  const [error, setError] = useState('');
  
  const intervalRef = useRef(null);

  useEffect(() => {
    const roomData = window.__apuestasRoom;
    const playerData = window.__apuestasPlayer;
    if (roomData) setRoom(roomData);
    if (playerData) setPlayer(playerData);

    // Iniciar cronómetro
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - startTime) / 1000;
      setElapsed(elapsedSeconds);
    }, 10);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleApuestasPlayerStopped = (data) => {
      setMyTime(data.time);
      setHasStopped(true);
    };

    const handleApuestasRoundEnded = (data) => {
      if (room && data.roomId === room.id) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        
        // Guardar roundWinners en window.__apuestasRoom
        if (data.roundWinners) {
          window.__apuestasRoom = { ...window.__apuestasRoom, roundWinners: data.roundWinners };
        }
        
        window.__apuestasResults = data;
        onNavigate(VIEWS.APUESTAS_RESULT);
      }
    };

    const handleApuestasTieBreaker = (data) => {
      if (room && data.roomId === room.id) {
        setHasStopped(false);
        setMyTime(null);
        
        const startTime = Date.now();
        intervalRef.current = setInterval(() => {
          const now = Date.now();
          const elapsedSeconds = (now - startTime) / 1000;
          setElapsed(elapsedSeconds);
        }, 10);
      }
    };

    socket.on('apuestas-player-stopped', handleApuestasPlayerStopped);
    socket.on('apuestas-round-ended', handleApuestasRoundEnded);
    socket.on('apuestas-tie-breaker', handleApuestasTieBreaker);

    return () => {
      socket.off('apuestas-player-stopped', handleApuestasPlayerStopped);
      socket.off('apuestas-round-ended', handleApuestasRoundEnded);
      socket.off('apuestas-tie-breaker', handleApuestasTieBreaker);
    };
  }, [room, onNavigate]);

  const handleStop = () => {
    if (hasStopped || !room) return;

    socket.emit('apuestas-stop', { roomId: room.id }, (response) => {
      if (response.success) {
        setHasStopped(true);
        setError('');
      } else {
        setError(response.error);
      }
    });
  };

  // Formatear tiempo como 05.0000
  const formatTime = (seconds) => {
    const secs = Math.floor(seconds);
    const millis = Math.round((seconds - secs) * 10000);
    return `${secs.toString().padStart(2, '0')}.${millis.toString().padStart(4, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Indicador de ronda */}
        <div className="mb-4 text-center">
          <p className="text-gray-400">Ronda {room?.config?.currentRound} de {room?.config?.totalRounds}</p>
          <p className="text-yellow-400 font-semibold">Objetivo: {room?.config?.targetNumber}.0000</p>
        </div>

        {/* Cronómetro principal */}
        <div className="mb-8">
          <div className="text-7xl font-mono font-bold text-white tracking-wider">
            {formatTime(elapsed)}
          </div>
        </div>

        {/* Mi tiempo si paré */}
        {hasStopped && myTime !== null && (
          <div className="mb-8 text-center">
            <p className="text-gray-400">Tu tiempo:</p>
            <p className="text-3xl font-bold text-green-400">{formatTime(myTime)}</p>
            <p className="text-gray-500 text-sm mt-2">Esperando a los demás...</p>
          </div>
        )}

        {/* Botón STOP */}
        {!hasStopped && (
          <button
            onClick={handleStop}
            className="w-48 h-48 rounded-full font-bold text-3xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/50 transition-transform active:scale-95"
          >
            STOP
          </button>
        )}

        {error && (
          <div className="mt-4 bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Footer con info */}
      <div className="text-center text-gray-500 text-sm mt-4">
        <p>Pulsa STOP cuando creas que ha pasado el tiempo objetivo</p>
      </div>
    </div>
  );
}
