import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Asignación de Equipos
 * El host asigna manualmente los jugadores a equipos
 */
export function TimesupNewTeamsView({ onNavigate }) {
  const { socket } = useSocket();
  
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState([]);
  const [teamCount, setTeamCount] = useState(2);
  const [teamAssignments, setTeamAssignments] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const defaultTeamNames = ['Equipo A', 'Equipo B', 'Equipo C', 'Equipo D'];
  
  // Cargar datos iniciales
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('timesupnew_roomId');
    const storedHost = sessionStorage.getItem('timesupnew_host');
    const storedTeamCount = sessionStorage.getItem('timesupnew_teamCount');
    
    if (!storedRoomId) {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
      return;
    }
    
    setRoomId(storedRoomId);
    setIsHost(storedHost === socket.id);
    setTeamCount(parseInt(storedTeamCount) || 2);
    
    // Escuchar eventos
    const handlePlayerJoined = (data) => {
      setPlayers(prev => {
        const exists = prev.some(p => p.id === data.player.id);
        if (exists) return prev;
        return [...prev, data.player];
      });
    };
    
    const handlePlayerLeft = (data) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
      // Limpiar asignación del jugador que salió
      setTeamAssignments(prev => {
        const newAssign = { ...prev };
        delete newAssign[data.playerId];
        return newAssign;
      });
    };
    
    socket.on('timesupnew-player-joined', handlePlayerJoined);
    socket.on('timesupnew-player-left', handlePlayerLeft);
    
    return () => {
      socket.off('timesupnew-player-joined', handlePlayerJoined);
      socket.off('timesupnew-player-left', handlePlayerLeft);
    };
  }, [socket, onNavigate]);
  
  // Obtener jugadores no asignados
  const unassignedPlayers = players.filter(p => !teamAssignments[p.id]);
  
  // Asignar jugador a equipo
  const assignToTeam = (playerId, teamId) => {
    setTeamAssignments(prev => ({
      ...prev,
      [playerId]: teamId
    }));
  };
  
  // Obtener jugadores por equipo
  const getPlayersByTeam = (teamId) => {
    return players.filter(p => teamAssignments[p.id] === teamId);
  };
  
  // Verificar si se puede continuar
  const canStart = players.length >= 2 && 
    players.every(p => teamAssignments[p.id] !== undefined);
  
  // Enviar asignaciones
  const handleSubmit = async () => {
    if (!canStart || !isHost) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('timesupnew-assign-teams', {
          roomId,
          teamAssignments
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      
      // La navegación la maneja el evento timesupnew-teams-assigned
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Obtener info de configuración
  const withSounds = sessionStorage.getItem('timesupnew_withSounds') === 'true';
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">👥 Asignar Equipos</h1>
          <p className="text-gray-400">{players.length} jugadores</p>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}
        
        {/* No es host */}
        {!isHost && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 text-center">
            <p className="text-yellow-400">Esperando que el host asigne los equipos...</p>
          </div>
        )}
        
        {/* Equipos */}
        <div className="space-y-4">
          {Array.from({ length: teamCount }, (_, teamId) => (
            <div key={teamId} className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-bold">{defaultTeamNames[teamId]}</span>
                <span className="text-gray-400 text-sm">
                  {getPlayersByTeam(teamId).length} jugadores
                </span>
              </div>
              
              {/* Jugadores en este equipo */}
              <div className="flex flex-wrap gap-2 mb-3">
                {getPlayersByTeam(teamId).map(player => (
                  <span 
                    key={player.id}
                    className="inline-flex items-center gap-1 bg-indigo-600 text-white text-sm px-3 py-1 rounded-full"
                  >
                    {player.name}
                    {isHost && (
                      <button
                        onClick={() => assignToTeam(player.id, null)}
                        className="ml-1 text-indigo-200 hover:text-white"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              
              {/* Selector de jugador para asignar (solo host) */}
              {isHost && unassignedPlayers.length > 0 && (
                <select
                  value={''}
                  onChange={(e) => {
                    if (e.target.value) {
                      assignToTeam(parseInt(e.target.value), teamId);
                    }
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">+ Añadir jugador...</option>
                  {unassignedPlayers.map(player => (
                    <option key={player.id} value={teamId}>
                      {player.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        
        {/* Jugadores sin asignar (solo host) */}
        {isHost && unassignedPlayers.length > 0 && (
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700 border-dashed">
            <p className="text-gray-400 text-sm mb-2">Sin asignar:</p>
            <div className="flex flex-wrap gap-2">
              {unassignedPlayers.map(player => (
                <span 
                  key={player.id}
                  className="bg-gray-600 text-gray-300 text-sm px-3 py-1 rounded-full"
                >
                  {player.name}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Info de equipos */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Equipos:</span>
            <span className="text-white">{teamCount}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-400">Rondas:</span>
            <span className="text-white">{withSounds ? '4 (incluye sonidos)' : '3'}</span>
          </div>
        </div>
        
        {/* Botón enviar (solo host) */}
        {isHost && (
          <button
            onClick={handleSubmit}
            disabled={!canStart || isSubmitting}
            className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
              canStart
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting 
              ? 'Enviando...' 
              : canStart 
                ? 'Confirmar Equipos' 
                : 'Asigna todos los jugadores'}
          </button>
        )}
        
        {/* Botón volver */}
        <button
          onClick={() => onNavigate(VIEWS.TIMESUP_NEW_LOBBY)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}

export default TimesupNewTeamsView;
