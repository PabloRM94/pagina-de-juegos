import { useState, useEffect, useRef, useCallback } from 'react';
import { VIEWS } from '../constants/index.js';
import { 
  ROUND_NAMES, 
  ROUND_TIMES,
  startTurn,
  markCorrect,
  markWrong,
  skipWord,
  endTurn,
  endRound,
  updateRoundConfig,
  getCurrentPlayer,
  getRemainingWordsCount
} from '../utils/timesupLocalEngine.js';

const ROUND_TIME_OPTIONS = [
  { value: 30000, label: '30 segundos' },
  { value: 45000, label: '45 segundos' },
  { value: 60000, label: '60 segundos' },
  { value: 90000, label: '90 segundos' },
  { value: 120000, label: '2 minutos' }
];

/**
 * Vista principal de juego TimeUp New
 */
export function TimesupNewPlayView({ onNavigate }) {
  const [gameState, setGameState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const timerRef = useRef(null);

  // Cargar estado del juego
  useEffect(() => {
    const saved = sessionStorage.getItem('timesupnew_state');
    if (saved) {
      setGameState(JSON.parse(saved));
    } else {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
    }
  }, [onNavigate]);

  // Timer
  useEffect(() => {
    if (gameState?.turnActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Time's up - terminar turno
            clearInterval(timerRef.current);
            handleTurnTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState?.turnActive]);

  // Manejar timeout del turno
  const handleTurnTimeout = useCallback(() => {
    if (!gameState) return;
    
    // Terminar turno por tiempo
    const newState = endTurn(gameState);
    newState.turnActive = false;
    newState.currentWord = null;
    
    setGameState(newState);
    sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
    
    // Guardar datos para pantalla de pasar móvil
    sessionStorage.setItem('timesupnew_passData', JSON.stringify({
      teamId: newState.currentTeamTurn,
      teamName: newState.teams[newState.currentTeamTurn]?.name || 'Equipo',
      playerName: getCurrentPlayer(newState) || 'Jugador',
      isEndOfRound: false
    }));
    
    onNavigate(VIEWS.TIMESUP_NEW_PASS);
  }, [gameState, onNavigate]);

  // Iniciar turno
  const handleStartTurn = () => {
    if (!gameState) return;
    
    const newState = startTurn(gameState);
    const roundConfig = newState.roundConfig[newState.currentRound];
    setTimeLeft(Math.floor(roundConfig.timePerTurn / 1000));
    
    setGameState(newState);
    sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
  };

  // Botón correcto
  const handleCorrect = () => {
    if (!gameState || isProcessing) return;
    setIsProcessing(true);
    
    const newState = markCorrect(gameState);
    setGameState(newState);
    sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
    setIsProcessing(false);
  };

  // Botón wrong
  const handleWrong = () => {
    if (!gameState || isProcessing) return;
    setIsProcessing(true);
    
    const newState = markWrong(gameState);
    
    // Si failPassesTurn es true, termina el turno
    const roundConfig = newState.roundConfig[newState.currentRound];
    if (roundConfig.failPassesTurn || !newState.currentWord) {
      // Terminar turno
      const endedState = endTurn(newState);
      endedState.turnActive = false;
      endedState.currentWord = null;
      
      setGameState(endedState);
      sessionStorage.setItem('timesupnew_state', JSON.stringify(endedState));
      
      // Guardar datos para pantalla de pasar móvil
      sessionStorage.setItem('timesupnew_passData', JSON.stringify({
        teamId: endedState.currentTeamTurn,
        teamName: endedState.teams[endedState.currentTeamTurn]?.name || 'Equipo',
        playerName: getCurrentPlayer(endedState) || 'Jugador',
        isEndOfRound: false
      }));
      
      onNavigate(VIEWS.TIMESUP_NEW_PASS);
    } else {
      setGameState(newState);
      sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
    }
    
    setIsProcessing(false);
  };

  // Botón skip
  const handleSkip = () => {
    if (!gameState || isProcessing) return;
    setIsProcessing(true);
    
    const newState = skipWord(gameState);
    
    if (!newState.currentWord) {
      // No hay más palabras - terminar turno
      const endedState = endTurn(newState);
      endedState.turnActive = false;
      endedState.currentWord = null;
      
      setGameState(endedState);
      sessionStorage.setItem('timesupnew_state', JSON.stringify(endedState));
      
      // Guardar datos para pantalla de pasar móvil
      sessionStorage.setItem('timesupnew_passData', JSON.stringify({
        teamId: endedState.currentTeamTurn,
        teamName: endedState.teams[endedState.currentTeamTurn]?.name || 'Equipo',
        playerName: getCurrentPlayer(endedState) || 'Jugador',
        isEndOfRound: false
      }));
      
      onNavigate(VIEWS.TIMESUP_NEW_PASS);
    } else {
      setGameState(newState);
      sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
    }
    
    setIsProcessing(false);
  };

  // Cambiar al siguiente equipo (botón manual)
  const handleNextTeam = () => {
    if (!gameState) return;
    
    const newState = endTurn(gameState);
    newState.turnActive = false;
    newState.currentWord = null;
    
    setGameState(newState);
    sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
    
    // Guardar datos para pantalla de pasar móvil
    sessionStorage.setItem('timesupnew_passData', JSON.stringify({
      teamId: newState.currentTeamTurn,
      teamName: newState.teams[newState.currentTeamTurn]?.name || 'Equipo',
      playerName: getCurrentPlayer(newState) || 'Jugador',
      isEndOfRound: false
    }));
    
    onNavigate(VIEWS.TIMESUP_NEW_PASS);
  };

  // Terminar ronda
  const handleEndRound = () => {
    if (!gameState) return;
    
    const newState = endRound(gameState);
    setGameState(newState);
    sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
    
    if (newState.state === 'finished') {
      onNavigate(VIEWS.TIMESUP_NEW_FINAL);
    } else {
      // Guardar datos para resultado de ronda
      sessionStorage.setItem('timesupnew_roundData', JSON.stringify({
        round: gameState.currentRound,
        roundName: ROUND_NAMES[gameState.currentRound],
        teams: gameState.teams,
        roundScores: gameState.roundScores,
        isLastRound: gameState.currentRound >= gameState.config.totalRounds
      }));
      
      onNavigate(VIEWS.TIMESUP_NEW_ROUND_RESULT);
    }
  };

  // Actualizar config de ronda
  const handleUpdateConfig = (key, value) => {
    if (!gameState) return;
    
    const newState = updateRoundConfig(
      gameState, 
      gameState.currentRound, 
      { [key]: value }
    );
    
    setGameState(newState);
    sessionStorage.setItem('timesupnew_state', JSON.stringify(newState));
  };

  // Helper para obtener round config
  const getRoundConfig = () => {
    if (!gameState) return { timePerTurn: 60000, failPassesTurn: false, allowSkip: true };
    return gameState.roundConfig[gameState.currentRound] || { timePerTurn: 60000, failPassesTurn: false, allowSkip: true };
  };

  if (!gameState) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  const currentTeam = gameState.teams[gameState.currentTeamTurn];
  const currentPlayer = getCurrentPlayer(gameState);
  const roundConfig = getRoundConfig();
  const remainingWords = getRemainingWordsCount(gameState);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-2">
          <p className="text-gray-400 text-sm">
            Ronda {gameState.currentRound}: {ROUND_NAMES[gameState.currentRound]}
          </p>
          <h2 className="text-xl font-bold text-white">
            Turno: {currentTeam?.name || 'Equipo'}
          </h2>
        </div>

        {/* Panel de configuración de ronda */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-indigo-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-indigo-400 font-bold text-sm flex items-center gap-2">
              <span className="text-lg">📜</span> 
              {ROUND_NAMES[gameState.currentRound]}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
              >
                {showConfig ? 'Ocultar' : '⚙️'}
              </button>
              <span className="bg-indigo-600/30 text-indigo-300 text-xs px-2 py-1 rounded-full">
                Ronda {gameState.currentRound}
              </span>
            </div>
          </div>
          
          {/* Config expandible */}
          {showConfig && (
            <div className="space-y-2 mt-3 pt-3 border-t border-gray-700">
              {/* Tiempo */}
              <div className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2">
                <span className="text-gray-400 text-xs">Tiempo</span>
                <select
                  value={roundConfig.timePerTurn}
                  onChange={(e) => handleUpdateConfig('timePerTurn', parseInt(e.target.value))}
                  className="bg-gray-600 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-gray-500"
                  disabled={gameState.turnActive}
                >
                  {ROUND_TIME_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Fail passes turn */}
              <div className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2">
                <span className="text-gray-400 text-xs">Al fallar</span>
                <button
                  onClick={() => handleUpdateConfig('failPassesTurn', !roundConfig.failPassesTurn)}
                  disabled={gameState.turnActive}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    roundConfig.failPassesTurn 
                      ? 'bg-red-600 hover:bg-red-500 text-white' 
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  } ${gameState.turnActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {roundConfig.failPassesTurn ? 'Pierde turno' : 'Siguiente palabra'}
                </button>
              </div>
              
              {/* Allow skip */}
              <div className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2">
                <span className="text-gray-400 text-xs">Skip</span>
                <button
                  onClick={() => handleUpdateConfig('allowSkip', !roundConfig.allowSkip)}
                  disabled={gameState.turnActive}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    roundConfig.allowSkip 
                      ? 'bg-green-600 hover:bg-green-500 text-white' 
                      : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                  } ${gameState.turnActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {roundConfig.allowSkip ? 'Permitido' : 'No permitido'}
                </button>
              </div>
            </div>
          )}
          
          {/* Info básica */}
          <div className="grid grid-cols-3 gap-2 text-center mt-3">
            <div className="bg-gray-700/40 rounded-lg p-2">
              <p className="text-gray-500 text-xs mb-1">⏱️ Tiempo</p>
              <p className="text-white font-bold">{Math.floor(roundConfig.timePerTurn / 1000)}s</p>
            </div>
            <div className="bg-gray-700/40 rounded-lg p-2">
              <p className="text-gray-500 text-xs mb-1">❌ Fallar</p>
              <p className={`font-bold ${roundConfig.failPassesTurn ? 'text-red-400' : 'text-green-400'}`}>
                {roundConfig.failPassesTurn ? 'Pierde' : 'Continúa'}
              </p>
            </div>
            <div className="bg-gray-700/40 rounded-lg p-2">
              <p className="text-gray-500 text-xs mb-1">⏭️ Skip</p>
              <p className={`font-bold ${roundConfig.allowSkip ? 'text-green-400' : 'text-gray-500'}`}>
                {roundConfig.allowSkip ? '✓' : '✗'}
              </p>
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className={`inline-block px-6 py-2 rounded-full ${
            timeLeft <= 10 && timeLeft > 0 
              ? 'bg-red-500/30 text-red-400 animate-pulse' 
              : 'bg-gray-700 text-white'
          }`}>
            <span className="text-2xl font-bold">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
            <span className="text-gray-400 text-sm ml-2">
              / {Math.floor(roundConfig.timePerTurn / 1000)}s
            </span>
          </div>
        </div>

        {/* Palabra actual */}
        {gameState.turnActive && gameState.currentWord && (
          <div className="bg-indigo-500/30 border-2 border-indigo-500 rounded-2xl p-6 text-center">
            <p className="text-gray-300 text-sm mb-2">Palabra actual:</p>
            <p className="text-4xl font-bold text-indigo-400 uppercase">
              {gameState.currentWord}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {remainingWords} palabras restantes
            </p>
          </div>
        )}

        {/* Estado: Turno no activo - esperar o iniciar */}
        {!gameState.turnActive && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-center">
            <p className="text-gray-400 mb-4">Turno de: <span className="text-white font-bold">{currentTeam?.name}</span></p>
            {currentPlayer && (
              <p className="text-indigo-400 mb-4">🎤 {currentPlayer}</p>
            )}
            <button
              onClick={handleStartTurn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              ▶ Empezar Turno
            </button>
          </div>
        )}

        {/* Botones de acción (cuando turno activo) */}
        {gameState.turnActive && gameState.currentWord && !isProcessing && (
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
                disabled={!roundConfig.failPassesTurn}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                ✗ Wrong
              </button>
              <button
                onClick={handleSkip}
                disabled={!roundConfig.allowSkip}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                ⏭ Skip
              </button>
            </div>

            <button
              onClick={handleNextTeam}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cambiar de Equipo →
            </button>
          </div>
        )}

        {/* Procesando */}
        {isProcessing && (
          <div className="text-center text-gray-400 py-4">
            Procesando...
          </div>
        )}

        {/* Scores */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Puntuación</p>
          <div className="space-y-2">
            {gameState.teams.map((team) => (
              <div 
                key={team.id}
                className={`flex justify-between items-center p-2 rounded-lg ${
                  team.id === gameState.currentTeamTurn ? 'bg-indigo-500/20' : 'bg-gray-700/30'
                }`}
              >
                <span className="text-white font-medium">
                  {team.name}
                  {team.id === gameState.currentTeamTurn && ' ←'}
                </span>
                <span className="text-indigo-400 font-bold text-lg">{team.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Botón terminar ronda */}
        {!gameState.turnActive && (
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
