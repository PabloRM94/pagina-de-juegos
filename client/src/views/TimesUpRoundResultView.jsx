import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de resultados de ronda
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function TimesUpRoundResultView({ onNavigate }) {
  const { socket } = useSocket();
  
  // Leer datos de sessionStorage - solo una vez al montar
  const storedRoomId = sessionStorage.getItem('timesup_roomId') || '';
  const initialTeams = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
  const storedConfig = JSON.parse(sessionStorage.getItem('timesup_config') || '{}');
  const storedRoundData = JSON.parse(sessionStorage.getItem('timesup_roundData') || '{}');
  
  const [roomId] = useState(storedRoomId);
  const [teams, setTeams] = useState(initialTeams);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentRound, setCurrentRound] = useState(() => storedRoundData.round || 1);
  const [scores, setScores] = useState({});
  // Usar el totalRounds de la config guardada, o inferir del roundData
  const [totalRounds, setTotalRounds] = useState(() => {
    // Primero usar storedConfig
    if (storedConfig.totalRounds) return storedConfig.totalRounds;
    // Si es última ronda según roundData
    if (storedRoundData.isLastRound) return storedRoundData.round;
    // Default
    return 3;
  });
  const [isNavigating, setIsNavigating] = useState(false);

  // Calcular leaderboard desde teams - solo cuando teams cambia
  useEffect(() => {
    if (teams.length === 0) return;
    
    const sorted = [...teams]
      .map((t, i) => ({ 
        teamId: i, 
        teamName: t.name, 
        score: t.score 
      }))
      .sort((a, b) => b.score - a.score);
    
    setLeaderboard(sorted);
  }, [teams]);

  // Inicializar leaderboard
  useEffect(() => {
    if (initialTeams.length > 0 && leaderboard.length === 0) {
      const sorted = [...initialTeams]
        .map((t, i) => ({ 
          teamId: i, 
          teamName: t.name, 
          score: t.score 
        }))
        .sort((a, b) => b.score - a.score);
      setLeaderboard(sorted);
    }
  }, []);

  // Escuchar eventos - solo montar una vez
  useEffect(() => {
    const getStoredRoomId = () => sessionStorage.getItem('timesup_roomId');
    
    const handleRoundEnded = (data) => {
      // Ignorar si ya estamos navigando
      if (isNavigating) return;
      
      console.log('[TimesUpRoundResult] handleRoundEnded:', data);
      
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      setIsNavigating(true);
      
      // Actualizar datos desde el evento
      setCurrentRound(data.round);
      setScores(data.scores || {});
      
      // Actualizar teams con los scores
      if (data.leaderboard) {
        const currentTeams = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
        const updatedTeams = currentTeams.map((t, i) => {
          const lbEntry = data.leaderboard.find(l => l.teamId === i);
          return lbEntry ? { ...t, score: lbEntry.score } : t;
        });
        setTeams(updatedTeams);
        sessionStorage.setItem('timesup_teams', JSON.stringify(updatedTeams));
      }
    };

    // Cuando otro jugador inicia la siguiente ronda
    const handleNextRound = (data) => {
      console.log('[TimesUpRoundResult] handleNextRound:', data);
      
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      // Actualizar datos
      if (data.leaderboard) {
        const updatedTeams = teams.map((t, i) => {
          const lbEntry = data.leaderboard.find(l => l.teamId === i);
          return lbEntry ? { ...t, score: lbEntry.score } : t;
        });
        sessionStorage.setItem('timesup_teams', JSON.stringify(updatedTeams));
      }
      
      // Actualizar roundData
      const roundData = {
        round: data.currentRound,
        roundName: data.roundName,
        totalWords: data.totalWords,
        wordsUsed: data.wordsUsed,
        leaderboard: data.leaderboard,
        isLastRound: data.isLastRound
      };
      sessionStorage.setItem('timesup_roundData', JSON.stringify(roundData));
      
      // Navegar de vuelta a PlayView
      onNavigate(VIEWS.TIMESUP_PLAY);
    };
    
    socket.on('timesup-round-ended', handleRoundEnded);
    socket.on('timesup-next-round', handleNextRound);

    return () => {
      socket.off('timesup-round-ended', handleRoundEnded);
      socket.off('timesup-next-round', handleNextRound);
    };
  }, [socket, isNavigating]);

  const handleNextRound = async () => {
    // Leer roomId directamente de sessionStorage
    const currentRoomId = sessionStorage.getItem('timesup_roomId') || roomId;
    
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-end-round', { roomId: currentRoomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      
      onNavigate(VIEWS.TIMESUP_PLAY);
    } catch (err) {
      console.error('Error al iniciar siguiente ronda:', err);
    }
  };

  const nextRound = currentRound + 1;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">
            📊 Ronda {currentRound} Terminada
          </h1>
          <p className="text-gray-400">
            {nextRound <= totalRounds 
              ? `Próxima: Ronda ${nextRound}` 
              : '¡Última ronda completada!'}
          </p>
        </div>

        {/* Podio - Gráfica de barras */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-4">🏆 Posiciones</p>
          
          <div className="space-y-3">
            {leaderboard.map((team, index) => {
              const maxScore = leaderboard[0]?.score || 1;
              const percentage = maxScore > 0 ? (team.score / maxScore) * 100 : 0;
              
              return (
                <div key={team.teamId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-bold ${
                        index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1 + '°'}
                      </span>
                      <span className="text-white font-medium">{team.teamName}</span>
                    </div>
                    <span className={`text-lg font-bold ${
                      index === 0 ? 'text-yellow-400' : 'text-indigo-400'
                    }`}>
                      {team.score} pts
                    </span>
                  </div>
                  <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        index === 0 
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' 
                          : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scores por ronda */}
        {scores[currentRound] && (
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-3">Puntos de esta ronda</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(scores[currentRound]).map(([teamId, score]) => {
                const team = leaderboard.find(t => t.teamId === parseInt(teamId));
                return (
                  <div key={teamId} className="bg-gray-700/50 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">{team?.teamName || `Equipo ${teamId}`}</p>
                    <p className="text-indigo-400 font-bold text-lg">+{score}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botón siguiente ronda */}
        {nextRound <= totalRounds && (
          <button
            onClick={handleNextRound}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
          >
            🎮 Iniciar Ronda {nextRound}
          </button>
        )}

        {/* Botón ver resultados finales (si es la última ronda) */}
        {nextRound > totalRounds && (
          <button
            onClick={handleNextRound}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
          >
            🏆 Ver Resultados Finales
          </button>
        )}

        {(nextRound > totalRounds) && (
          <div className="text-center text-gray-500">
            <p>Esperando que el host inicie la siguiente ronda...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimesUpRoundResultView;
