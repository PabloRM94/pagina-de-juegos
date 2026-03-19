import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

const ROUND_NAMES = {
  1: 'Descripción Libre',
  2: 'Una Palabra',
  3: 'Mímica',
  4: 'Sonidos'
};

const ROUND_TIMES = {
  1: 60,
  2: 60,
  3: 80,
  4: 80
};

/**
 * Vista principal de juego Time's Up
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function TimesUpPlayView({ onNavigate }) {
  const { socket } = useSocket();
  
  // Leer datos de sessionStorage
  const storedRoomId = sessionStorage.getItem('timesup_roomId') || '';
  const storedTeams = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
  const storedRoundData = JSON.parse(sessionStorage.getItem('timesup_roundData') || '{}');
  const storedHost = sessionStorage.getItem('timesup_host') || '';
  
  const [roomId] = useState(storedRoomId);
  const [teams, setTeams] = useState(storedTeams);
  const [currentWord, setCurrentWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(() => storedRoundData.round || 1);
  const [currentTeamTurn, setCurrentTeamTurn] = useState(0);
  const [currentPlayerId, setCurrentPlayerId] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(false);  // true solo para el jugador que describe
  const [amIInCurrentTeam, setAmIInCurrentTeam] = useState(false);  // true si estoy en el equipo activo
  const [turnActive, setTurnActive] = useState(false);
  const [myTeam, setMyTeam] = useState(null);
  const [scores, setScores] = useState({});
  const [waitingForStart, setWaitingForStart] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // Bloquea botones mientras procesa
  const [isHost, setIsHost] = useState(() => storedHost === socket.id);
  const [roundConfig, setRoundConfig] = useState(() => {
    // Intentar cargar desde sessionStorage primero
    const stored = JSON.parse(sessionStorage.getItem('timesup_roundConfig') || 'null');
    return stored || {
      1: { timePerTurn: 60000, failPassesTurn: false, allowSkip: true },
      2: { timePerTurn: 60000, failPassesTurn: true, allowSkip: true },
      3: { timePerTurn: 80000, failPassesTurn: true, allowSkip: true },
      4: { timePerTurn: 80000, failPassesTurn: true, allowSkip: false }
    };
  });
  const timerRef = useRef(null);

  // Inicializar equipos desde storage
  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
    setTeams(stored);
    
    // Encontrar mi equipo
    const myTeamData = stored.find(t => t.players.includes(socket.id));
    setMyTeam(myTeamData);
  }, [socket.id]);
  
  // Calcular si es mi turno - usar currentPlayerId del servidor (no cualquier miembro del equipo)
  useEffect(() => {
    // Solo el jugador específicamente designado (currentPlayerId) es quien describe
    const amIDescribing = socket.id === currentPlayerId;
    setIsMyTurn(!!amIDescribing);
    console.log('[TimesUpPlay] isMyTurn calculado:', amIDescribing, 'currentPlayerId:', currentPlayerId, 'socket:', socket.id);
  }, [currentPlayerId, socket.id]);
  
  // Calcular si estoy en el equipo actual (para poder iniciar turno)
  useEffect(() => {
    const currentTeam = teams[currentTeamTurn];
    const amIInTeam = currentTeam?.players.includes(socket.id);
    setAmIInCurrentTeam(!!amIInTeam);
  }, [currentTeamTurn, teams, socket.id]);

  // Escuchar eventos de socket
  useEffect(() => {
    const getStoredRoomId = () => sessionStorage.getItem('timesup_roomId');
    
    const handleTurnStarted = (data) => {
      console.log('[TimesUpPlay] handleTurnStarted:', data);
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) {
        console.log('[TimesUpPlay] Evento ignorado - sala diferente');
        return;
      }
      setCurrentWord(data.word || '');
      setTimeLeft(Math.floor(data.timeLimit / 1000));
      setTurnActive(true);
      setWaitingForStart(false);
      setCurrentTeamTurn(data.teamId);
      setCurrentPlayerId(data.playerId); // Actualizar el jugador que describe
      
      // Iniciar timer local
      startLocalTimer(data.timeLimit);
    };

    const handleTurnTimeout = (data) => {
      console.log('[TimesUpPlay] handleTurnTimeout:', data);
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) {
        return;
      }
      setTurnActive(false);
      setWaitingForStart(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };

    const handleWordCorrect = (data) => {
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      setIsProcessing(false); // Liberar botones
      setCurrentWord(data.nextWord || '');
      // Actualizar scores usando el teamId del evento
      const teamId = data.teamId !== undefined ? data.teamId : currentTeamTurn;
      setTeams(prev => prev.map((t, i) => 
        i === teamId ? { ...t, score: data.teamScore } : t
      ));
    };

    const handleWordWrong = (data) => {
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      setIsProcessing(false);
      setCurrentWord(data.nextWord || '');
    };

    const handleWordSkipped = (data) => {
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      setIsProcessing(false);
      setCurrentWord(data.nextWord || '');
    };

    const handleTeamTurnChanged = (data) => {
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      setCurrentTeamTurn(data.nextTeamId);
      setCurrentPlayerId(data.nextPlayerId);
      setTurnActive(false);
      setWaitingForStart(true);
      setCurrentRound(data.round);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };

    const handleRoundEnded = (data) => {
      console.log('[TimesUpPlay] handleRoundEnded:', data);
      
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      // Detener timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setTurnActive(false);
      setWaitingForStart(true);
      
      // ACTUALIZAR LA RONA ACTUAL desde el evento
      setCurrentRound(data.round);
      
      // Guardar datos de la ronda para la vista de resultados
      const roundData = {
        round: data.round,
        roundName: data.roundName,
        totalWords: data.totalWords,
        wordsUsed: data.wordsUsed,
        leaderboard: data.leaderboard,
        scores: data.scores,
        isLastRound: data.isLastRound
      };
      sessionStorage.setItem('timesup_roundData', JSON.stringify(roundData));
      
      // Actualizar equipos con los scores
      if (data.leaderboard) {
        const updatedTeams = teams.map((t, i) => {
          const lbEntry = data.leaderboard.find(l => l.teamId === i);
          return lbEntry ? { ...t, score: lbEntry.score } : t;
        });
        setTeams(updatedTeams);
        sessionStorage.setItem('timesup_teams', JSON.stringify(updatedTeams));
      }
      
      // Actualizar el equipo que empieza la próxima ronda
      if (data.nextStartingTeam !== undefined) {
        setCurrentTeamTurn(data.nextStartingTeam);
      }
      
      // Solo navegar si no es la última ronda (la última se maneja diferente)
      if (!data.isLastRound) {
        onNavigate(VIEWS.TIMESUP_ROUND_RESULT);
      } else {
        // Es última ronda - ir a resultados finales
        onNavigate(VIEWS.TIMESUP_FINAL_RESULT);
      }
    };

    const handleGameEnded = (data) => {
      onNavigate(VIEWS.TIMESUP_FINAL_RESULT);
    };
    
    // Handle when another player starts the next round (from RoundResult screen)
    const handleNextRound = (data) => {
      console.log('[TimesUpPlay] handleNextRound:', data);
      
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      // Actualizar estado para la nueva ronda
      setCurrentRound(data.currentRound);
      setCurrentTeamTurn(data.startingTeam);
      // Resetear el jugador actual y usar el firstPlayerId del evento
      setCurrentPlayerId(data.firstPlayerId || '');
      setTeams(data.leaderboard.map((l, i) => ({ ...teams[i], score: l.score })));
      sessionStorage.setItem('timesup_teams', JSON.stringify(data.leaderboard.map((l, i) => ({ ...teams[i], score: l.score }))));
      
      // Limpiar estado de turno
      setCurrentWord('');
      setTurnActive(false);
      setWaitingForStart(true);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };

    const handleWrongAnswer = (data) => {
      // Verificar que el evento es para nuestra sala
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      
      console.log('[TimesUpPlay] handleWrongAnswer:', data);
      
      // El equipo perdió el turno - cambiar al otro equipo
      setCurrentTeamTurn(data.nextTeamId);
      setCurrentPlayerId(data.nextPlayerId);
      setTurnActive(false);
      setWaitingForStart(true);
      setCurrentWord('');
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };

    const handleRoundNearEnd = () => {
      // Un equipo terminó todas sus palabras
      // El host/end debe presionar terminar ronda
    };

    const handleRoundConfigUpdated = (data) => {
      if (data.roomId && data.roomId !== getStoredRoomId()) return;
      console.log('[TimesUpPlay] handleRoundConfigUpdated:', data);
      
      setRoundConfig(prev => ({
        ...prev,
        [data.roundNumber]: data.config
      }));
    };

    socket.on('timesup-turn-started', handleTurnStarted);
    socket.on('timesup-turn-timeout', handleTurnTimeout);
    socket.on('timesup-word-correct', handleWordCorrect);
    socket.on('timesup-word-wrong', handleWordWrong);
    socket.on('timesup-word-skipped', handleWordSkipped);
    socket.on('timesup-team-turn-changed', handleTeamTurnChanged);
    socket.on('timesup-wrong-answer', handleWrongAnswer);
    socket.on('timesup-round-ended', handleRoundEnded);
    socket.on('timesup-next-round', handleNextRound);
    socket.on('timesup-game-ended', handleGameEnded);
    socket.on('timesup-round-near-end', handleRoundNearEnd);
    socket.on('timesup-round-config-updated', handleRoundConfigUpdated);

    return () => {
      socket.off('timesup-turn-started', handleTurnStarted);
      socket.off('timesup-turn-timeout', handleTurnTimeout);
      socket.off('timesup-word-correct', handleWordCorrect);
      socket.off('timesup-word-wrong', handleWordWrong);
      socket.off('timesup-word-skipped', handleWordSkipped);
      socket.off('timesup-team-turn-changed', handleTeamTurnChanged);
      socket.off('timesup-round-ended', handleRoundEnded);
      socket.off('timesup-next-round', handleNextRound);
      socket.off('timesup-wrong-answer', handleWrongAnswer);
      socket.off('timesup-game-ended', handleGameEnded);
      socket.off('timesup-round-near-end', handleRoundNearEnd);
      socket.off('timesup-round-config-updated', handleRoundConfigUpdated);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [socket, roomId, onNavigate]);

  const startLocalTimer = (duration) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    let remaining = Math.floor(duration / 1000);
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timerRef.current);
      }
    }, 1000);
  };

  const getCurrentDescribePlayer = () => {
    if (!teams.length) return null;
    const team = teams[currentTeamTurn];
    if (!team) return null;
    return team.players[0] || null; // Primer jugador del equipo
  };

  // Función helper para obtener roomId de sessionStorage
  const getRoomId = () => {
    const stored = sessionStorage.getItem('timesup_roomId');
    return stored || roomId;
  };

  const handleStartTurn = async () => {
    const currentRoomId = getRoomId();
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('timesup-start-turn', { roomId: currentRoomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      setCurrentWord(result.word);
      setTimeLeft(Math.floor(result.timeLimit / 1000));
      setTurnActive(true);
      setWaitingForStart(false);
      
      // Iniciar timer local
      startLocalTimer(result.timeLimit);
    } catch (err) {
      console.error('Error al iniciar turno:', err);
      // No actualizar el estado si hay error
    }
  };

  const handleCorrect = async () => {
    if (isProcessing || !turnActive || !isMyTurn) return;
    setIsProcessing(true);
    
    const currentRoomId = getRoomId();
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-correct', { 
          roomId: currentRoomId, 
          word: currentWord 
        }, (response) => {
          if (response.success) {
            // Actualizar score con el valor del servidor
            setTeams(prev => prev.map((t, i) => 
              i === currentTeamTurn ? { ...t, score: response.score } : t
            ));
            resolve(response);
          }
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error al marcar correcto:', err);
      setIsProcessing(false); // Liberar en caso de error
    }
    // IMPORTANTE: No bloqueamos los botones permanentemente - se liberan con el evento del servidor
  };

  const handleWrong = async () => {
    if (isProcessing || !turnActive || !isMyTurn) return;
    setIsProcessing(true);
    
    const currentRoomId = getRoomId();
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-wrong', { roomId: currentRoomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error al marcar wrong:', err);
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    if (isProcessing || !turnActive || !isMyTurn || !currentWord) return;
    setIsProcessing(true);
    
    const currentRoomId = getRoomId();
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-skip', { roomId: currentRoomId, word: currentWord }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error al saltar palabra:', err);
      setIsProcessing(false);
    }
  };

  const handleChangeTeam = async () => {
    const currentRoomId = getRoomId();
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-change-team', { roomId: currentRoomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error al cambiar de equipo:', err);
    }
  };

  const handleEndRound = async () => {
    const currentRoomId = getRoomId();
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-end-round', { roomId: currentRoomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error al terminar ronda:', err);
    }
  };

  const handleUpdateRoundConfig = async (configKey, value) => {
    if (!isHost || turnActive) return;
    
    const currentRoomId = getRoomId();
    const newConfig = { ...roundConfig[currentRound], [configKey]: value };
    
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-update-round-config', {
          roomId: currentRoomId,
          roundNumber: currentRound,
          config: newConfig
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error al actualizar configuración:', err);
    }
  };

  // Obtener info del equipo actual
  const currentTeam = teams[currentTeamTurn];
  const roundTime = Math.floor((roundConfig[currentRound]?.timePerTurn || 60000) / 1000);

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-2">
          <p className="text-gray-400 text-sm">Ronda {currentRound}: {ROUND_NAMES[currentRound]}</p>
          <h2 className="text-xl font-bold text-white">
            Turno: {currentTeam?.name || 'Equipo'}
          </h2>
        </div>

        {/* Panel de normas de la ronda */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-indigo-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-indigo-400 font-bold text-sm flex items-center gap-2">
              <span className="text-lg">📜</span> 
              {ROUND_NAMES[currentRound]}
            </h3>
            <span className="bg-indigo-600/30 text-indigo-300 text-xs px-2 py-1 rounded-full">
              Ronda {currentRound}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-700/40 rounded-lg p-2">
              <p className="text-gray-500 text-xs mb-1">⏱️ Tiempo</p>
              <p className="text-white font-bold">{Math.floor((roundConfig[currentRound]?.timePerTurn || 60000) / 1000)}s</p>
            </div>
            <div className="bg-gray-700/40 rounded-lg p-2">
              <p className="text-gray-500 text-xs mb-1">❌ Fallar</p>
              <p className={`font-bold ${roundConfig[currentRound]?.failPassesTurn ? 'text-red-400' : 'text-green-400'}`}>
                {roundConfig[currentRound]?.failPassesTurn ? 'Pierde' : 'Continúa'}
              </p>
            </div>
            <div className="bg-gray-700/40 rounded-lg p-2">
              <p className="text-gray-500 text-xs mb-1">⏭️ Skip</p>
              <p className={`font-bold ${roundConfig[currentRound]?.allowSkip ? 'text-green-400' : 'text-gray-500'}`}>
                {roundConfig[currentRound]?.allowSkip ? '✓' : '✗'}
              </p>
            </div>
          </div>
          
          {/* Editor para el host - solo cuando no hay turno activo */}
          {isHost && !turnActive && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-indigo-400 mb-2">⚙️ Configurar ronda</p>
              
              <div className="space-y-2">
                {/* Tiempo */}
                <div className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2">
                  <span className="text-gray-400 text-xs">Tiempo</span>
                  <select
                    value={roundConfig[currentRound]?.timePerTurn || 60000}
                    onChange={(e) => handleUpdateRoundConfig('timePerTurn', parseInt(e.target.value))}
                    className="bg-gray-600 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-gray-500"
                  >
                    <option value={30000}>30 segundos</option>
                    <option value={45000}>45 segundos</option>
                    <option value={60000}>60 segundos</option>
                    <option value={90000}>90 segundos</option>
                    <option value={120000}>2 minutos</option>
                  </select>
                </div>
                
                {/* Fail passes turn */}
                <div className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2">
                  <span className="text-gray-400 text-xs">Al fallar</span>
                  <button
                    onClick={() => handleUpdateRoundConfig('failPassesTurn', !roundConfig[currentRound]?.failPassesTurn)}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      roundConfig[currentRound]?.failPassesTurn 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {roundConfig[currentRound]?.failPassesTurn ? 'Pierde turno' : 'Siguiente palabra'}
                  </button>
                </div>
                
                {/* Allow skip */}
                <div className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2">
                  <span className="text-gray-400 text-xs">Skip</span>
                  <button
                    onClick={() => handleUpdateRoundConfig('allowSkip', !roundConfig[currentRound]?.allowSkip)}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      roundConfig[currentRound]?.allowSkip 
                        ? 'bg-green-600 hover:bg-green-500 text-white' 
                        : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                    }`}
                  >
                    {roundConfig[currentRound]?.allowSkip ? 'Permitido' : 'No permitido'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className={`inline-block px-6 py-2 rounded-full ${
            timeLeft <= 10 && timeLeft > 0 
              ? 'bg-red-500/30 text-red-400 animate-pulse' 
              : 'bg-gray-700 text-white'
          }`}>
            <span className="text-2xl font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
            <span className="text-gray-400 text-sm ml-2">/ {roundTime}s</span>
          </div>
        </div>

        {/* Palabra (solo para el que describe) */}
        {isMyTurn && turnActive && (
          <div className="bg-indigo-500/30 border-2 border-indigo-500 rounded-2xl p-6 text-center">
            <p className="text-gray-300 text-sm mb-2">Tu palabra:</p>
            <p className="text-4xl font-bold text-indigo-400 uppercase">{currentWord}</p>
          </div>
        )}

        {/* No estoy en el equipo activo - esperar */}
        {!amIInCurrentTeam && waitingForStart && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-center">
            <p className="text-gray-400 mb-2">Turno de:</p>
            <p className="text-xl font-bold text-white">{currentTeam?.name}</p>
            <p className="text-gray-500 text-sm mt-2">
              Espera a que comience su turno
            </p>
          </div>
        )}

        {/* Estoy en el equipo actual pero no está activo - puedo iniciar */}
        {amIInCurrentTeam && !turnActive && waitingForStart && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-center">
            <p className="text-gray-400 mb-4">¡Tu equipo tiene el turno!</p>
            <button
              onClick={handleStartTurn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              ▶ Empezar Turno
            </button>
          </div>
        )}

        {/* Botones de acción (solo para el que describe cuando está activo) */}
        {isMyTurn && turnActive && !isProcessing && (
          <div className="space-y-3">
            <button
              onClick={handleCorrect}
              disabled={!currentWord}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
            >
              ✓ Correcto
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleWrong}
                disabled={!roundConfig[currentRound]?.failPassesTurn || !currentWord}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                ✗ Wrong
              </button>
              <button
                onClick={handleSkip}
                disabled={!roundConfig[currentRound]?.allowSkip || !currentWord}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                ⏭ Skip
              </button>
            </div>

            <button
              onClick={handleChangeTeam}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cambiar de Equipo →
            </button>
          </div>
        )}

        {/* Info para quienes no describen */}
        {!isMyTurn && turnActive && (
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-gray-400">
              {currentTeam?.players.includes(socket.id)
                ? 'Tu equipo está adivinando...'
                : 'El otro equipo está jugando'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Responded en voz alta!
            </p>
          </div>
        )}

        {/* Scores */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Puntuación</p>
          <div className="space-y-2">
            {teams.map((team) => (
              <div 
                key={team.id}
                className={`flex justify-between items-center p-2 rounded-lg ${
                  team.id === currentTeamTurn ? 'bg-indigo-500/20' : 'bg-gray-700/30'
                }`}
              >
                <span className="text-white font-medium">
                  {team.name}
                  {team.id === currentTeamTurn && ' ←'}
                </span>
                <span className="text-indigo-400 font-bold text-lg">{team.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Botón terminar ronda (solo el host puede terminar) */}
        {!turnActive && isHost && (
          <button
            onClick={handleEndRound}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Terminar Ronda (Host)
          </button>
        )}
        
        {/* Mensaje para no-host */}
        {!turnActive && !isHost && (
          <div className="text-center text-gray-500 text-sm">
            Esperando que el host termine la ronda...
          </div>
        )}
      </div>
    </div>
  );
}

export default TimesUpPlayView;
