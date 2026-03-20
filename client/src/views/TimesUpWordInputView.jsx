import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista para ingresar palabras
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar
 */
export function TimesUpWordInputView({ onNavigate }) {
  const { socket } = useSocket();
  
  // Leer datos de sessionStorage (Time's Up usa su propio storage)
  const storedRoomId = sessionStorage.getItem('timesup_roomId') || '';
  const storedTeams = JSON.parse(sessionStorage.getItem('timesup_teams') || '[]');
  
  // Contar jugadores desde los equipos
  const totalPlayers = storedTeams.reduce((acc, team) => acc + team.players.length, 0);
  
  const [roomId] = useState(storedRoomId);
  const [words, setWords] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [readyCount, setReadyCount] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState('');

    // Escuchar eventos
    useEffect(() => {
      // Leer roomId fresco de sessionStorage
      const currentRoomId = () => sessionStorage.getItem('timesup_roomId');
      
      const handlePlayerReady = (data) => {
        console.log('[WordInput] Player ready:', data);
        // Verificar que el evento es para nuestra sala
        if (data.roomId && data.roomId !== currentRoomId()) {
          console.log('[WordInput] Evento ignorado - sala diferente');
          return;
        }
        setReadyCount(data.readyCount);
      };

      const handleAllWordsReceived = (data) => {
        console.log('[WordInput] Todas las palabras recibidas:', data);
        // Verificar que el evento es para nuestra sala
        if (data.roomId && data.roomId !== currentRoomId()) {
          console.log('[WordInput] Evento ignorado - sala diferente');
          return;
        }
        
        // Guardar roundConfig en sessionStorage para que PlayView lo use
        if (data.roundConfig) {
          sessionStorage.setItem('timesup_roundConfig', JSON.stringify(data.roundConfig));
        }
        
        onNavigate(VIEWS.TIMESUP_PLAY);
      };

    socket.on('timesup-player-ready', handlePlayerReady);
    socket.on('timesup-all-words-received', handleAllWordsReceived);

    return () => {
      socket.off('timesup-player-ready', handlePlayerReady);
      socket.off('timesup-all-words-received', handleAllWordsReceived);
    };
  }, [socket, onNavigate]);

  const handleAddWord = () => {
    const trimmed = currentWord.trim();
    if (!trimmed) return;
    if (words.length >= 10) {
      setError('Máximo 10 palabras');
      return;
    }
    if (words.includes(trimmed.toLowerCase())) {
      setError('Palabra repetida');
      return;
    }
    
    setWords([...words, trimmed.toLowerCase()]);
    setCurrentWord('');
    setError('');
  };

  const handleRemoveWord = (index) => {
    setWords(words.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Leer roomId directamente de sessionStorage
    const currentRoomId = sessionStorage.getItem('timesup_roomId') || roomId;
    
    if (!currentRoomId) {
      setError('No se encontró la sala');
      return;
    }
    
    if (words.length < 3) {
      setError('Mínimo 3 palabras');
      return;
    }

    setError('');

    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesup-submit-words', {
          roomId: currentRoomId,
          words
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });

      setHasSubmitted(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddWord();
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">📝 Ingresa Palabras</h1>
          <p className="text-gray-400">Escribe 3-10 palabras para adivinar</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Input de palabras */}
        {!hasSubmitted && (
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe una palabra"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleAddWord}
                disabled={words.length >= 10}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                +
              </button>
            </div>

            {/* Palabras agregadas */}
            {words.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {words.map((word, index) => (
                  <span
                    key={index}
                    className="bg-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                  >
                    {word}
                    <button
                      onClick={() => handleRemoveWord(index)}
                      className="text-indigo-400 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Contador */}
            <p className="text-center text-gray-500 text-sm">
              {words.length} / 10 palabras (mínimo 3)
            </p>

            {/* Botón enviar */}
            <button
              onClick={handleSubmit}
              disabled={words.length < 3}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Enviar Palabras
            </button>
          </div>
        )}

        {/* Estado de espera */}
        {hasSubmitted && (
          <div className="bg-green-500/20 rounded-2xl p-6 border border-green-500/50 text-center">
            <p className="text-green-400 text-lg mb-2">✓ Palabras enviadas</p>
            <p className="text-gray-400">Esperando a los demás jugadores...</p>
          </div>
        )}

        {/* Progreso de jugadores */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-2">Jugadores que enviaron palabras</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${(readyCount / totalPlayers) * 100}%` }}
              />
            </div>
            <span className="text-white font-medium">{readyCount} / {totalPlayers}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimesUpWordInputView;
