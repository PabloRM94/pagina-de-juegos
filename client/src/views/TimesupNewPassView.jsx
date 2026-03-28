import { useState, useEffect } from 'react';
import { VIEWS } from '../constants/index.js';

/**
 * Vista de "Pasar el móvil"
 * Pantalla intermedia entre turnos
 */
export function TimesupNewPassView({ onNavigate }) {
  const [countdown, setCountdown] = useState(3);
  const [passData, setPassData] = useState(null);

  useEffect(() => {
    // Cargar datos del turno
    const saved = sessionStorage.getItem('timesupnew_passData');
    if (saved) {
      setPassData(JSON.parse(saved));
    } else {
      // Volver al lobby si no hay datos
      onNavigate(VIEWS.TIMESUP_NEW_LOBBY);
    }
  }, [onNavigate]);

  // Countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Ir al juego directamente
      onNavigate(VIEWS.TIMESUP_NEW_PLAY);
    }
  }, [countdown, onNavigate]);

  // Skip countdown on tap
  const handleSkip = () => {
    setCountdown(0);
  };

  if (!passData) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <div 
        className="max-w-md mx-auto text-center cursor-pointer"
        onClick={handleSkip}
      >
        {/* Timer grande */}
        <div className="mb-8">
          <div className={`text-8xl font-bold ${
            countdown <= 1 
              ? 'text-red-500 animate-pulse' 
              : countdown <= 2 
                ? 'text-yellow-500' 
                : 'text-indigo-500'
          }`}>
            {countdown}
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
          <p className="text-gray-400 text-lg mb-4">
            Pasá el móvil al
          </p>
          <h1 className="text-4xl font-bold text-white mb-4">
            {passData.teamName}
          </h1>
          
          {passData.playerName && (
            <div className="bg-indigo-600/30 text-indigo-300 inline-block px-4 py-2 rounded-full">
              🎤 {passData.playerName}
            </div>
          )}
        </div>

        {/* Info adicional */}
        <p className="text-gray-500 mt-6 text-sm">
          Toca la pantalla para omitir
        </p>
      </div>
    </div>
  );
}

export default TimesupNewPassView;
