import Card from './Card.jsx';

/**
 * Componente CounterCard - Tarjeta de contador con botones +/-
 * @param {string} title - Título del contador
 * @param {string} icon - Icono emoji
 * @param {number} value - Valor actual
 * @param {function} onInc - Callback al incrementar
 * @param {function} onDec - Callback al decrementar
 * @param {string} color - Clase de color de fondo
 * @param {boolean} readOnly - Si es solo lectura (sin botones)
 * @param {boolean} isLoading - Si está cargando (muestra spinner sobre el número)
 */
export function CounterCard({ title, icon, value, onInc, onDec, color, readOnly, isLoading }) {
  
  return (
    <Card className={color}>
      <div className="text-center">
        <div className="text-4xl mb-2">{icon}</div>
        <p className="text-gray-400 text-sm">{title}</p>
        <div className="relative inline-block my-4">
          <p className={`text-5xl font-bold text-white ${isLoading ? 'opacity-20' : ''}`}>{value}</p>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="inline-block animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></span>
            </div>
          )}
        </div>
        {readOnly ? (
          <p className="text-gray-500 text-xs">Solo admin puede modificar</p>
        ) : (
          <div className="flex gap-2 justify-center">
            <button 
              onClick={onDec} 
              className="btn-secondary px-4" 
              disabled={isLoading}
            >
              -
            </button>
            <button 
              onClick={onInc} 
              className="btn-primary px-4" 
              disabled={isLoading}
            >
              +
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default CounterCard;
