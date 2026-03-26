import { useState } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Lobby de BeerPong Tournament
 * El host configura: modo de juego, número de equipos y jugadores por equipo
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function BeerpongLobbyView({ onNavigate }) {
  const { socket } = useSocket();
  const [playerName, setPlayerName] = useState('');
  const [gameMode, setGameMode] = useState('liga'); // 'liga' o 'playoff'
  const [teamsCount, setTeamsCount] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Crear tournament
  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('beerpong-create', { 
          teamsCount, 
          playersPerTeam, 
          gameMode,
          playerName 
        }, (response) => {
          console.log('beerpong-create response:', response);
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      // Guardar en sessionStorage
      sessionStorage.setItem('beerpong_roomId', result.roomId);
      sessionStorage.setItem('beerpong_host', socket.id);

      // Navegar a Setup para añadir equipos
      onNavigate(VIEWS.BEERPONG_SETUP);
    } catch (err) {
      console.error('Error al crear:', err);
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Obtener descripción del formato según configuración
  const getFormatDescription = () => {
    if (gameMode === 'liga') {
      if (teamsCount <= 5) {
        if (teamsCount < 4) {
          return '1 grupo • Todos vs todos • Campeón directo';
        }
        return '1 grupo • Todos vs todos → Semifinales → Final';
      } else {
        const g1 = Math.floor(teamsCount / 2);
        const g2 = teamsCount - g1;
        return `${g1}+${g2} equipos en 2 grupos → Cruces → Final`;
      }
    } else {
      // Playoff
      const nextPower = Math.pow(2, Math.ceil(Math.log2(teamsCount)));
      const byes = nextPower - teamsCount;
      
      if (teamsCount === 2) return 'Final directa';
      if (teamsCount === 3 || teamsCount === 4) return 'Semifinales → Final';
      if (byes > 0) return `${byes} byes → Cuartos → Semifinales → Final`;
      return 'Octavos → Cuartos → Semifinales → Final';
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 BeerPong</h1>
          <p className="text-gray-400">Torneo de beerpong</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Nombre del jugador (host) */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <label className="block text-gray-400 text-sm mb-2">Tu nombre (Host)</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Ingresa tu nombre"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Configuración del torneo */}
        <div className="space-y-4">
          {/* Modo de juego */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-3">Modo de Juego</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGameMode('liga')}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  gameMode === 'liga'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⚽ Liga
              </button>
              <button
                type="button"
                onClick={() => setGameMode('playoff')}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  gameMode === 'playoff'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⚔️ Playoff
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {gameMode === 'liga' ? 'Fase de grupos + Eliminación' : 'Eliminación directa'}
            </p>
          </div>

          {/* Número de equipos */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-3">Número de equipos</label>
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setTeamsCount(num)}
                  className={`flex-1 min-w-[40px] py-2 rounded-lg font-medium transition-colors ${
                    teamsCount === num
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-amber-400 text-xs mt-2">
              {getFormatDescription()}
            </p>
          </div>

          {/* Jugadores por equipo */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-3">Jugadores por equipo</label>
            <div className="flex gap-2">
              {[1, 2].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setPlayersPerTeam(num)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    playersPerTeam === num
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num} {num === 1 ? 'jugador' : 'jugadores'}
                </button>
              ))}
            </div>
          </div>

          {/* Botón crear */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !playerName.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {isCreating ? 'Creando...' : 'Crear Torneo'}
          </button>
        </div>

        {/* Volver a juegos */}
        <button
          onClick={() => onNavigate(VIEWS.GAMES)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          ← Volver a Juegos
        </button>
      </div>
    </div>
  );
}

export default BeerpongLobbyView;