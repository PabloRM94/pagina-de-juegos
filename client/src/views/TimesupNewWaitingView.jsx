import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Espera
 * Mostrada cuando se está esperando a que todos envíen palabras
 */
export function TimesupNewWaitingView({ onNavigate }) {
  const { socket } = useSocket();
  
  const [roomId, setRoomId] = useState('');
  const [readyCount, setReadyCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('timesupnew_roomId');
    if (!storedRoomId) {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
      return;
    }
    
    setRoomId(storedRoomId);
    
    const handlePlayerReady = (data) => {
      setReadyCount(data.readyCount);
      setTotalPlayers(data.totalPlayers);
    };
    
    const handleAllWordsReceived = (data) => {
      sessionStorage.setItem('timesupnew_state', JSON.stringify({
        state: 'playing',
        totalWords: data.totalWords,
        currentTeamTurn: data.currentTeamTurn,
        roundConfig: data.roundConfig
      }));
      onNavigate(VIEWS.TIMESUP_NEW_PASS);
    };
    
    socket.on('timesupnew-player-ready', handlePlayerReady);
    socket.on('timesupnew-all-words-received', handleAllWordsReceived);
    
    return () => {
      socket.off('timesupnew-player-ready', handlePlayerReady);
      socket.off('timesupnew-all-words-received', handleAllWordsReceived);
    };
  }, [socket, onNavigate]);
  
  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="text-6xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-white">Esperando a los demás...</h1>
        
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
          <p className="text-gray-400 mb-4">
            {readyCount} de {totalPlayers} jugadores han enviado sus palabras
          </p>
          
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all"
              style={{ width: totalPlayers > 0 ? `${(readyCount / totalPlayers) * 100}%` : '0%' }}
            />
          </div>
        </div>
        
        <p className="text-gray-500 text-sm">
          Cuando todos los jugadores envíen sus palabras, el juego comenzará automáticamente.
        </p>
      </div>
    </div>
  );
}

export default TimesupNewWaitingView;
