import { useState, useEffect } from 'react';
import { VIEWS } from '../constants/index.js';
import { ROUND_NAMES, getLeaderboard, getWinner } from '../utils/timesupLocalEngine.js';

/**
 * Vista de resultado final
 */
export function TimesupNewFinalView({ onNavigate }) {
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Cargar estado final
    const saved = sessionStorage.getItem('timesupnew_state');
    if (saved) {
      setGameState(JSON.parse(saved));
    } else {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
    }
  }, [onNavigate]);

  if (!gameState) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  const leaderboard = getLeaderboard(gameState);
  const winner = getWinner(gameState);
  const isTie = leaderboard.filter(t => t.score === winner?.score).length > 1;

  // Volver a juegos
  const handleBackToGames = () => {
    sessionStorage.removeItem('timesupnew_gameData');
    sessionStorage.removeItem('timesupnew_state');
    sessionStorage.removeItem('timesupnew_roundData');
    sessionStorage.removeItem('timesupnew_passData');
    onNavigate(VIEWS.GAMES);
  };

  // Jugar de nuevo
  const handlePlayAgain = () => {
    sessionStorage.removeItem('timesupnew_gameData');
    sessionStorage.removeItem('timesupnew_state');
    sessionStorage.removeItem('timesupnew_roundData');
    sessionStorage.removeItem('timesupnew_passData');
    onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isTie ? '¡Empate!' : '¡Ganador!'}
          </h1>
          {!isTie && winner && (
            <p className="text-2xl font-bold text-yellow-400">
              {winner.name}
            </p>
          )}
          {isTie && (
            <p className="text-gray-400">
              Los equiposempataron con {winner?.score} puntos
            </p>
          )}
        </div>

        {/* Tabla de clasificación final */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Clasificación Final</p>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div 
                key={entry.teamId}
                className={`flex justify-between items-center p-4 rounded-lg ${
                  index === 0 
                    ? 'bg-yellow-500/20 border-2 border-yellow-500/50' 
                    : index === 1
                      ? 'bg-gray-500/20 border-2 border-gray-500/50'
                      : index === 2
                        ? 'bg-orange-500/20 border-2 border-orange-500/50'
                        : 'bg-gray-700/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <div>
                    <p className="text-white font-bold">{entry.teamName}</p>
                    <p className="text-gray-500 text-xs">
                      {gameState.teams[entry.teamId]?.players?.join(', ') || ''}
                    </p>
                  </div>
                </div>
                <span className={`text-2xl font-bold ${
                  index === 0 ? 'text-yellow-400' : 'text-indigo-400'
                }`}>
                  {entry.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats por ronda */}
        {gameState.roundScores && Object.keys(gameState.roundScores).length > 0 && (
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-3">Puntuación por Ronda</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-2">Ronda</th>
                    {gameState.teams.map(team => (
                      <th key={team.id} className="text-center py-2">{team.name}</th>
                    ))}
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(gameState.roundScores).map(([round, scores]) => {
                    const roundTotal = Object.values(scores).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={round} className="border-t border-gray-700">
                        <td className="text-gray-400 py-2">{ROUND_NAMES[round] || `R${round}`}</td>
                        {gameState.teams.map(team => (
                          <td key={team.id} className="text-center text-white py-2">
                            {scores[team.id] || 0}
                          </td>
                        ))}
                        <td className="text-right text-indigo-400 py-2 font-medium">
                          {roundTotal}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="border-t-2 border-gray-600 bg-gray-800/50">
                    <td className="text-white font-bold py-2">Total</td>
                    {gameState.teams.map(team => (
                      <td key={team.id} className="text-center text-yellow-400 font-bold py-2">
                        {team.score}
                      </td>
                    ))}
                    <td className="text-right text-white font-bold py-2">
                      {gameState.teams.reduce((a, b) => a + b.score, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="space-y-3">
          <button
            onClick={handlePlayAgain}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
          >
            🎮 Jugar de Nuevo
          </button>
          
          <button
            onClick={handleBackToGames}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            ← Volver a Juegos
          </button>
        </div>
      </div>
    </div>
  );
}

export default TimesupNewFinalView;
