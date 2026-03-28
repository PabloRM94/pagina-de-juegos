import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de "Pasar el móvil"
 * Pantalla intermedia entre turnos
 */
export function TimesupNewPassView({ onNavigate }) {
  const { socket } = useSocket();
  const [countdown, setCountdown] = useState(3);
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  
  useEffect(() => {
    // Cargar datos del passData
    const saved = sessionStorage.getItem('timesupnew_passData');
    if (saved) {
      const data = JSON.parse(saved);
      setTeamName(data.teamName || '');
      setPlayerName(data.playerName || '');
    } else {
      // Intentar obtener del estado
      socket.emit('timesupnew-get-state', {}, (response) => {
        if (response.success && response.teams) {
          const team = response.teams[response.currentTeamTurn];
          setTeamName(team?.name || 'Equipo');
          setPlayerName('');
        }
      });
    }
    
    // Escuchar inicio de siguiente turno
    const handleTurnStarted = () => {
      setCountdown(0);
    };
    
    socket.on('timesupnew-turn-started', handleTurnStarted);
    
    return () => {
      socket.off('timesupnew-turn-started', handleTurnStarted);
    };
  }, [socket]);
  
  // Countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onNavigate(VIEWS.TIMESUP_NEW_PLAY);
    }
  }, [countdown, onNavigate]);
  
  const handleSkip = () => setCountdown(0);
  
  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center cursor-pointer" onClick={handleSkip}>
        {/* Timer grande */}
        <div className="mb-8">
          <div className={`text-8xl font-bold ${
            countdown <= 1 ? 'text-red-500 animate-pulse' : 
            countdown <= 2 ? 'text-yellow-500' : 'text-indigo-500'
          }`}>
            {countdown}
          </div>
        </div>
        
        {/* Mensaje principal */}
        <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
          <p className="text-gray-400 text-lg mb-4">Pasá el móvil al</p>
          <h1 className="text-4xl font-bold text-white mb-4">{teamName}</h1>
          
          {playerName && (
            <div className="bg-indigo-600/30 text-indigo-300 inline-block px-4 py-2 rounded-full">
              🎤 {playerName}
            </div>
          )}
        </div>
        
        <p className="text-gray-500 mt-6 text-sm">Toca la pantalla para omitir</p>
      </div>
    </div>
  );
}

export default TimesupNewPassView;
