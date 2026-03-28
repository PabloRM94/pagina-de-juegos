import { useState, useEffect } from 'react';
import { VIEWS } from '../constants/index.js';
import { ROUND_NAMES } from '../utils/timesupLocalEngine.js';

/**
 * Vista de resultado de ronda
 */
export function TimesupNewRoundResultView({ onNavigate }) {
  const [roundData, setRoundData] = useState(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Cargar datos de la ronda
    const savedRound = sessionStorage.getItem('timesupnew_roundData');
    const savedState = sessionStorage.getItem('timesupnew_state');
    
    if (savedRound && savedState) {
      setRoundData(JSON.parse(savedRound));
      setGameState(JSON.parse(savedState));
    } else {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
    }
  }, [onNavigate]);

  // Continuar a siguiente ronda
  const handleNextRound = () => {
    if (!gameState) return;
    
    // Importar el motor
    import('../utils/timesupLocalEngine.js').then(module => {
      const { startNewRound } = module;
      
      const newState = startNewRound(gameState);
      sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
      
      // Guardar datos para pantalla de pasar móvil
      sessionStorage.setItem('timesupnew_passData', JSON.stringify({
        teamId: newState.currentTeamTurn,
        teamName: newState.teams[newState.currentTeamTurn]?.name || 'Equipo',
        playerName: newState.teams[newState.currentTeamTurn]?.players?.[0] || 'Jugador',
        isEndOfRound: false
      }));
      
      onNavigate(VIEWS.TIMESUP_NEW_PASS);
    });
  };

  // Terminar juego
  const handleEndGame = () => {
    onNavigate(VIEWS.TIMESUP_NEW_FINAL);
  };

  if (!roundData || !gameState) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  // Calcular líder
  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);
  const leader = sortedTeams[0];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-white mb-2">
            🥳 Ronda {roundData.round} Completada
          </h1>
          <p className="text-gray-400">
            {ROUND_NAMES[roundData.round]}
          </p>
        </div>

        {/* Líder actual */}
        {leader && (
          <div className="bg-yellow-500/20 border-2 border-yellow-500/50 rounded-2xl p-6 text-center">
            <p className="text-yellow-400 text-sm mb-2">🏆 Líder Actual</p>
            <p className="text-2xl font-bold text-white">{leader.name}</p>
            <p className="text-yellow-400 text-xl">{leader.score} puntos</p>
          </div>
        )}

        {/* Tabla de scores por equipo */}
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

        {/* Scores por ronda */}
        {roundData.roundScores && Object.keys(roundData.roundScores).length > 0 && (
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-3">Por Ronda</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-2">Ronda</th>
                    {gameState.teams.map(team => (
                      <th key={team.id} className="text-center py-2">{team.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(roundData.roundScores).map(([round, scores]) => (
                    <tr key={round} className="border-t border-gray-700">
                      <td className="text-gray-400 py-2">{ROUND_NAMES[round] || `Ronda ${round}`}</td>
                      {gameState.teams.map(team => (
                        <td key={team.id} className="text-center text-white py-2">
                          {scores[team.id] || 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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

        {/* Botón salir */}
        <button
          onClick={() => {
            sessionStorage.removeItem('timesupnew_gameData');
            sessionStorage.removeItem('timesupnew_state');
            sessionStorage.removeItem('timesupnew_roundData');
            sessionStorage.removeItem('timesupnew_passData');
            onNavigate(VIEWS.GAMES);
          }}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Salir del Juego
        </button>
      </div>
    </div>
  );
}

export default TimesupNewRoundResultView;
