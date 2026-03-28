import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de resultado de ronda
 */
export function TimesupNewRoundResultView({ onNavigate }) {
  const { socket } = useSocket();
  const [roomId, setRoomId] = useState('');
  const [roundData, setRoundData] = useState(null);
  const [teams, setTeams] = useState([]);
  
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('timesupnew_roomId');
    if (!storedRoomId) {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
      return;
    }
    
    setRoomId(storedRoomId);
    
    // Cargar datos
    const saved = sessionStorage.getItem('timesupnew_roundData');
    if (saved) {
      setRoundData(JSON.parse(saved));
    }
    
    // Obtener estado actual
    socket.emit('timesupnew-get-state', { roomId: storedRoomId }, (response) => {
      if (response.success) {
        setTeams(response.teams || []);
      }
    });
  }, [socket, onNavigate]);
  
  const handleNextRound = async () => {
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-next-round', { roomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      
      // Guardar datos para pass
      sessionStorage.setItem('timesupnew_passData', JSON.stringify({
        teamId: 0,
        teamName: 'Equipo A',
        playerName: 'Jugador',
        isEndOfRound: false
      }));
      
      onNavigate(VIEWS.TIMESUP_NEW_PASS);
    } catch (err) {
      console.error('Error:', err);
    }
  };
  
  const handleEndGame = () => {
    onNavigate(VIEWS.TIMESUP_NEW_FINAL);
  };
  
  if (!roundData) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }
  
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const leader = sortedTeams[0];
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-white mb-2">🥳 Ronda {roundData.round} Completada</h1>
          <p className="text-gray-400">{roundData.roundName}</p>
        </div>
        
        {/* Líder */}
        {leader && (
          <div className="bg-yellow-500/20 border-2 border-yellow-500/50 rounded-2xl p-6 text-center">
            <p className="text-yellow-400 text-sm mb-2">🏆 Líder Actual</p>
            <p className="text-2xl font-bold text-white">{leader.name}</p>
            <p className="text-yellow-400 text-xl">{leader.score} puntos</p>
          </div>
        )}
        
        {/* Scores */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Puntuación Total</p>
          <div className="space-y-2">
            {sortedTeams.map((team, index) => (
              <div 
                key={team.id}
                className={`flex justify-between items-center p-3 rounded-lg ${
                  index === 0 ? 'bg-yellow-500/20' : 'bg-gray-700/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <span className="text-white font-medium">{team.name}</span>
                </div>
                <span className={`text-xl font-bold ${
                  index === 0 ? 'text-yellow-400' : 'text-indigo-400'
                }`}>
                  {team.score}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Botón siguiente */}
        {roundData.isLastRound ? (
          <button
            onClick={handleEndGame}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
          >
            🏆 Ver Resultados Finales
          </button>
        ) : (
          <button
            onClick={handleNextRound}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
          >
            ➡️ Siguiente Ronda
          </button>
        )}
      </div>
    </div>
  );
}

export default TimesupNewRoundResultView;
