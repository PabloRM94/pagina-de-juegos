import { useState, useEffect } from 'react';
import { getSocket } from '../hooks/useSocket.js';
import Avatar from '../components/Avatar.jsx';
import { VIEWS } from '../constants/views.js';

export default function ApuestasResultView({ onNavigate }) {
  const socket = getSocket();
  const [results, setResults] = useState(null);
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const data = window.__apuestasResults;
    if (data) {
      setResults(data);
      // Guardar roundWinners cuando se reciben los resultados
      if (data.roundWinners) {
        window.__apuestasRoom = { ...window.__apuestasRoom, roundWinners: data.roundWinners };
      }
    }

    const roomData = window.__apuestasRoom;
    const playerData = window.__apuestasPlayer;
    if (roomData) setRoom(roomData);
    if (playerData) setPlayer(playerData);

    // Escuchar evento de siguiente ronda (para no-host)
    const handleNextRound = (data) => {
      const currentRoom = window.__apuestasRoom;
      if (currentRoom && data.roomId === currentRoom.id) {
        // Actualizar roundWinners en window.__apuestasRoom
        if (data.roundWinners) {
          window.__apuestasRoom = { ...currentRoom, roundWinners: data.roundWinners };
        }
        onNavigate(VIEWS.APUESTAS_CONFIG);
      }
    };
    socket.on('apuestas-next-round', handleNextRound);

    // Escuchar evento de fin de juego (para no-host)
    const handleGameEnded = (data) => {
      const currentRoom = window.__apuestasRoom;
      if (currentRoom && data.roomId === currentRoom.id) {
        window.__apuestasFinalResults = data;
        onNavigate(VIEWS.APUESTAS_FINAL);
      }
    };
    socket.on('apuestas-game-ended', handleGameEnded);

    return () => {
      socket.off('apuestas-next-round', handleNextRound);
      socket.off('apuestas-game-ended', handleGameEnded);
    };
  }, [room]);

  const isHost = room && player && room.host === player.id;
  const isWinner = results?.winner?.playerId === player?.id;
  const targetNumber = results?.targetNumber || 0;
  const isLastRound = results?.round >= results?.totalRounds;

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '---';
    const secs = Math.floor(seconds);
    const millis = Math.round((seconds - secs) * 10000);
    return `${secs.toString().padStart(2, '0')}.${millis.toString().padStart(4, '0')}`;
  };

  const handleNextRound = () => {
    if (!isHost) return;
    
    socket.emit('apuestas-next-round', { roomId: room.id }, (response) => {
      if (response.success) {
        onNavigate(VIEWS.APUESTAS_CONFIG);
      }
    });
  };

  const handleEndGame = () => {
    socket.emit('apuestas-end', { roomId: room.id }, (response) => {
      if (response.success) {
        window.__apuestasFinalResults = response;
        onNavigate(VIEWS.APUESTAS_FINAL);
      }
    });
  };

  const handleLeave = () => {
    if (room) {
      socket.emit('apuestas-leave', { roomId: room.id });
    }
    window.__apuestasRoom = null;
    window.__apuestasPlayer = null;
    window.__apuestasResults = null;
    onNavigate(VIEWS.GAMES);
  };

  // Ordenar resultados por diferencia
  const sortedResults = [...(results?.results || [])].sort((a, b) => a.diff - b.diff);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">
            {isWinner ? '🎉 ¡GANASTE!' : 'Resultados'}
          </h1>
          <p className="text-gray-400">Ronda {results?.round} de {results?.totalRounds}</p>
        </div>

        {/* Objetivo */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
          <p className="text-gray-400 text-sm">Objetivo</p>
          <p className="text-4xl font-bold text-yellow-400">{targetNumber}.0000</p>
        </div>

        {/* Winner de la ronda */}
        {results?.winner && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6 text-center">
            <p className="text-green-400 font-semibold mb-2">Ganador de la ronda:</p>
            <div className="flex items-center justify-center gap-3">
              <Avatar style="adventurer" seed={results.winner.playerName} size={48} />
              <span className="text-xl font-bold">{results.winner.playerName}</span>
            </div>
          </div>
        )}

        {/* Tabla de resultados */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Tiempos</h2>
          <div className="space-y-2">
            {sortedResults.map((r, i) => (
              <div 
                key={r.playerId} 
                className={`flex items-center gap-3 p-2 rounded ${
                  r.playerId === results.winner?.playerId ? 'bg-green-900/50' : 'bg-gray-700'
                }`}
              >
                <span className="text-gray-500 w-6">#{i + 1}</span>
                <Avatar style="adventurer" seed={r.playerName} size={32} />
                <span className="flex-1">{r.playerName}</span>
                <span className="font-mono text-lg">{formatTime(r.time)}</span>
                <span className="text-xs text-gray-500">
                  {r.disconnected ? '❌' : `±${r.diff.toFixed(4)}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Botones - Solo para el host */}
        {isHost && (
          <div className="space-y-3">
            {isLastRound ? (
              <button
                onClick={handleEndGame}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
              >
                Ver Ganador Final
              </button>
            ) : (
              <button
                onClick={handleNextRound}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold"
              >
                Siguiente Ronda
              </button>
            )}
          </div>
        )}

        {/* Botón salir para todos */}
        {!isHost && (
          <button
            onClick={handleLeave}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
          >
            Salir de la sala
          </button>
        )}
      </div>
    </div>
  );
}
