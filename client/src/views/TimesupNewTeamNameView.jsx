import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Nombrar Equipos
 * Los capitanes de cada equipo nombran su equipo
 */
export function TimesupNewTeamNameView({ onNavigate }) {
  const { socket } = useSocket();
  
  const [roomId, setRoomId] = useState('');
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [namedTeams, setNamedTeams] = useState({});
  const [error, setError] = useState('');
  
  // Cargar datos iniciales
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('timesupnew_roomId');
    const storedTeams = sessionStorage.getItem('timesupnew_teams');
    
    if (!storedRoomId || !storedTeams) {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
      return;
    }
    
    setRoomId(storedRoomId);
    const teamsData = JSON.parse(storedTeams);
    setTeams(teamsData);
    
    // Encontrar mi equipo
    const myTeamId = teamsData.findIndex(t => t.players.includes(socket.id));
    if (myTeamId !== -1) {
      setMyTeam(teamsData[myTeamId]);
      setTeamName(teamsData[myTeamId].name || '');
    }
    
    // Escuchar eventos
    const handleTeamNamed = (data) => {
      setNamedTeams(prev => ({
        ...prev,
        [data.teamId]: data.teamName
      }));
    };
    
    const handleAllTeamsNamed = () => {
      sessionStorage.setItem('timesupnew_state', JSON.stringify({ state: 'words' }));
      onNavigate(VIEWS.TIMESUP_NEW_WORDS);
    };
    
    socket.on('timesupnew-team-named', handleTeamNamed);
    socket.on('timesupnew-all-teams-named', handleAllTeamsNamed);
    
    return () => {
      socket.off('timesupnew-team-named', handleTeamNamed);
      socket.off('timesupnew-all-teams-named', handleAllTeamsNamed);
    };
  }, [socket, onNavigate]);
  
  // Soy capitán?
  const isCaptain = myTeam?.captainId === socket.id;
  
  // Enviar nombre del equipo
  const handleSubmit = async () => {
    if (!isCaptain || !teamName.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-name-team', {
          roomId,
          teamName: teamName.trim()
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      
      // Actualizar teams local
      setTeams(prev => prev.map(t => 
        t.id === myTeam.id ? { ...t, name: teamName.trim() } : t
      ));
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ¿YaNaminglés mi equipo?
  const myTeamNamed = namedTeams[myTeam?.id] !== undefined;
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">🏷️ Nombrar Equipos</h1>
          <p className="text-gray-400">Los capitanes eligen el nombre de su equipo</p>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}
        
        {/* Mi equipo */}
        {myTeam && (
          <div className="bg-indigo-500/20 rounded-2xl p-6 border border-indigo-500/50 text-center">
            <p className="text-gray-400 text-sm mb-2">Tu equipo:</p>
            <p className="text-2xl font-bold text-white mb-4">
              {myTeam.players.join(', ')}
            </p>
            
            {isCaptain ? (
              myTeamNamed ? (
                <div className="bg-green-500/30 text-green-400 px-4 py-2 rounded-lg">
                  ✅ Nombre enviado: <strong>{namedTeams[myTeam.id]}</strong>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-indigo-300">Eres el capitán. Elegí el nombre:</p>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Nombre del equipo"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                    maxLength={20}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!teamName.trim() || isSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    {isSubmitting ? 'Enviando...' : 'Confirmar Nombre'}
                  </button>
                </div>
              )
            ) : (
              <div className="bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg">
                ⏳ Esperando que el capitán nombre el equipo...
              </div>
            )}
          </div>
        )}
        
        {/* Estado de todos los equipos */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Equipos:</p>
          <div className="space-y-2">
            {teams.map(team => (
              <div key={team.id} className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2">
                <div>
                  <span className="text-white font-medium">
                    {namedTeams[team.id] || `Equipo ${team.id + 1}`}
                  </span>
                  <span className="text-gray-500 text-sm ml-2">
                    ({team.players.join(', ')})
                  </span>
                </div>
                {namedTeams[team.id] ? (
                  <span className="text-green-400">✓</span>
                ) : (
                  <span className="text-yellow-400">⏳</span>
                )}
              </div>
            ))}
          </div>
        </div>
        
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

export default TimesupNewTeamNameView;
