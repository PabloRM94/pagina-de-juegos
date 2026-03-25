import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista Final de BeerPong Tournament
 * Muestra el equipo campeón
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function BeerpongFinalView({ onNavigate }) {
  const { socket } = useSocket();
  const [champion, setChampion] = useState(null);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    // Cargar campeón desde sessionStorage
    const storedChampion = sessionStorage.getItem('beerpong_champion');
    if (storedChampion) {
      setChampion(JSON.parse(storedChampion));
    }

    // Obtener todos los equipos
    const storedRoomId = sessionStorage.getItem('beerpong_roomId');
    if (storedRoomId) {
      socket.emit('beerpong-get-room', { roomId: storedRoomId }, (response) => {
        if (response.success) {
          setTeams(response.room.teams || []);
        }
      });
    }
  }, [socket]);

  // Reiniciar tournament
  const handleRestart = () => {
    sessionStorage.removeItem('beerpong_roomId');
    sessionStorage.removeItem('beerpong_host');
    sessionStorage.removeItem('beerpong_bracket');
    sessionStorage.removeItem('beerpong_champion');
    onNavigate(VIEWS.BEERPONG_LOBBY);
  };

  if (!champion) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-8">
        {/* Celebración */}
        <div className="text-center pt-8">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h1 className="text-3xl font-bold text-amber-400 mb-2">CAMPEÓN</h1>
          <p className="text-gray-400">El equipo ganador del torneo</p>
        </div>

        {/* Tarjeta del campeón */}
        <div className="bg-gradient-to-br from-amber-600/30 to-yellow-600/30 rounded-3xl p-8 border-2 border-amber-500/50 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-4">{champion.name}</h2>
          
          {champion.players && champion.players.length > 0 && (
            <div className="space-y-2">
              <p className="text-gray-400 text-sm">Integrantes</p>
              <div className="flex flex-wrap justify-center gap-2">
                {champion.players.map((player, index) => (
                  <span 
                    key={index}
                    className="bg-amber-600/50 text-amber-100 px-4 py-1 rounded-full text-sm"
                  >
                    {player}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Estadísticas del torneo */}
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 text-center">📊 Resumen</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Equipos participantes</span>
              <span className="text-white font-bold">{teams.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total jugadores</span>
              <span className="text-white font-bold">
                {teams.reduce((acc, t) => acc + (t.players?.length || 0), 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-3">
          <button
            onClick={handleRestart}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            🔄 Nuevo Torneo
          </button>
          
          <button
            onClick={() => onNavigate(VIEWS.GAMES)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ← Volver a Juegos
          </button>
        </div>
      </div>
    </div>
  );
}

export default BeerpongFinalView;
