import { useState, useEffect } from 'react';
import { VIEWS } from '../constants/index.js';
import { DEFAULT_WORD_BANK } from '../utils/timesupLocalEngine.js';

/**
 * Vista de Palabras de TimeUp New
 * Introducir palabras y banco inicial
 */
export function TimesupNewWordsView({ onNavigate }) {
  const [gameData, setGameData] = useState(null);
  const [words, setWords] = useState([...DEFAULT_WORD_BANK]);
  const [newWord, setNewWord] = useState('');
  const [error, setError] = useState('');
  const [showBank, setShowBank] = useState(true);

  // Cargar datos del lobby
  useEffect(() => {
    const saved = sessionStorage.getItem('timesupnew_gameData');
    if (saved) {
      setGameData(JSON.parse(saved));
    } else {
      // Volver al lobby si no hay datos
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
    }
  }, [onNavigate]);

  // Añadir palabra personalizada
  const handleAddWord = () => {
    if (!newWord.trim()) {
      setError('Ingresa una palabra');
      return;
    }

    const wordLower = newWord.trim().toLowerCase();
    
    // Verificar duplicado
    if (words.some(w => w.toLowerCase() === wordLower)) {
      setError('Esta palabra ya existe');
      return;
    }

    setWords([...words, newWord.trim()]);
    setNewWord('');
    setError('');
  };

  // Eliminar palabra del banco
  const handleRemoveWord = (index) => {
    const newWords = [...words];
    newWords.splice(index, 1);
    setWords(newWords);
  };

  // Toggle palabra del banco (activar/desactivar)
  const toggleWord = (index) => {
    // Por ahora solo eliminamos del array
    // Podríamos implementar un sistema de "palabras activas" más complejo
  };

  // Verificar si podemos continuar
  const canStart = words.length >= 5;

  // Iniciar juego
  const handleStart = () => {
    if (!canStart || !gameData) return;

    // Importar el motor dinámicamente para evitar problemas de inicialización
    import('../utils/timesupLocalEngine.js').then(module => {
      const { createLocalState } = module;
      
      // Crear estado inicial del juego
      const gameState = createLocalState(
        gameData.teams,
        words,
        gameData.config.withSounds
      );

      // Guardar estado inicial
      sessionStorage.setItem('timesupnew_state', JSON.stringify(gameState));

      // Guardar datos para pantalla de pasar móvil (PRIMERO)
      const firstTeam = gameState.teams[0];
      sessionStorage.setItem('timesupnew_passData', JSON.stringify({
        teamId: 0,
        teamName: firstTeam?.name || 'Equipo A',
        playerName: firstTeam?.players?.[0] || 'Primer jugador',
        isEndOfRound: false
      }));

      // Navegar a pasar móvil
      onNavigate(VIEWS.TIMESUP_NEW_PASS);
    }).catch(err => {
      console.error('Error al iniciar juego:', err);
    });
  };

  // Volver al lobby
  const handleBack = () => {
    onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
  };

  if (!gameData) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white mb-2">📝 Palabras</h1>
          <p className="text-gray-400">{words.length} palabras disponibles</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Añadir palabras personalizadas */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <label className="block text-gray-400 text-sm mb-3">Añadir palabras</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddWord()}
              placeholder="Nueva palabra"
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddWord}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Banco de palabras */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <button
            type="button"
            onClick={() => setShowBank(!showBank)}
            className="flex items-center justify-between w-full"
          >
            <span className="text-gray-300 font-medium">
              Banco de palabras ({DEFAULT_WORD_BANK.length})
            </span>
            <span className="text-gray-400 text-sm">
              {showBank ? '▼ Ocultar' : '▶ Mostrar'}
            </span>
          </button>
          
          {showBank && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {words.map((word, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 bg-gray-700 text-white text-sm px-2 py-1 rounded-full"
                  >
                    {word}
                    <button
                      type="button"
                      onClick={() => handleRemoveWord(index)}
                      className="text-gray-400 hover:text-red-400 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Equipos config */}
        <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-2">Equipos</p>
          <div className="flex flex-wrap gap-2">
            {gameData.teams.map((team) => (
              <div key={team.id} className="bg-indigo-600/30 text-indigo-300 px-3 py-1 rounded-lg text-sm">
                {team.name}: {team.players.length} jugadores
              </div>
            ))}
          </div>
        </div>

        {/* Botón iniciar */}
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
            canStart
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {canStart 
            ? '🎮 Iniciar Juego' 
            : `Necesitas al menos 5 palabras (tienes ${words.length})`}
        </button>

        {/* Botón volver */}
        <button
          type="button"
          onClick={handleBack}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}

export default TimesupNewWordsView;
