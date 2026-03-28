import { useState } from 'react';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Lobby de TimeUp New (Local)
 * Configurar equipos y jugadores
 */
export function TimesupNewLobbyView({ onNavigate }) {
  const [teamCount, setTeamCount] = useState(2);
  const [withSounds, setWithSounds] = useState(false);
  const [players, setPlayers] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(0);
  const [error, setError] = useState('');

  // Nombres de equipos por defecto
  const defaultTeamNames = ['Equipo A', 'Equipo B', 'Equipo C', 'Equipo D'];

  // Añadir jugador
  const handleAddPlayer = () => {
    if (!playerName.trim()) {
      setError('Ingresa un nombre');
      return;
    }

    // Verificar que no exista
    if (players.some(p => p.name.toLowerCase() === playerName.trim().toLowerCase())) {
      setError('Este nombre ya existe');
      return;
    }

    setPlayers([...players, { 
      name: playerName.trim(), 
      team: selectedTeam 
    }]);
    setPlayerName('');
    setError('');
  };

  // Eliminar jugador
  const handleRemovePlayer = (index) => {
    const newPlayers = [...players];
    newPlayers.splice(index, 1);
    setPlayers(newPlayers);
  };

  // Cambiar equipo de jugador
  const handleChangePlayerTeam = (index, newTeam) => {
    const newPlayers = [...players];
    newPlayers[index].team = newTeam;
    setPlayers(newPlayers);
  };

  // Obtener jugadores por equipo
  const getPlayersByTeam = (teamIndex) => {
    return players.filter(p => p.team === teamIndex);
  };

  // Verificar si podemos continuar
  const canStart = players.length >= 2;

  // Guardar datos y navegar a palabras
  const handleStart = () => {
    if (!canStart) return;

    // Crear estructura de equipos
    const teams = [];
    for (let i = 0; i < teamCount; i++) {
      const teamPlayers = players
        .filter(p => p.team === i)
        .map(p => p.name);
      
      teams.push({
        id: i,
        name: defaultTeamNames[i],
        players: teamPlayers
      });
    }

    // Guardar en sessionStorage
    const gameData = {
      teams,
      config: {
        teamCount,
        withSounds,
        totalRounds: withSounds ? 4 : 3
      }
    };
    sessionStorage.setItem('timesupnew_gameData', JSON.stringify(gameData));

    onNavigate(VIEWS.TIMESUP_NEW_WORDS);
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-white mb-2">🎯 TimeUp New</h1>
          <p className="text-gray-400">Configura tu partida</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Número de equipos */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <label className="block text-gray-400 text-sm mb-3">Número de equipos</label>
          <div className="flex gap-2">
            {[2, 3, 4].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => setTeamCount(num)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  teamCount === num
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {num} equipos
              </button>
            ))}
          </div>
        </div>

        {/* Ronda de sonidos */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-gray-300">Ronda 4: Sonidos</span>
            <button
              type="button"
              onClick={() => setWithSounds(!withSounds)}
              className={`w-12 h-6 rounded-full transition-colors ${
                withSounds ? 'bg-indigo-600' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                withSounds ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </label>
          <p className="text-gray-500 text-xs mt-2">Activar ronda adicional con sonidos</p>
        </div>

        {/* Añadir jugadores */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <label className="block text-gray-400 text-sm mb-3">Añadir jugadores</label>
          
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddPlayer()}
              placeholder="Nombre del jugador"
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(parseInt(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              {Array.from({ length: teamCount }, (_, i) => (
                <option key={i} value={i}>{defaultTeamNames[i]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddPlayer}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              +
            </button>
          </div>

          {/* Lista de equipos con jugadores */}
          <div className="space-y-3">
            {Array.from({ length: teamCount }, (_, teamIndex) => (
              <div key={teamIndex} className="bg-gray-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{defaultTeamNames[teamIndex]}</span>
                  <span className="text-gray-400 text-sm">
                    {getPlayersByTeam(teamIndex).length} jugadores
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getPlayersByTeam(teamIndex).map((player, idx) => {
                    const globalIdx = players.findIndex(p => p === player);
                    return (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1 bg-gray-600 text-white text-sm px-2 py-1 rounded-full"
                      >
                        {player.name}
                        <button
                          type="button"
                          onClick={() => handleRemovePlayer(globalIdx)}
                          className="text-gray-400 hover:text-red-400 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  {getPlayersByTeam(teamIndex).length === 0 && (
                    <span className="text-gray-500 text-sm italic">Sin jugadores</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botón iniciar */}
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
            canStart
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {canStart 
            ? 'Continuar a Palabras' 
            : `Necesitas al menos 2 jugadores (tienes ${players.length})`}
        </button>

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

export default TimesupNewLobbyView;
