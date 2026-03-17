import { Card, Avatar } from '../components/index.js';
import { getPlayerAvatarUrl } from '../utils/avatar.js';

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
  
  const lost = encounter?.loser?.id === currentPlayer?.id;
  
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${lost ? 'bg-red-900/30' : ''}`}>
      <div className="w-full max-w-md">
        <Card className={`text-center ${lost ? 'border-red-500/50 bg-red-500/5' : ''}`}>
          <h2 className="text-2xl font-bold text-white mb-8">Resultado del Encuentro</h2>
          
          {/* Jugadores */}
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <Avatar
                src={getPlayerAvatarUrl(avatarStyle, encounter.player1.name)}
                alt={encounter.player1.name}
                size="xl"
                className="mx-auto mb-2"
              />
              <p className="text-white font-medium">{encounter.player1.name}</p>
            </div>
            <div className="text-2xl">vs</div>
            <div className="text-center">
              <Avatar
                src={getPlayerAvatarUrl(avatarStyle, encounter.player2.name)}
                alt={encounter.player2.name}
                size="xl"
                className="mx-auto mb-2"
              />
              <p className="text-white font-medium">{encounter.player2.name}</p>
            </div>
          </div>
          
          {/* Resultado */}
          {encounter.result === 'tie' ? (
            <div className="p-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl mb-6">
              <p className="text-3xl font-bold text-blue-300">¡Sois aliados!</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <div className="p-6 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border-2 border-emerald-500/40">
                <p className="text-3xl font-bold text-emerald-400">
                  ¡{encounter.winner?.name} GANA!
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl border-2 border-red-500/30">
                <p className="text-2xl font-bold text-red-400">
                  {encounter.loser?.name} Eliminado
                </p>
              </div>
            </div>
          )}
          
          <button className="btn-primary" onClick={onContinue}>
            Continuar
          </button>
        </Card>
      </div>
    </div>
  );
}

export default EncounterResultView;
