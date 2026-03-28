import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';
import { BeerpongTimerModal } from '../components/BeerpongTimerModal.jsx';

/**
 * Vista del Bracket de BeerPong Tournament
 * Muestra fase de grupos + eliminación y permite seleccionar ganadores
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function BeerpongBracketView({ onNavigate }) {
  const { socket } = useSocket();
  const [roomId, setRoomId] = useState('');
  const [bracket, setBracket] = useState({ 
    mode: 'liga',
    groupStage: { groups: [], matches: [], standings: [] }, 
    knockout: { rounds: [] }, 
    teams: []
  });
  const [state, setState] = useState('group');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [error, setError] = useState('');
  
  // Timer states
  const [showTimer, setShowTimer] = useState(false);
  const [timer, setTimer] = useState({
    matchId: null,
    matchLabel: '',
    duration: 600,
    remaining: 600,
    isRunning: false
  });

  // Cargar bracket inicial
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('beerpong_roomId');
    if (storedRoomId) {
      setRoomId(storedRoomId);
      
      // Obtener bracket del servidor
      socket.emit('beerpong-get-room', { roomId: storedRoomId }, (response) => {
        if (response.success) {
          const room = response.room;
          setBracket(room.bracket || { 
            mode: 'liga',
            groupStage: { groups: [], matches: [], standings: [] }, 
            knockout: { rounds: [] }, 
            teams: [] 
          });
          setState(room.state || 'group');
        }
      });
    }
  }, [socket]);

  // Escuchar actualizaciones del bracket
  useEffect(() => {
    const handleBracketUpdated = (data) => {
      if (data.roomId === roomId) {
        setBracket(data.bracket);
        setState(data.state || 'group');
        
        // Si hay campeón, navegar a la pantalla final
        if (data.bracket.champion) {
          sessionStorage.setItem('beerpong_champion', JSON.stringify(data.bracket.champion));
          onNavigate(VIEWS.BEERPONG_FINAL);
        }
      }
    };

    socket.on('beerpong-bracket-updated', handleBracketUpdated);

    return () => {
      socket.off('beerpong-bracket-updated', handleBracketUpdated);
    };
  }, [socket, roomId, onNavigate]);

  // Escuchar actualizaciones del timer
  useEffect(() => {
    const handleTimerSync = (data) => {
      if (data.roomId === roomId) {
        setTimer(data.timer);
      }
    };

    const handleTimerFinished = (data) => {
      if (data.roomId === roomId) {
        // Notificación cuando el timer termina
        console.log('Timer finished for:', data.matchLabel);
      }
    };

    socket.on('beerpong-timer-sync', handleTimerSync);
    socket.on('beerpong-timer-finished', handleTimerFinished);

    // Obtener timer actual al cargar
    if (roomId) {
      socket.emit('beerpong-get-timer', { roomId }, (response) => {
        if (response.success) {
          setTimer(response.timer);
        }
      });
    }

    return () => {
      socket.off('beerpong-timer-sync', handleTimerSync);
      socket.off('beerpong-timer-finished', handleTimerFinished);
    };
  }, [socket, roomId]);

  // Funciones del timer
  const handleSetTimerDuration = (minutes) => {
    socket.emit('beerpong-set-timer-duration', { roomId, duration: minutes }, (response) => {
      if (response.success) {
        setTimer(response.timer);
      }
    });
  };

  const handleStartTimer = (matchId, matchLabel) => {
    socket.emit('beerpong-start-timer', { roomId, matchId, matchLabel }, (response) => {
      if (response.success) {
        setTimer(response.timer);
      }
    });
  };

  const handlePauseTimer = () => {
    socket.emit('beerpong-pause-timer', { roomId }, (response) => {
      if (response.success) {
        setTimer(response.timer);
      }
    });
  };

  const handleResumeTimer = () => {
    socket.emit('beerpong-resume-timer', { roomId }, (response) => {
      if (response.success) {
        setTimer(response.timer);
      }
    });
  };

  // Seleccionar partido para elegir winner
  const handleMatchClick = (stage, roundIndex, matchIndex, match) => {
    if (stage === 'group') {
      if (match.team1 && match.team2 && !match.winner) {
        setSelectedMatch({ stage, roundIndex: 0, matchIndex, match });
      }
    } else if (stage === 'knockout') {
      if ((match.team1 && match.team2 && !match.winner) || 
          (match.team1 && !match.team2 && !match.winner) ||
          (!match.team1 && match.team2 && !match.winner)) {
        setSelectedMatch({ stage, roundIndex, matchIndex, match });
      }
    }
  };

  // Marcar ganador
  const handleSelectWinner = async (teamId) => {
    if (!selectedMatch) return;

    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('beerpong-set-winner', {
          roomId,
          stage: selectedMatch.stage,
          roundIndex: selectedMatch.roundIndex,
          matchIndex: selectedMatch.matchIndex,
          winnerTeamId: teamId
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      setBracket(result.bracket);
      setState(result.state || 'group');
      setSelectedMatch(null);
    } catch (err) {
      console.error('Error al seleccionar winner:', err);
      setError(err.message);
    }
  };

  // Obtener nombre del equipo por ID
  const getTeamName = (teamId) => {
    if (!teamId) return '---';
    const team = bracket.teams?.find(t => t.id === teamId);
    return team ? team.name : 'Unknown';
  };

  // Obtener información del equipo
  const getTeamInfo = (teamId) => {
    if (!teamId) return null;
    return bracket.teams?.find(t => t.id === teamId);
  };

  // Renderizar partido de fase de grupos
  const renderGroupMatch = (match, matchIndex) => {
    const isClickable = match.team1 && match.team2 && !match.winner;
    const isBye = match.bye || (!match.team1 || !match.team2);
    
    return (
      <div
        key={matchIndex}
        onClick={() => handleMatchClick('group', 0, matchIndex, match)}
        className={`
          relative bg-gray-800 border-2 rounded-lg p-2 min-w-[160px]
          ${isClickable ? 'cursor-pointer hover:border-amber-500 border-gray-600' : 'border-gray-700'}
          ${match.winner ? 'border-green-500/50' : ''}
          ${isBye ? 'border-yellow-600/50' : ''}
        `}
      >
        <div className={`
          flex justify-between items-center px-2 py-1 rounded
          ${match.winner === match.team1 ? 'bg-green-600/30' : 'bg-gray-700/30'}
        `}>
          <span className={`text-sm truncate ${match.winner === match.team1 ? 'text-green-400 font-bold' : 'text-white'}`}>
            {getTeamName(match.team1)}
          </span>
          {match.winner === match.team1 && <span className="text-green-400 text-xs">🏆</span>}
        </div>
        
        <div className="border-t border-gray-600 my-1"></div>
        
        <div className={`
          flex justify-between items-center px-2 py-1 rounded
          ${match.winner === match.team2 ? 'bg-green-600/30' : 'bg-gray-700/30'}
        `}>
          <span className={`text-sm truncate ${match.winner === match.team2 ? 'text-green-400 font-bold' : 'text-white'}`}>
            {getTeamName(match.team2)}
          </span>
          {match.winner === match.team2 && <span className="text-green-400 text-xs">🏆</span>}
          {!match.team2 && match.team1 && <span className="text-yellow-500 text-xs">BYE</span>}
        </div>
        
        {match.winner && (
          <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        )}
      </div>
    );
  };

  // Renderizar ronda de knockout
  const renderKnockoutRound = (round, roundIndex) => {
    const totalRounds = bracket.knockout?.rounds?.length || 0;
    
    const getRoundName = () => {
      const roundFromEnd = totalRounds - 1 - roundIndex;
      
      switch (roundFromEnd) {
        case 0: return '🏆 Final';
        case 1: return '⚔️ Semifinales';
        case 2: return '🎯 Cuartos de Final';
        case 3: return '🔹 Octavos de Final';
        default: return `Ronda ${roundIndex + 1}`;
      }
    };

    return (
      <div key={roundIndex} className="flex flex-col justify-around space-y-4 min-w-[180px]">
        <div className="text-center text-amber-400 font-bold text-sm mb-2">{getRoundName()}</div>
        {round.map((match, matchIndex) => {
          const canClick = (match.team1 || match.team2) && !match.winner;
          const isBye = match.bye || (!match.team1 || !match.team2);
          
          return (
            <div
              key={matchIndex}
              onClick={() => canClick && handleMatchClick('knockout', roundIndex, matchIndex, match)}
              className={`
                relative bg-gray-800 border-2 rounded-lg p-2 min-w-[160px]
                ${canClick ? 'cursor-pointer hover:border-amber-500 border-gray-600' : 'border-gray-700'}
                ${match.winner ? 'border-green-500/50' : ''}
                ${isBye ? 'border-yellow-600/50' : ''}
              `}
            >
              <div className={`
                flex justify-between items-center px-2 py-1 rounded
                ${match.winner === match.team1 ? 'bg-green-600/30' : 'bg-gray-700/30'}
              `}>
                <span className={`text-sm truncate ${match.winner === match.team1 ? 'text-green-400 font-bold' : 'text-white'}`}>
                  {getTeamName(match.team1)}
                </span>
                {match.winner === match.team1 && <span className="text-green-400 text-xs">🏆</span>}
                {isBye && match.team1 && !match.team2 && <span className="text-yellow-500 text-xs">BYE</span>}
              </div>
              
              <div className="border-t border-gray-600 my-1"></div>
              
              <div className={`
                flex justify-between items-center px-2 py-1 rounded
                ${match.winner === match.team2 ? 'bg-green-600/30' : 'bg-gray-700/30'}
              `}>
                <span className={`text-sm truncate ${match.winner === match.team2 ? 'text-green-400 font-bold' : 'text-white'}`}>
                  {getTeamName(match.team2)}
                </span>
                {match.winner === match.team2 && <span className="text-green-400 text-xs">🏆</span>}
                {!match.team1 && match.team2 && <span className="text-yellow-500 text-xs">BYE</span>}
              </div>
              
              {match.winner && (
                <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Renderizar fase de grupos
  const renderGroupStage = () => {
    const { groups, matches, standings } = bracket.groupStage;
    
    if (!groups || groups.length === 0) {
      return null;
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-amber-400 mb-2">🏅 Fase de Grupos</h2>
          <p className="text-gray-400 text-sm">
            {groups.length} grupo(s) • Round Robin
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map((group, groupIndex) => {
            const groupMatches = matches.filter(m => m.groupIndex === groupIndex);
            const groupStandings = standings[groupIndex] || [];
            
            return (
              <div key={groupIndex} className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold text-amber-400 mb-3">{group.name}</h3>
                
                <div className="space-y-2 mb-4">
                  {groupMatches.map((match, idx) => {
                    const globalIndex = matches.findIndex(m => m === match);
                    return renderGroupMatch(match, globalIndex);
                  })}
                </div>
                
                <div className="border-t border-gray-600 pt-3">
                  <h4 className="text-sm text-gray-400 mb-2">Clasificación</h4>
                  <div className="space-y-1">
                    {groupStandings.map((s, pos) => (
                      <div key={s.teamId} className="flex justify-between text-sm">
                        <span className={pos < 2 ? 'text-green-400 font-bold' : 'text-white'}>
                          {pos + 1}. {getTeamName(s.teamId)}
                        </span>
                        <span className="text-gray-400">
                          {s.wins}V - {s.losses}D
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center text-gray-400 text-sm">
          👆 Selecciona el ganador de cada partido
        </div>
      </div>
    );
  };

  // Renderizar fase de knockout
  const renderKnockoutStage = () => {
    const { rounds } = bracket.knockout;
    
    if (!rounds || rounds.length === 0) {
      return null;
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-amber-400 mb-2">
            {bracket.mode === 'playoff' ? '⚔️ Eliminación Directa' : '⚔️ Fase Final'}
          </h2>
          <p className="text-gray-400 text-sm">
            {bracket.mode === 'playoff' ? 'Con byes automáticos' : 'Cruces 1º vs 2º'}
          </p>
        </div>

        <div className="flex justify-center gap-8 flex-wrap">
          {rounds.map((round, index) => renderKnockoutRound(round, index))}
        </div>

        <div className="text-center text-gray-400 text-sm">
          👆 Selecciona el ganador de cada partido
        </div>
      </div>
    );
  };

  // Determinar qué mostrar
  const showGroupStage = bracket.mode === 'liga' && bracket.groupStage?.groups?.length > 0;
  const showKnockoutStage = state === 'knockout' || (showGroupStage && bracket.knockout?.rounds?.length > 0);

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">🏆 Tournament</h1>
          <p className="text-gray-400 text-sm">Code: {roomId}</p>
          
          <div className="flex justify-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs ${bracket.mode === 'liga' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {bracket.mode === 'liga' ? '⚽ Liga' : '⚔️ Playoff'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs ${state === 'group' ? 'bg-blue-600 text-white' : state === 'knockout' ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'}`}>
              {state === 'group' ? 'Grupos' : state === 'knockout' ? 'Fase Final' : 'Finalizado'}
            </span>
          </div>

          {/* Botón del Timer */}
          <div className="flex justify-center mt-3">
            <button
              onClick={() => setShowTimer(true)}
              className={`
                px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2
                ${timer.isRunning 
                  ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse' 
                  : timer.remaining < timer.duration && timer.remaining > 0
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }
              `}
            >
              <span>⏱</span>
              {timer.isRunning || (timer.remaining < timer.duration && timer.remaining > 0) 
                ? `${Math.floor(timer.remaining / 60)}:${(timer.remaining % 60).toString().padStart(2, '0')}`
                : 'Timer'
              }
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center mb-4">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {showGroupStage && renderGroupStage()}
          {showKnockoutStage && renderKnockoutStage()}
        </div>

        <div className="max-w-md mx-auto mt-8">
          <button
            onClick={() => onNavigate(VIEWS.GAMES)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ← Salir
          </button>
        </div>
      </div>

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-gray-700">
            <h2 className="text-xl font-bold text-white text-center mb-4">
              🎯 Selecciona el Ganador
            </h2>
            
            <div className="space-y-3">
              {selectedMatch.match.team1 && (
                <button
                  onClick={() => handleSelectWinner(selectedMatch.match.team1)}
                  className="w-full bg-gray-700 hover:bg-amber-600 text-white font-bold py-4 px-4 rounded-lg transition-colors flex items-center justify-between"
                >
                  <span>{getTeamName(selectedMatch.match.team1)}</span>
                  <span className="text-2xl">🥇</span>
                </button>
              )}

              {selectedMatch.match.team1 && selectedMatch.match.team2 && (
                <div className="text-center text-gray-500 font-bold">VS</div>
              )}

              {selectedMatch.match.team2 && (
                <button
                  onClick={() => handleSelectWinner(selectedMatch.match.team2)}
                  className="w-full bg-gray-700 hover:bg-amber-600 text-white font-bold py-4 px-4 rounded-lg transition-colors flex items-center justify-between"
                >
                  <span>{getTeamName(selectedMatch.match.team2)}</span>
                  <span className="text-2xl">🥇</span>
                </button>
              )}

              {(!selectedMatch.match.team1 || !selectedMatch.match.team2) && (
                <div className="text-center text-yellow-400 text-sm">
                  ⚠️ Equipo sin rival - Ganará automáticamente
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedMatch(null)}
              className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Timer Modal */}
      <BeerpongTimerModal
        isOpen={showTimer}
        timer={timer}
        onClose={() => setShowTimer(false)}
        onSetDuration={handleSetTimerDuration}
        onStart={handleStartTimer}
        onPause={handlePauseTimer}
        onResume={handleResumeTimer}
      />
    </div>
  );
}

export default BeerpongBracketView;