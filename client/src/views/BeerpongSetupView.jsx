import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Setup de BeerPong Tournament
 * El host introduce los equipos y jugadores
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function BeerpongSetupView({ onNavigate }) {
  const { socket } = useSocket();
  const [roomId, setRoomId] = useState('');
  const [teamsCount, setTeamsCount] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [teams, setTeams] = useState([]);
  const [currentTeamName, setCurrentTeamName] = useState('');
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState('');
  const [error, setError] = useState('');
  const [isAddingTeam, setIsAddingTeam] = useState(false);

  // Cargar configuración inicial
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('beerpong_roomId');
    if (storedRoomId) {
      setRoomId(storedRoomId);
      
      // Obtener datos de la sala del servidor
      socket.emit('beerpong-get-room', { roomId: storedRoomId }, (response) => {
        if (response.success) {
          const room = response.room;
          setTeamsCount(room.config.teamsCount);
          setPlayersPerTeam(room.config.playersPerTeam);
          setTeams(room.teams || []);
        }
      });
    }
  }, [socket]);

  // Añadir jugador al equipo actual
  const handleAddPlayer = () => {
    if (!currentPlayer.trim()) return;
    if (players.length >= playersPerTeam) {
      setError(`Máximo ${playersPerTeam} jugadores por equipo`);
      return;
    }
    setPlayers([...players, currentPlayer.trim()]);
    setCurrentPlayer('');
    setError('');
  };

  // Eliminar jugador
  const handleRemovePlayer = (index) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  // Añadir equipo completo
  const handleAddTeam = async () => {
    if (!currentTeamName.trim()) {
      setError('Ingresa el nombre del equipo');
      return;
    }
    if (players.length < 1) {
      setError('Añade al menos 1 jugador');
      return;
    }

    setIsAddingTeam(true);
    setError('');

    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('beerpong-add-team', {
          roomId,
          teamName: currentTeamName.trim(),
          players: players
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      // Actualizar lista de equipos
      setTeams(result.teams);
      
      // Limpiar formulario
      setCurrentTeamName('');
      setPlayers([]);
    } catch (err) {
      console.error('Error al añadir equipo:', err);
      setError(err.message);
    } finally {
      setIsAddingTeam(false);
    }
  };

  // Iniciar torneo (generar bracket)
  const handleStartTournament = async () => {
    if (teams.length < 2) {
      setError('Necesitas al menos 2 equipos');
      return;
    }
    if (teams.length !== teamsCount) {
      setError(`Debes añadir ${teamsCount} equipos (tienes ${teams.length})`);
      return;
    }

    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('beerpong-start', { roomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      // Guardar datos del bracket
      sessionStorage.setItem('beerpong_bracket', JSON.stringify(result.bracket));

      // Navegar al bracket
      onNavigate(VIEWS.BEERPONG_BRACKET);
    } catch (err) {
      console.error('Error al iniciar:', err);
      setError(err.message);
    }
  };

  // Escuchar actualizaciones de equipos
  useEffect(() => {
    const handleTeamsUpdated = (data) => {
      if (data.roomId === roomId) {
        setTeams(data.teams);
      }
    };

    socket.on('beerpong-teams-updated', handleTeamsUpdated);

    return () => {
      socket.off('beerpong-teams-updated', handleTeamsUpdated);
    };
  }, [socket, roomId]);

  const canAddMoreTeams = teams.length < teamsCount;
  const canSubmit = currentTeamName.trim() && players.length >= 1;

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">🏆 Configurar Torneo</h1>
          <p className="text-gray-400">
            Equipo {teams.length} de {teamsCount}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Equipos añadidos */}
        {teams.length > 0 && (
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <label className="block text-gray-400 text-sm mb-3">Equipos añadidos</label>
            <div className="space-y-2">
              {teams.map((team, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-white font-medium">{team.name}</span>
                    <span className="text-gray-400 text-sm ml-2">
                      ({team.players.join(', ')})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario para añadir equipo */}
        {canAddMoreTeams && (
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700 space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Nombre del equipo</label>
              <input
                type="text"
                value={currentTeamName}
                onChange={(e) => setCurrentTeamName(e.target.value)}
                placeholder="Ej: Los Chichos"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Jugadores */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Jugadores ({players.length}/{playersPerTeam})
              </label>
              
              {/* Lista de jugadores añadidos */}
              {players.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {players.map((player, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center bg-amber-600/30 text-amber-300 px-3 py-1 rounded-full text-sm"
                    >
                      {player}
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(index)}
                        className="ml-2 text-amber-400 hover:text-amber-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Input para añadir jugador */}
              {players.length < playersPerTeam && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentPlayer}
                    onChange={(e) => setCurrentPlayer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPlayer()}
                    placeholder="Nombre del jugador"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddPlayer}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {/* Botón añadir equipo */}
            <button
              type="button"
              onClick={handleAddTeam}
              disabled={!canSubmit || isAddingTeam}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {isAddingTeam ? 'Añadiendo...' : 'Añadir Equipo'}
            </button>
          </div>
        )}

        {/* Información de progreso */}
        {!canAddMoreTeams && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-2xl p-4 text-center">
            <p className="text-green-400 font-medium">✅ Todos los equipos añadidos</p>
            <p className="text-gray-400 text-sm mt-1">
              Lista para iniciar el torneo
            </p>
          </div>
        )}

        {/* Botón iniciar torneo */}
        {teams.length >= 2 && (
          <button
            type="button"
            onClick={handleStartTournament}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            🚀 Iniciar Torneo
          </button>
        )}

        {/* Botón volver */}
        <button
          onClick={() => onNavigate(VIEWS.GAMES)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          ← Cancelar
        </button>
      </div>
    </div>
  );
}

export default BeerpongSetupView;
