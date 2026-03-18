import { Card } from '../components/index.js';

/**
 * Modal de confirmación para cerrar sesión
 * @param {object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {function} props.onConfirm - Callback al confirmar cierre de sesión
 * @param {function} props.onCancel - Callback al cancelar
 */
export function LogoutModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm">
        <Card className="text-center border-red-500/30 bg-gray-900/95">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
              <span className="text-3xl">🚪</span>
            </div>
            <h2 className="text-xl font-bold text-white">Cerrar Sesión</h2>
            <p className="text-gray-400 mt-2">¿Querés cerrar sesión?</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="btn-danger flex-1"
            >
              Cerrar Sesión
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default LogoutModal;
