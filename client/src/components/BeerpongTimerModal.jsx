import { useState, useEffect } from 'react';

/**
 * Modal de Cronómetro para Beer Pong
 * Permite configurar, iniciar, pausar y reanudar el timer por partido
 * @param {object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {object} props.timer - Estado actual del timer desde el server
 * @param {function} props.onClose - Función para cerrar el modal
 * @param {function} props.onSetDuration - Función para configurar duración
 * @param {function} props.onStart - Función para iniciar timer
 * @param {function} props.onPause - Función para pausar timer
 * @param {function} props.onResume - Función para reanudar timer
 */
export function BeerpongTimerModal({ 
  isOpen, 
  timer, 
  onClose, 
  onSetDuration, 
  onStart, 
  onPause, 
  onResume 
}) {
  const [minutes, setMinutes] = useState(10);
  const [matchLabel, setMatchLabel] = useState('');
  const [matchId, setMatchId] = useState('');

  // Sincronizar minutos con el timer cuando cambia
  useEffect(() => {
    if (timer) {
      setMinutes(Math.floor(timer.duration / 60));
      setMatchLabel(timer.matchLabel || '');
      setMatchId(timer.matchId || '');
    }
  }, [timer]);

  if (!isOpen) return null;

  // Formatear segundos a MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetDuration = () => {
    onSetDuration(minutes);
  };

  const handleStart = () => {
    if (matchLabel.trim()) {
      onStart(matchId, matchLabel);
    } else {
      // Si no hay label, usar uno por defecto
      onStart('match-' + Date.now(), 'Partido');
    }
  };

  const isTimerActive = timer?.matchId && timer?.remaining > 0;
  const isRunning = timer?.isRunning === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">⏱ Cronómetro</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Display del Timer */}
        <div className="bg-gray-900 rounded-2xl p-8 mb-6 text-center">
          <div className="text-6xl font-mono font-bold text-white mb-2">
            {formatTime(timer?.remaining || 0)}
          </div>
          {timer?.matchLabel && (
            <div className="text-amber-400 font-medium">
              {timer.matchLabel}
            </div>
          )}
          {isRunning && (
            <div className="text-green-400 text-sm mt-2 animate-pulse">
              ● Corriendo
            </div>
          )}
          {!isRunning && isTimerActive && (
            <div className="text-yellow-400 text-sm mt-2">
              ⏸ Pausado
            </div>
          )}
        </div>

        {/* Configuración de duración */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">
            Duración del partido (minutos)
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              min="1"
              max="60"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-lg"
            />
            <button
              onClick={handleSetDuration}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>

        {/* Input para label del match */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">
            Nombre del partido (opcional)
          </label>
          <input
            type="text"
            value={matchLabel}
            onChange={(e) => setMatchLabel(e.target.value)}
            placeholder="Ej: Final, Semifinal 1, etc."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500"
          />
        </div>

        {/* Controles */}
        <div className="flex gap-3">
          {!isTimerActive ? (
            <button
              onClick={handleStart}
              className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>▶</span> Iniciar
            </button>
          ) : isRunning ? (
            <button
              onClick={onPause}
              className="flex-1 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>⏸</span> Pausar
            </button>
          ) : (
            <button
              onClick={onResume}
              className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>▶</span> Reanudar
            </button>
          )}
          
          {/* Botón para iniciar nuevo partido (reset) */}
          {isTimerActive && (
            <button
              onClick={handleStart}
              className="px-4 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
              title="Nuevo partido"
            >
              🔄
            </button>
          )}
        </div>

        {/* Info adicional */}
        <div className="mt-4 text-center text-gray-500 text-sm">
          {isTimerActive 
            ? 'Cualquier jugador puede pausar o reanudar' 
            : 'Configura la duración e inicia el cronómetro'}
        </div>
      </div>
    </div>
  );
}

export default BeerpongTimerModal;
