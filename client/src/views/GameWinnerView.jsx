import { Card, Avatar } from '../components/index.js';
import { getPlayerAvatarUrl } from '../utils/avatar.js';

// Helper para obtener emoji del rol
const getRoleEmoji = (role) => {
  switch (role) {
    case 'piedra': return '🪨';
    case 'papel': return '📄';
    case 'tijera': return '✂️';
    default: return '';
  }
};

// Helper para obtener nombre del rol
const getRoleName = (role) => {
  switch (role) {
    case 'piedra': return 'Piedra';
    case 'papel': return 'Papel';
    case 'tijera': return 'Tijera';
    default: return '';
  }
};

/**
 * Vista de victoria del juego
 * Muestra cuando un equipo gana
 * @param {object} props
 * @param {object} props.gameFinished - Info de victoria
 * @param {object} props.currentPlayer - Jugador actual
 * @param {function} props.onBackToDashboard - Volver al dashboard
 * @param {string} props.avatarStyle - Estilo de avatar
 */
export function GameWinnerView({ gameFinished, currentPlayer, onBackToDashboard, avatarStyle }) {
  if (!gameFinished) return null;
  
  const { winningTeam, winningPlayers } = gameFinished;
  const playerWon = winningPlayers?.some(p => p.id === currentPlayer?.id);
  
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      playerWon ? 'bg-gradient-to-b from-yellow-900/50 to-amber-900/30' : 'bg-gray-900/50'
    }`}>
      <div className="w-full max-w-md">
        <Card className={`text-center ${
          playerWon 
            ? 'bg-gradient-to-br from-yellow-600/20 to-amber-600/20 border-yellow-500/50' 
            : 'bg-gray-800/50 border-gray-700'
        }`}>
          {/* Trofeo / Medalla */}
          <div className="mb-6">
            <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${
              playerWon 
                ? 'bg-gradient-to-br from-yellow-400 to-amber-600 shadow-lg shadow-yellow-500/30' 
                : 'bg-gray-700'
            }`}>
              <span className="text-6xl">{playerWon ? '🏆' : '🎮'}</span>
            </div>
          </div>
          
          {/* Título */}
          {playerWon ? (
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-yellow-400 mb-2">¡VICTORIA!</h2>
              <p className="text-gray-300">Tu equipo ha ganado la partida</p>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-400 mb-2">¡FIN DEL JUEGO!</h2>
              <p className="text-gray-400">Otro equipo ha ganado la partida</p>
            </div>
          )}
          
          {/* Equipo ganador */}
          <div className="mb-6 p-4 bg-white/5 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-3xl">{getRoleEmoji(winningTeam)}</span>
              <span className="text-xl font-bold text-white">Equipo {getRoleName(winningTeam)}</span>
            </div>
            <p className="text-gray-400 text-sm mb-3">Miembros del equipo ganador:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {winningPlayers?.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
                  <Avatar
                    src={getPlayerAvatarUrl(avatarStyle, p.name)}
                    alt={p.name}
                    size="xs"
                  />
                  <span className="text-white text-sm">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Estado del jugador */}
          {currentPlayer?.eliminated && playerWon ? (
            <div className="mb-6 p-4 bg-red-500/10 rounded-xl border border-red-500/30">
              <p className="text-red-400 font-medium">Fuiste eliminado durante la partida</p>
              <p className="text-gray-400 text-sm mt-1">Pero tu equipo finalmente ganó</p>
            </div>
          ) : currentPlayer?.eliminated && !playerWon ? (
            <div className="mb-6 p-4 bg-gray-500/10 rounded-xl">
              <p className="text-gray-400">Fuiste eliminado y tu equipo perdió</p>
            </div>
          ) : !playerWon ? (
            <div className="mb-6 p-4 bg-gray-500/10 rounded-xl">
              <p className="text-gray-400">Tu equipo fue eliminado</p>
            </div>
          ) : null}
          
          {/* Botón volver */}
          <button className="btn-primary w-full" onClick={onBackToDashboard}>
            Volver al Dashboard
          </button>
        </Card>
      </div>
    </div>
  );
}

export default GameWinnerView;
