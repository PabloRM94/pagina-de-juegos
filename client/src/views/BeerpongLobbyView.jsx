import { useState } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Lobby de BeerPong Tournament
 * El host configura: número de equipos y jugadores por equipo
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function BeerpongLobbyView({ onNavigate }) {
  const { socket } = useSocket();
  const [playerName, setPlayerName] = useState('');
  const [teamsCount, setTeamsCount] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [minMatchesPerTeam, setMinMatchesPerTeam] = useState(1);
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
          minMatchesPerTeam,
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
          {/* Número de equipos */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-3">Número de equipos</label>
            <div className="flex gap-2">
              {[4, 6, 8, 12, 16].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setTeamsCount(num)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    teamsCount === num
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {teamsCount === 4 && 'Semifinales → Final (3 partidos)'}
              {teamsCount === 6 && 'Ronda 1 → Semifinales → Final (5 partidos)'}
              {teamsCount === 8 && 'Cuartos → Semifinales → Final (7 partidos)'}
              {teamsCount === 12 && 'Ronda 1 (con byes) → Cuartos → Semifinales → Final (11 partidos)'}
              {teamsCount === 16 && 'Ronda de 16 → Cuartos → Semifinales → Final (15 partidos)'}
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

          {/* Mínimo partidos por equipo */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-3">Mínimo partidos por equipo</label>
            <div className="flex gap-2">
              {[1, 2].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setMinMatchesPerTeam(num)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    minMatchesPerTeam === num
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num} {num === 1 ? 'partido' : 'partidos'}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {minMatchesPerTeam === 1 && 'Eliminación simple - algunos equipos pueden jugar solo 1 partido'}
              {minMatchesPerTeam === 2 && 'Doble eliminación - todos los equipos juegan al menos 2 partidos'}
            </p>
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
