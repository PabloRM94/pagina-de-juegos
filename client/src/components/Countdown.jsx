import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Calcula el tiempo restante hasta una fecha objetivo
 * @param {string} targetDate - Fecha objetivo en formato ISO
 * @returns {object} - Objeto con days, hours, minutes, seconds
 */
const calculateTimeLeft = (targetDate) => {
  if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  
  const diff = new Date(targetDate) - new Date();
  if (diff > 0) {
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60)
    };
  }
  return { days: 0, hours: 0, minutes: 0, seconds: 0 };
};

/**
 * Componente Countdown - Muestra una cuenta regresiva
 * @param {string} targetDate - Fecha objetivo
 * @param {function} onComplete - Callback cuando la cuenta regresiva termina
 */
export function Countdown({ targetDate, onComplete }) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  
  // Mantener referencia actualizada de onComplete
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    // Reset completion flag when targetDate changes
    completedRef.current = false;
  }, [targetDate]);
  
  useEffect(() => {
    const updateTimer = () => {
      const newTime = calculateTimeLeft(targetDate);
      setTime(newTime);
      
      // Verificar si el tiempo llegó a cero - solo llamar onComplete una vez
      const isZero = newTime.days === 0 && newTime.hours === 0 && newTime.minutes === 0 && newTime.seconds === 0;
      if (isZero && !completedRef.current && onCompleteRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    };
    
    // Calcular inmediatamente
    updateTimer();
    
    // Actualizar cada segundo
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [targetDate]);
  
  return (
    <div className="flex justify-center gap-4">
      {Object.entries(time).map(([unit, value]) => (
        <div key={unit} className="text-center">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-4 min-w-[80px]">
            <span className="text-4xl font-bold text-white">
              {String(value).padStart(2, '0')}
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-2 capitalize">{unit}</p>
        </div>
      ))}
    </div>
  );
}

export default Countdown;
