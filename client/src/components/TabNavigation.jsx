import { useState, useEffect, useRef } from 'react';
import { VIEWS } from '../constants/index.js';

/**
 * Componente de navegación por menú desplegable
 * Esquina superior izquierda con botón hamburguer
 * @param {object} props
 * @param {string} props.currentView - Vista actual
 * @param {function} props.onNavigate - Función para cambiar de vista
 * @param {boolean} props.isAuthenticated - Si el usuario está autenticado
 * @param {boolean} props.isAdmin - Si el usuario es admin
 * @param {function} props.onLogoutClick - Callback para abrir modal de logout
 */
export function TabNavigation({ 
  currentView, 
  onNavigate, 
  isAuthenticated, 
  isAdmin,
  onLogoutClick
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  if (!isAuthenticated) return null;

  const tabs = [
    { id: VIEWS.DASHBOARD, label: 'Dashboard', icon: '🏠' },
    { id: VIEWS.GAMES, label: 'Juegos', icon: '🎮' },
    { id: VIEWS.STATS, label: 'Estadísticas', icon: '📊' },
  ];

  // Agregar tab Admin si es admin
  if (isAdmin) {
    tabs.push({ id: VIEWS.ADMIN, label: 'Admin', icon: '⚙️' });
  }

  // Cerrar menú al hacer click fuera (pero no en el botón hamburguer)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ignorar clicks en el botón hamburguer
      if (buttonRef.current && buttonRef.current.contains(event.target)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar menú al navegar
  const handleNavigate = (viewId) => {
    onNavigate(viewId);
    setIsOpen(false);
  };

  // Verificar si una vista está activa
  const isActive = (tabId) => {
    if (tabId === VIEWS.GAME) {
      return currentView === VIEWS.GAME_LOBBY || currentView === VIEWS.HIDDEN || 
             currentView === VIEWS.ENCOUNTER_RESULT || currentView === VIEWS.GAME_WINNER;
    }
    return currentView === tabId;
  };

  return (
    <>
      {/* Botón hamburguer - Esquina superior izquierda */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-800/80 backdrop-blur-sm border border-gray-700 hover:bg-gray-700 transition-colors"
        aria-label="Abrir menú"
      >
        <svg 
          className="w-6 h-6 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Menú desplegable */}
      {isOpen && (
        <div 
          ref={menuRef}
          className="fixed top-14 left-4 z-40 bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-700 shadow-2xl py-2 min-w-[180px] animate-fade-in"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleNavigate(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                isActive(tab.id)
                  ? 'text-amber-400 bg-amber-400/10'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
              {isActive(tab.id) && (
                <span className="ml-auto w-2 h-2 rounded-full bg-amber-400"></span>
              )}
            </button>
          ))}
          
          {/* Divisor */}
          <div className="my-2 border-t border-gray-700"></div>
          
          {/* Botón de logout */}
          <button
            onClick={() => {
              setIsOpen(false);
              onLogoutClick();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <span className="text-lg">🚪</span>
            <span className="font-medium">Salir</span>
          </button>
        </div>
      )}
    </>
  );
}

export default TabNavigation;
