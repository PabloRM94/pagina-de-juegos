/**
 * Componente StatusBadge - Muestra el estado de un jugador
 * @param {string} status - Estado: waiting, hidden, eliminated
 */
export function StatusBadge({ status }) {
  const statusClasses = {
    waiting: 'status-waiting',
    hidden: 'status-hidden',
    eliminated: 'status-eliminated'
  };
  
  const statusLabels = {
    waiting: 'Visible',
    hidden: 'Escondido',
    eliminated: 'Eliminado'
  };
  
  return (
    <span className={`status-badge ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export default StatusBadge;
