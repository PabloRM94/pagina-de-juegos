import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista para nombrar equipos (capitanes)
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function TimesUpTeamNameView({ onNavigate }) {
  const { socket } = useSocket();
  
  // Leer roomId desde sessionStorage - SIEMPRE fresco
  const storedRoomId = sessionStorage.getItem('timesup_roomId');
  const storedTeams = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
  
  console.log('[TimesUpTeamNameView] ==================== MONTAJE ====================');
  console.log('[TimesUpTeamNameView] Montado - roomId de sessionStorage:', storedRoomId);
  console.log('[TimesUpTeamNameView] Equipos:', storedTeams);
  console.log('[TimesUpTeamNameView] socket.id:', socket?.id);
  console.log('[TimesUpTeamNameView] socket.connected:', socket?.connected);
  
  // Verificar que el socket esté conectado
  if (!socket?.connected) {
    console.error('[TimesUpTeamNameView] ERROR: Socket no conectado al montar!');
  }
  
  const [roomId, setRoomId] = useState(storedRoomId || '');
  const [teamName, setTeamName] = useState('');
  const [myTeam, setMyTeam] = useState(null);
  const [teams, setTeams] = useState(storedTeams);
  const [isCaptain, setIsCaptain] = useState(false);
  const [hasNamed, setHasNamed] = useState(false);
  const [error, setError] = useState('');

  // Inicializar equipos si vienen desde props (sessionStorage)
  useEffect(() => {
    const storedTeams = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
    if (storedTeams && storedTeams.length > 0) {
      setTeams(storedTeams);
      // Encontrar mi equipo
      const myTeamData = storedTeams.find(t => t.players.includes(socket.id));
      if (myTeamData) {
        setMyTeam(myTeamData);
        setIsCaptain(myTeamData.captainId === socket.id);
        setTeamName(myTeamData.name);
        if (myTeamData.name !== `Equipo ${myTeamData.id + 1}`) {
          setHasNamed(true);
        }
      }
    }
  }, [socket.id]);

  // Escuchar eventos
  useEffect(() => {
    // Escuchar desconexiones
    const handleDisconnect = (reason) => {
      console.log('[TeamNameView SOCKET DISCONNECT] reason:', reason);
      setError('Conexión perdida. Volvé al lobby.');
    };
    
    const handleConnectError = (err) => {
      console.log('[TeamNameView SOCKET CONNECT ERROR]', err);
    };
    
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    
    const handleTeamNamed = (data) => {
      console.log('Team named:', data);
      setTeams(prev => prev.map(t => 
        t.id === data.teamId ? { ...t, name: data.teamName } : t
      ));
    };

    const handleAllTeamsNamed = () => {
      console.log('[TeamNameView] Todos los equipos nombrados, navegando...');
      onNavigate(VIEWS.TIMESUP_WORD_INPUT);
    };

    const handleCaptainsAssigned = (data) => {
      console.log('[TeamNameView] Capitanes asignados recibidos:', data);
      const currentRoomId = sessionStorage.getItem('timesup_roomId') || roomId;
      setRoomId(currentRoomId);
      setTeams(data.teams);
      sessionStorage.setItem('timesup_roomId', currentRoomId);
      sessionStorage.setItem('timesup_teams', JSON.stringify(data.teams));
      sessionStorage.setItem('timesup_config', JSON.stringify({
        teamCount: data.teams?.length || 2,
        totalRounds: data.state === 'playing' ? 3 : 3
      }));
      
      // Encontrar mi equipo
      const myTeamData = data.teams.find(t => t.players.includes(socket.id));
      if (myTeamData) {
        setMyTeam(myTeamData);
        setIsCaptain(myTeamData.captainId === socket.id);
        setTeamName(myTeamData.name);
        if (myTeamData.name !== `Equipo ${myTeamData.id + 1}`) {
          setHasNamed(true);
        }
      }
    };

    socket.on('timesup-team-named', handleTeamNamed);
    socket.on('timesup-all-teams-named', handleAllTeamsNamed);
    socket.on('timesup-captains-assigned', handleCaptainsAssigned);

    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('timesup-team-named', handleTeamNamed);
      socket.off('timesup-all-teams-named', handleAllTeamsNamed);
      socket.off('timesup-captains-assigned', handleCaptainsAssigned);
    };
  }, [socket, onNavigate, roomId]);

  const handleSubmit = async () => {
    // Leer roomId DIRECTAMENTE de sessionStorage al momento de enviar
    const storedRoomId = sessionStorage.getItem('timesup_roomId');
    const currentRoomId = storedRoomId || roomId;
    
    console.log('[handleSubmit] roomId from sessionStorage:', storedRoomId);
    console.log('[handleSubmit] roomId from state:', roomId);
    console.log('[handleSubmit] currentRoomId:', currentRoomId);
    console.log('[handleSubmit] socket.id:', socket.id);
    
    if (!teamName.trim()) {
      setError('Ingresa un nombre para tu equipo');
      return;
    }

    if (!currentRoomId) {
      console.error('[handleSubmit] ERROR: No hay roomId disponible');
      setError('No se encontró la sala. Volvé al lobby e intentá de nuevo.');
      return;
    }

    console.log('[handleSubmit] Enviando con roomId:', currentRoomId);
    setError('');

    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-name-team', { 
          roomId: currentRoomId, 
          teamName: teamName.trim() 
        }, (response) => {
          console.log('[handleSubmit] Respuesta:', response);
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      setHasNamed(true);
    } catch (err) {
      console.error('Error al nombrar equipo:', err);
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">👥 Nombra tu Equipo</h1>
          <p className="text-gray-400">Los capitanes deben nombrar sus equipos</p>
        </div>

        {/* Mi equipo */}
        {myTeam && (
          <div className="bg-indigo-500/20 rounded-2xl p-4 border border-indigo-500/50">
            <p className="text-gray-400 text-sm mb-2">Tu equipo</p>
            {isCaptain ? (
              <div className="space-y-3">
                <p className="text-indigo-400 font-medium">★ Eres el capitán</p>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Nombre del equipo"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                  disabled={hasNamed}
                />
                {!hasNamed && (
                  <button
                    onClick={handleSubmit}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Nombrar Equipo
                  </button>
                )}
                {hasNamed && (
                  <p className="text-green-400 text-center">✓ Equipo nombrado</p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-white text-lg font-bold">{teamName}</p>
                <p className="text-gray-400 text-sm mt-1">Esperando que el capitán nombre el equipo...</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Todos los equipos */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Equipos</p>
          <div className="space-y-2">
            {teams.map((team) => (
              <div 
                key={team.id} 
                className={`rounded-lg px-4 py-3 ${
                  team.id === myTeam?.id 
                    ? 'bg-indigo-500/30 border border-indigo-500' 
                    : 'bg-gray-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{team.name}</span>
                  {team.id === myTeam?.id && (
                    <span className="text-xs text-indigo-400">(Tú)</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {team.players.length} jugador(es)
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Estado */}
        <div className="text-center text-gray-500">
          <p>Capitanes que han nombrado: {teams.filter(t => t.name !== `Equipo ${t.id + 1}`).length} / {teams.length}</p>
        </div>
      </div>
    </div>
  );
}

export default TimesUpTeamNameView;
