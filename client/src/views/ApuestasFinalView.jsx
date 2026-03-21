import { useState, useEffect } from 'react';
import { getSocket } from '../hooks/useSocket.js';
import Avatar from '../components/Avatar.jsx';
import { VIEWS } from '../constants/views.js';

export default function ApuestasFinalView({ onNavigate }) {
  const socket = getSocket();
  const [results, setResults] = useState(null);
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const data = window.__apuestasFinalResults;
    if (data) {
      setResults(data);
    }

    const roomData = window.__apuestasRoom;
    const playerData = window.__apuestasPlayer;
    if (roomData) setRoom(roomData);
    if (playerData) setPlayer(playerData);

    const handleApuestasGameEnded = (data) => {
      setResults(data);
    };

    socket.on('apuestas-game-ended', handleApuestasGameEnded);

    return () => {
      socket.off('apuestas-game-ended', handleApuestasGameEnded);
    };
  }, []);

  const isWinner = results?.winner === player?.id;
  const roundWinners = results?.roundWinners || [];

  const handleBackToMenu = () => {
    if (room) {
      socket.emit('apuestas-leave', { roomId: room.id });
    }
    // Limpiar datos globales
    window.__apuestasRoom = null;
    window.__apuestasPlayer = null;
    window.__apuestasResults = null;
    window.__apuestasFinalResults = null;
    
    onNavigate(VIEWS.GAMES);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Winner principal */}
        <div className="text-center mb-8">
          {isWinner ? (
            <>
              <p className="text-4xl mb-4">🏆</p>
              <h1 className="text-3xl font-bold text-yellow-400 mb-4">¡GANASTE!</h1>
              <Avatar 
                style="adventurer" 
                seed={player?.name} 
                size={100} 
                className="mx-auto"
              />
              <p className="mt-4 text-xl">{player?.name}</p>
            </>
          ) : (
            <>
              <p className="text-4xl mb-4">😢</p>
              <h1 className="text-2xl font-bold mb-4">Fin del Juego</h1>
              <Avatar 
                style="adventurer" 
                seed={results?.winnerName || 'Winner'} 
                size={100} 
                className="mx-auto"
              />
              <p className="mt-4 text-xl font-bold text-yellow-400">
                {results?.winnerName || 'Ganador'}
              </p>
              <p className="text-gray-400">ganó la partida</p>
            </>
          )}
        </div>

        {/* Historial de winners por ronda */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-center">Historial de Rondas</h2>
          <div className="space-y-2">
            {roundWinners.length > 0 ? (
              roundWinners.map((rw, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-3 p-3 rounded bg-gray-700"
                >
                  <span className="text-gray-400 w-20">Ronda {rw.round}</span>
                  <Avatar style="adventurer" seed={rw.winnerName} size={32} />
                  <span className="flex-1 font-semibold">{rw.winnerName}</span>
                  <span className="text-yellow-400">✓</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">No hay rondas jugadas</p>
            )}
          </div>
        </div>

        {/* Botón volver */}
        <button
          onClick={handleBackToMenu}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-lg"
        >
          Volver al Menú
        </button>
      </div>
    </div>
  );
}
