import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de resultados finales
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function TimesUpFinalResultView({ onNavigate }) {
  const { socket } = useSocket();
  
  // Leer datos de sessionStorage
  const storedTeams = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
  const storedConfig = JSON.parse(sessionStorage.getItem('timesup_config') || '{}');
  
  const [teams, setTeams] = useState(storedTeams);
  const [leaderboard, setLeaderboard] = useState([]);
  const [winner, setWinner] = useState(null);
  const [finalScores, setFinalScores] = useState([]);
  const [roundScores, setRoundScores] = useState({});
  const [isWinner, setIsWinner] = useState(false);

  // Calcular leaderboard desde teams
  useEffect(() => {
    const sorted = [...teams]
      .map((t, i) => ({ 
        teamId: i, 
        teamName: t.name, 
        score: t.score 
      }))
      .sort((a, b) => b.score - a.score);
    
    setLeaderboard(sorted);
    setWinner(sorted[0] || null);
    setFinalScores(teams.map((t, i) => ({
      teamId: i,
      teamName: t.name,
      score: t.score
    })));

    // Verificar si mi equipo ganó
    const myTeam = teams.find(t => t.players.includes(socket.id));
    if (myTeam && sorted[0]) {
      setIsWinner(myTeam.score === sorted[0].score && myTeam.score > 0);
    }
  }, [teams, socket.id]);

    // Escuchar eventos
  useEffect(() => {
    const handleGameEnded = (data) => {
      // Actualizar datos desde el evento
      if (data.leaderboard) {
        const updatedTeams = teams.map((t, i) => {
          const lbEntry = data.leaderboard.find(l => l.teamId === i);
          return lbEntry ? { ...t, score: lbEntry.score } : t;
        });
        setTeams(updatedTeams);
        sessionStorage.setItem('timesup_teams', JSON.stringify(updatedTeams));
      }
      
      // Guardar roundScores si viene en el evento - formato: { 1: {0: 5, 1: 3}, 2: {...} }
      if (data.roundScores) {
        setRoundScores(data.roundScores);
      } else if (data.finalScores) {
        // Fallback si no viene roundScores
        const scores = {};
        data.finalScores.forEach(fs => {
          scores[fs.teamId] = fs.score;
        });
        setRoundScores(scores);
      }
    };

    socket.on('timesup-game-ended', handleGameEnded);

    return () => {
      socket.off('timesup-game-ended', handleGameEnded);
    };
  }, [socket, teams]);

  const handlePlayAgain = () => {
    // Limpiar sessionStorage para el siguiente juego
    sessionStorage.removeItem('timesup_roomId');
    sessionStorage.removeItem('timesup_teams');
    sessionStorage.removeItem('timesup_config');
    
    // Volver a Games
    onNavigate(VIEWS.GAMES);
  };

  // Verificar si hay empate
  const isTie = leaderboard.length > 1 && 
    leaderboard[0].score === leaderboard[1].score;

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header con celebración */}
        <div className="text-center pt-4">
          <div className="text-6xl mb-4">
            {isTie ? '🤝' : isWinner ? '🎉' : '🏆'}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isTie 
              ? '¡Empate!' 
              : isWinner 
                ? '¡GANASTE!' 
                :<>Has perdido,<br />¡Pringao, Pringao, Pringao!</>}
          </h1>
          {!isTie && winner && (
            <p className="text-yellow-400 text-xl font-bold">
              {winner.teamName}
            </p>
          )}
          <p className="text-gray-400 mt-2">
            con {winner?.score || 0} puntos
          </p>
        </div>

        {/* Tabla de clasificación final */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-4">Clasificación Final</p>
          
          <div className="space-y-3">
            {leaderboard.map((team, index) => {
              const isMyTeam = teams[team.teamId]?.players?.includes(socket.id);
              
              return (
                <div 
                  key={team.teamId}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    index === 0 
                      ? 'bg-yellow-500/20 border-2 border-yellow-500/50' 
                      : isMyTeam
                        ? 'bg-indigo-500/20 border border-indigo-500'
                        : 'bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-bold ${
                      index === 0 ? 'text-yellow-400' : 'text-gray-500'
                    }`}>
                      {index === 0 ? '🥇' : index + 1 + '°'}
                    </span>
                    <div>
                      <span className="text-white font-medium block">
                        {team.teamName}
                      </span>
                      {isMyTeam && (
                        <span className="text-indigo-400 text-xs">(Tu equipo)</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-2xl font-bold ${
                    index === 0 ? 'text-yellow-400' : 'text-white'
                  }`}>
                    {team.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle de puntuación por ronda */}
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Puntuación por rondas</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left py-2">Equipo</th>
                  {[1, 2, 3, 4].map(r => (
                    <th key={r} className="text-center py-2">R{r}</th>
                  ))}
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {finalScores.map((team) => (
                  <tr key={team.teamId} className="border-t border-gray-700">
                    <td className="text-white py-2">{team.teamName}</td>
                    {[1, 2, 3, 4].map(r => (
                      <td key={r} className="text-center text-gray-400 py-2">
                        {roundScores[r]?.[team.teamId] || 0}
                      </td>
                    ))}
                    <td className="text-right text-indigo-400 font-bold py-2">
                      {team.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Botón jugar de nuevo */}
        <button
          onClick={handlePlayAgain}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
        >
          🎮 Jugar de Nuevo
        </button>
      </div>
    </div>
  );
}

export default TimesUpFinalResultView;
