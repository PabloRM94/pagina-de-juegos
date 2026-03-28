import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de Palabras
 * Cada jugador envía sus palabras (mínimo 3)
 */
export function TimesupNewWordsView({ onNavigate }) {
  const { socket } = useSocket();
  
  const [roomId, setRoomId] = useState('');
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [readyCount, setReadyCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isMyWordsReady, setIsMyWordsReady] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Cargar datos iniciales
  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('timesupnew_roomId');
    if (!storedRoomId) {
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
      return;
    }
    
    setRoomId(storedRoomId);
    
    // Escuchar eventos
    const handlePlayerReady = (data) => {
      setReadyCount(data.readyCount);
      setTotalPlayers(data.totalPlayers);
    };
    
    const handleAllWordsReceived = (data) => {
      console.log('[TimesupNew] Todas las palabras recibidas:', data);
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
  
  // Añadir palabra
  const handleAddWord = () => {
    if (!newWord.trim()) return;
    
    const wordLower = newWord.trim().toLowerCase();
    if (words.some(w => w.toLowerCase() === wordLower)) {
      setError('Palabra duplicada');
      return;
    }
    
    setWords([...words, newWord.trim()]);
    setNewWord('');
    setError('');
  };
  
  // Eliminar palabra
  const handleRemoveWord = (index) => {
    const newWords = [...words];
    newWords.splice(index, 1);
    setWords(newWords);
    setIsMyWordsReady(false);
  };
  
  // Enviar palabras
  const handleSubmit = async () => {
    if (words.length < 3) {
      setError('Mínimo 3 palabras');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await new Promise((resolve, reject) => {
        socket.emit('timesupnew-submit-words', {
          roomId,
          words
        }, (response) => {
          if (response.success) resolve(response);
          else reject(new Error(response.error));
        });
      });
      
      setIsMyWordsReady(true);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const canSubmit = words.length >= 3;
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">📝 Tus Palabras</h1>
          <p className="text-gray-400">{words.length} palabras · Mínimo 3</p>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}
        
        {/* Estado de mis palabras */}
        {isMyWordsReady ? (
          <div className="bg-green-500/20 border border-green-500 rounded-2xl p-6 text-center">
            <p className="text-green-400 text-lg mb-2">✅ Palabras enviadas</p>
            <p className="text-gray-400">Esperando a los demás jugadores...</p>
          </div>
        ) : (
          <>
            {/* Input de palabras */}
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
              <label className="block text-gray-400 text-sm mb-3">Añadir palabra</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddWord()}
                  placeholder="Escribe una palabra"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleAddWord}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            
            {/* Lista de palabras */}
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-3">Tus palabras ({words.length})</p>
              <div className="flex flex-wrap gap-2">
                {words.map((word, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 bg-indigo-600/50 text-white text-sm px-3 py-1 rounded-full"
                  >
                    {word}
                    <button
                      onClick={() => handleRemoveWord(index)}
                      className="text-indigo-300 hover:text-white ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {words.length === 0 && (
                  <p className="text-gray-500 italic">Añade al menos 3 palabras</p>
                )}
              </div>
            </div>
            
            {/* Botón enviar */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
                canSubmit
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting 
                ? 'Enviando...' 
                : canSubmit 
                  ? '✓ Enviar Palabras' 
                  : `Añade ${3 - words.length} palabras más`}
            </button>
          </>
        )}
        
        {/* Progreso de todos */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-3">Progreso de jugadores</p>
          <div className="flex items-center justify-between">
            <span className="text-white">
              {readyCount} / {totalPlayers || '...'} jugadores han enviado
            </span>
            {totalPlayers > 0 && (
              <div className="w-24 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${(readyCount / totalPlayers) * 100}%` }}
                />
              </div>
            )}
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

export default TimesupNewWordsView;
