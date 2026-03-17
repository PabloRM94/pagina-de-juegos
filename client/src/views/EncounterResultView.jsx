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
 * Vista de resultado de encuentro
 * @param {object} props
 * @param {object} props.encounter - Resultado del encuentro
 * @param {object} props.currentPlayer - Jugador actual
 * @param {function} props.onContinue - Callback para continuar
 * @param {string} props.avatarStyle - Estilo de avatar
 */
export function EncounterResultView({ encounter, currentPlayer, onContinue, avatarStyle }) {
  if (!encounter) return null;
  
  const isAlly = encounter.isAlly === true;
  const lost = encounter?.loser?.id === currentPlayer?.id;
  const isWinner = encounter?.winner?.id === currentPlayer?.id;
  const amIInvolved = encounter?.player1?.id === currentPlayer?.id || encounter?.player2?.id === currentPlayer?.id;
  
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${lost ? 'bg-red-900/30' : ''}`}>
      <div className="w-full max-w-md">
        <Card className={`text-center ${lost ? 'border-red-500/50 bg-red-500/5' : isWinner ? 'border-green-500/50 bg-green-500/5' : ''}`}>
          <h2 className="text-2xl font-bold text-white mb-6">Resultado del Encuentro</h2>
          
          {/* Jugadores con roles */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* Jugador 1 */}
            <div className="text-center">
              <Avatar
                src={getPlayerAvatarUrl(avatarStyle, encounter.player1.name)}
                alt={encounter.player1.name}
                size="xl"
                className="mx-auto mb-2"
              />
              <p className="text-white font-medium">{encounter.player1.name}</p>
              <div className="mt-1 inline-flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-lg">
                <span className="text-xl">{getRoleEmoji(encounter.player1.role)}</span>
                <span className="text-gray-400 text-sm">{getRoleName(encounter.player1.role)}</span>
              </div>
              {encounter.player1.id === currentPlayer?.id && (
                <p className="text-indigo-400 text-xs mt-1">(vos)</p>
              )}
            </div>
            
            <div className="text-2xl text-gray-500">vs</div>
            
            {/* Jugador 2 */}
            <div className="text-center">
              <Avatar
                src={getPlayerAvatarUrl(avatarStyle, encounter.player2.name)}
                alt={encounter.player2.name}
                size="xl"
                className="mx-auto mb-2"
              />
              <p className="text-white font-medium">{encounter.player2.name}</p>
              <div className="mt-1 inline-flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-lg">
                <span className="text-xl">{getRoleEmoji(encounter.player2.role)}</span>
                <span className="text-gray-400 text-sm">{getRoleName(encounter.player2.role)}</span>
              </div>
              {encounter.player2.id === currentPlayer?.id && (
                <p className="text-indigo-400 text-xs mt-1">(vos)</p>
              )}
            </div>
          </div>
          
          {/* Resultado */}
          {isAlly ? (
            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl mb-6 border-2 border-blue-500/40">
              <p className="text-3xl font-bold text-blue-300 mb-2">¡Sois aliados!</p>
              <p className="text-gray-400 text-sm">El mismo rol = mismo equipo</p>
              <div className="mt-3 inline-flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full">
                <span>🤝</span>
                <span className="text-blue-300 text-sm">Aliado</span>
              </div>
            </div>
          ) : encounter.result === 'tie' ? (
            <div className="p-6 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-xl mb-6">
              <p className="text-2xl font-bold text-gray-300">Empate</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <div className={`p-6 rounded-xl border-2 ${
                isWinner 
                  ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border-yellow-500/40' 
                  : 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/40'
              }`}>
                <p className={`text-3xl font-bold ${isWinner ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  ¡{encounter.winner?.name} GANA!
                </p>
              </div>
              {encounter.loser && (
                <div className="p-6 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl border-2 border-red-500/30">
                  <p className="text-2xl font-bold text-red-400">
                    {encounter.loser?.name} Eliminado
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Botón continuar - solo si no estás eliminado */}
          {(amIInvolved && !lost) && (
            <button className="btn-primary" onClick={onContinue}>
              Continuar Jugando
            </button>
          )}
          
          {lost && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
                <p className="text-red-400 font-medium">Has sido eliminado</p>
                <p className="text-gray-400 text-sm mt-1">Tu equipo puede seguir jugando</p>
              </div>
              <button className="btn-primary" onClick={onContinue}>
                Volver al Juego
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default EncounterResultView;
