import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

const ROUND_NAMES = {
  1: 'Descripción Libre',
  2: 'Una Palabra',
  3: 'Mímica',
  4: 'Sonidos'
};

const ROUND_TIME_OPTIONS = [
  { value: 30000, label: '30 segundos' },
  { value: 45000, label: '45 segundos' },
  { value: 60000, label: '60 segundos' },
  { value: 90000, label: '90 segundos' },
  { value: 120000, label: '2 minutos' }
];

/**
 * Vista principal de juego TimeUp New (Multiplayer)
 */
export function TimesupNewPlayView({ onNavigate }) {
  const { socket } = useSocket();
  
  const [roomId, setRoomId] = useState('');
  const [teams, setTeams] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTeamTurn, setCurrentTeamTurn] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [turnActive, setTurnActive] = useState(false);
  const [roundConfig, setRoundConfig] = useState({});
  const [showConfig, setShowConfig] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  
  const timerRef = useRef(null);
  
  // Cargar datos iniciales
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('timesupnew_roomId');
    const storedHost = sessionStorage.getItem('timesupnew_host');
    
    if (!storedRoomId) {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
      return;
    }
    
    setRoomId(storedRoomId);
    setIsHost(storedHost === socket.id);
    
    // Escuchar eventos
    const handleTurnStarted = (data) => {
      if (data.roomId !== roomId) return;
      setCurrentWord(data.word || '');
      setTimeLeft(Math.floor(data.timeLimit / 1000));
      setTurnActive(true);
      setCurrentTeamTurn(data.teamId);
      startLocalTimer(data.timeLimit);
    };
    
    const handleWordCorrect = (data) => {
      if (data.roomId !== roomId) return;
      setIsProcessing(false);
      setCurrentWord(data.nextWord || '');
      // Actualizar scores
      setTeams(prev => prev.map((t, i) => 
        i === data.teamId ? { ...t, score: data.teamScore } : t
      ));
    };
    
    const handleWordWrong = (data) => {
      if (data.roomId !== roomId) return;
      setIsProcessing(false);
      if (data.nextWord) {
        setCurrentWord(data.nextWord);
      }
    };
    
    const handleWordSkipped = (data) => {
      if (data.roomId !== roomId) return;
      setIsProcessing(false);
      setCurrentWord(data.nextWord || '');
    };
    
    const handleWrongAnswer = (data) => {
      if (data.roomId !== roomId) return;
      setTurnActive(false);
      setCurrentTeamTurn(data.nextTeamId);
      setCurrentWord('');
      if (timerRef.current) clearInterval(timerRef.current);
    };
    
    const handleTeamTurnChanged = (data) => {
      if (data.roomId !== roomId) return;
      setCurrentTeamTurn(data.nextTeamId);
      setTurnActive(false);
      setCurrentWord('');
      setCurrentRound(data.round);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    
    const handleRoundEnded = (data) => {
      if (data.roomId !== roomId) return;
      if (timerRef.current) clearInterval(timerRef.current);
      setTurnActive(false);
      setCurrentRound(data.round);
      
      // Guardar datos para resultado
      sessionStorage.setItem('timesupnew_roundData', JSON.stringify({
        round: data.round,
        roundName: data.roundName,
        teams: data.leaderboard,
        roundScores: data.scores,
        isLastRound: data.isLastRound
      }));
      
      if (data.isLastRound) {
        onNavigate(VIEWS.TIMESUP_NEW_FINAL);
      } else {
        onNavigate(VIEWS.TIMESUP_NEW_ROUND_RESULT);
      }
    };
    
    const handleRoundConfigUpdated = (data) => {
      if (data.roomId !== roomId) return;
      setRoundConfig(prev => ({
        ...prev,
        [data.roundNumber]: data.config
      }));
    };
    
    socket.on('timesupnew-turn-started', handleTurnStarted);
    socket.on('timesupnew-word-correct', handleWordCorrect);
    socket.on('timesupnew-word-wrong', handleWordWrong);
    socket.on('timesupnew-word-skipped', handleWordSkipped);
    socket.on('timesupnew-wrong-answer', handleWrongAnswer);
    socket.on('timesupnew-team-turn-changed', handleTeamTurnChanged);
    socket.on('timesupnew-round-ended', handleRoundEnded);
    socket.on('timesupnew-round-config-updated', handleRoundConfigUpdated);
    
    // Obtener estado inicial
    socket.emit('timesupnew-get-state', { roomId }, (response) => {
      if (response.success) {
        setTeams(response.teams || []);
        setCurrentRound(response.currentRound || 1);
        setCurrentTeamTurn(response.currentTeamTurn || 0);
        setRoundConfig(response.roundConfig || {});
      }
    });
    
    return () => {
      socket.off('timesupnew-turn-started', handleTurnStarted);
      socket.off('timesupnew-word-correct', handleWordCorrect);
      socket.off('timesupnew-word-wrong', handleWordWrong);
      socket.off('timesupnew-word-skipped', handleWordSkipped);
      socket.off('timesupnew-wrong-answer', handleWrongAnswer);
      socket.off('timesupnew-team-turn-changed', handleTeamTurnChanged);
      socket.off('timesupnew-round-ended', handleRoundEnded);
      socket.off('timesupnew-round-config-updated', handleRoundConfigUpdated);
    };
  }, [socket, roomId, onNavigate]);
  
  const startLocalTimer = (duration) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
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
  
  // Iniciar turno
  const handleStartTurn = async () => {
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-start-turn', { roomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error:', err);
    }
  };
  
  // Botones
  const handleCorrect = async () => {
    if (!turnActive || !currentWord || isProcessing) return;
    setIsProcessing(true);
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-correct', { roomId, word: currentWord }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      setIsProcessing(false);
    }
  };
  
  const handleWrong = async () => {
    if (!turnActive || isProcessing) return;
    setIsProcessing(true);
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-wrong', { roomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      setIsProcessing(false);
    }
  };
  
  const handleSkip = async () => {
    if (!turnActive || !currentWord || isProcessing) return;
    setIsProcessing(true);
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-skip', { roomId, word: currentWord }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      setIsProcessing(false);
    }
  };
  
  const handleChangeTeam = async () => {
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-change-team', { roomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error:', err);
    }
  };
  
  const handleEndRound = async () => {
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-end-round', { roomId }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error:', err);
    }
  };
  
  const handleUpdateConfig = async (key, value) => {
    if (!isHost || turnActive) return;
    const newConfig = { ...(roundConfig[currentRound] || {}), [key]: value };
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-update-round-config', {
          roomId,
          roundNumber: currentRound,
          config: newConfig
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
    } catch (err) {
      console.error('Error:', err);
    }
  };
  
  const currentTeam = teams[currentTeamTurn];
  const config = roundConfig[currentRound] || { timePerTurn: 60000, failPassesTurn: false, allowSkip: true };
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-2">
          <p className="text-gray-400 text-sm">Ronda {currentRound}: {ROUND_NAMES[currentRound]}</p>
          <h2 className="text-xl font-bold text-white">
            Turno: {currentTeam?.name || 'Equipo'}
          </h2>
        </div>
        
        {/* Timer */}
        <div className="text-center">
          <div className={`inline-block px-6 py-2 rounded-full ${
            timeLeft <= 10 && timeLeft > 0 ? 'bg-red-500/30 text-red-400 animate-pulse' : 'bg-gray-700 text-white'
          }`}>
            <span className="text-2xl font-bold">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
        
        {/* Palabra actual */}
        {turnActive && currentWord && (
          <div className="bg-indigo-500/30 border-2 border-indigo-500 rounded-2xl p-6 text-center">
            <p className="text-gray-300 text-sm mb-2">Palabra:</p>
            <p className="text-4xl font-bold text-indigo-400 uppercase">{currentWord}</p>
          </div>
        )}
        
        {/* Estado: Turno no activo */}
        {!turnActive && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-center">
            <p className="text-gray-400 mb-4">
              Turno de: <span className="text-white font-bold">{currentTeam?.name}</span>
            </p>
            <button
              onClick={handleStartTurn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              ▶ Empezar Turno
            </button>
          </div>
        )}
        
        {/* Botones de acción */}
        {turnActive && currentWord && !isProcessing && (
          <div className="space-y-3">
            <button
              onClick={handleCorrect}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-colors text-lg"
            >
              ✓ Correcto
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleWrong}
                disabled={!config.failPassesTurn}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                ✗ Wrong
              </button>
              <button
                onClick={handleSkip}
                disabled={!config.allowSkip}
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
        
        {/* Terminar ronda (host) */}
        {!turnActive && isHost && (
          <button
            onClick={handleEndRound}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Terminar Ronda
          </button>
        )}
      </div>
    </div>
  );
}

export default TimesupNewPlayView;
