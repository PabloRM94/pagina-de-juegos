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
 */
export function CounterCard({ title, icon, value, onInc, onDec, color, readOnly }) {
  return (
    <Card className={color}>
      <div className="text-center">
        <div className="text-4xl mb-2">{icon}</div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-5xl font-bold text-white my-4">{value}</p>
        {readOnly ? (
          <p className="text-gray-500 text-xs">Solo admin puede modificar</p>
        ) : (
          <div className="flex gap-2 justify-center">
            <button onClick={onDec} className="btn-secondary px-4">-</button>
            <button onClick={onInc} className="btn-primary px-4">+</button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default CounterCard;
