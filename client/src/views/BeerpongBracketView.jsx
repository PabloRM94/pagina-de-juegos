import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista del Bracket de BeerPong Tournament
 * Muestra el bracket y permite seleccionar ganadores
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function BeerpongBracketView({ onNavigate }) {
  const { socket } = useSocket();
  const [roomId, setRoomId] = useState('');
  const [bracket, setBracket] = useState({ rounds: [], teams: [] });
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [error, setError] = useState('');

  // Cargar bracket inicial
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('beerpong_roomId');
    if (storedRoomId) {
      setRoomId(storedRoomId);
      
      // Obtener bracket del servidor
      socket.emit('beerpong-get-room', { roomId: storedRoomId }, (response) => {
        if (response.success) {
          setBracket(response.room.bracket || { rounds: [], teams: [] });
        }
      });
    }
  }, [socket]);

  // Escuchar actualizaciones del bracket
  useEffect(() => {
    const handleBracketUpdated = (data) => {
      if (data.roomId === roomId) {
        setBracket(data.bracket);
        
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

  // Seleccionar partido para elegir winner
  const handleMatchClick = (roundIndex, matchIndex, match) => {
    // Solo permitir si ambos equipos están definidos y no hay winner
    if (match.team1 && match.team2 && !match.winner) {
      setSelectedMatch({ roundIndex, matchIndex, match });
    }
  };

  // Marcar ganador
  const handleSelectWinner = async (teamId) => {
    if (!selectedMatch) return;

    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('beerpong-set-winner', {
          roomId,
          roundIndex: selectedMatch.roundIndex,
          matchIndex: selectedMatch.matchIndex,
          winnerTeamId: teamId
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      setBracket(result.bracket);
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

  // Renderizar ronda
  const renderRound = (round, roundIndex) => {
    const totalRounds = bracket.rounds?.length || 0;
    const namesByRounds = {
      1: ['Final'],
      2: ['Semifinales', 'Final'],
      3: ['Cuartos', 'Semifinales', 'Final'],
      4: ['Octavos', 'Cuartos', 'Semifinales', 'Final']
    };
    const defaultName = (idx) => {
      const labels = ['Final', 'Semifinales', 'Cuartos', 'Octavos'];
      const pos = totalRounds - idx - 1;
      return labels[pos] || `Ronda ${idx + 1}`;
    };

    const labelList = namesByRounds[totalRounds] || Array.from({ length: totalRounds }, (_, i) => defaultName(i));
    const roundName = labelList[roundIndex] || `Ronda ${roundIndex + 1}`;

    return (
      <div key={roundIndex} className="flex flex-col justify-around space-y-4 min-w-[180px]">
        <div className="text-center text-amber-400 font-bold text-sm mb-2">{roundName}</div>
        {round.map((match, matchIndex) => {
          const team1 = getTeamInfo(match.team1);
          const team2 = getTeamInfo(match.team2);
          const isClickable = match.team1 && match.team2 && !match.winner;
          const isFinal = roundIndex === bracket.rounds.length - 1;
          
          return (
            <div
              key={matchIndex}
              onClick={() => handleMatchClick(roundIndex, matchIndex, match)}
              className={`
                relative bg-gray-800 border-2 rounded-lg p-2 min-w-[160px]
                ${isClickable ? 'cursor-pointer hover:border-amber-500 border-gray-600' : 'border-gray-700'}
                ${match.winner ? 'border-green-500/50' : ''}
              `}
            >
              {/* Equipo 1 */}
              <div className={`
                flex justify-between items-center px-2 py-1 rounded
                ${match.winner === match.team1 ? 'bg-green-600/30' : 'bg-gray-700/30'}
              `}>
                <span className={`text-sm truncate ${match.winner === match.team1 ? 'text-green-400 font-bold' : 'text-white'}`}>
                  {getTeamName(match.team1)}
                </span>
                {match.winner === match.team1 && <span className="text-green-400 text-xs">🏆</span>}
              </div>
              
              {/* Separador */}
              <div className="border-t border-gray-600 my-1"></div>
              
              {/* Equipo 2 */}
              <div className={`
                flex justify-between items-center px-2 py-1 rounded
                ${match.winner === match.team2 ? 'bg-green-600/30' : 'bg-gray-700/30'}
              `}>
                <span className={`text-sm truncate ${match.winner === match.team2 ? 'text-green-400 font-bold' : 'text-white'}`}>
                  {getTeamName(match.team2)}
                </span>
                {match.winner === match.team2 && <span className="text-green-400 text-xs">🏆</span>}
              </div>
              
              {/* Indicador de completado */}
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

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">🏆 Tournament</h1>
          <p className="text-gray-400 text-sm">Code: {roomId}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center mb-4">
            {error}
          </div>
        )}

        {/* Bracket */}
        <div className="overflow-x-auto pb-4">
          <div className="flex justify-start gap-8 min-w-max px-4">
            {bracket.rounds?.map((round, index) => renderRound(round, index))}
          </div>
        </div>

        {/* Leyenda */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          <p>Click en un partido para seleccionar el ganador</p>
        </div>

        {/* Botón volver */}
        <div className="max-w-md mx-auto mt-6">
          <button
            onClick={() => onNavigate(VIEWS.GAMES)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ← Salir
          </button>
        </div>
      </div>

      {/* Modal para seleccionar winner */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-gray-700">
            <h2 className="text-xl font-bold text-white text-center mb-4">
              🎯 Selecciona el Ganador
            </h2>
            
            <div className="space-y-3">
              {/* Equipo 1 */}
              <button
                onClick={() => handleSelectWinner(selectedMatch.match.team1)}
                className="w-full bg-gray-700 hover:bg-amber-600 text-white font-bold py-4 px-4 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>{getTeamName(selectedMatch.match.team1)}</span>
                <span className="text-2xl">🥇</span>
              </button>

              {/* VS */}
              <div className="text-center text-gray-500 font-bold">VS</div>

              {/* Equipo 2 */}
              <button
                onClick={() => handleSelectWinner(selectedMatch.match.team2)}
                className="w-full bg-gray-700 hover:bg-amber-600 text-white font-bold py-4 px-4 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>{getTeamName(selectedMatch.match.team2)}</span>
                <span className="text-2xl">🥇</span>
              </button>
            </div>

            {/* Cancelar */}
            <button
              onClick={() => setSelectedMatch(null)}
              className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BeerpongBracketView;
