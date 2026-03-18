import { VIEWS } from '../constants/index.js';

/**
 * Componente de navegación por tabs
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

  return (
    <nav className="fixed bottom-12 left-0 right-0 bg-gray-900 border-t border-gray-700 z-40">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = currentView === tab.id || 
            (tab.id === VIEWS.GAME && (currentView === VIEWS.GAME_LOBBY || currentView === VIEWS.HIDDEN || currentView === VIEWS.ENCOUNTER_RESULT || currentView === VIEWS.GAME_WINNER));
          
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center py-3 px-3 transition-colors ${
                isActive 
                  ? 'text-indigo-400 border-t-2 border-indigo-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-xl mb-0.5">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
        
        {/* Botón de logout */}
        <button
          onClick={onLogoutClick}
          className="flex flex-col items-center py-3 px-3 text-gray-400 hover:text-red-400 transition-colors"
          title="Cerrar sesión"
        >
          <span className="text-xl mb-0.5">🚪</span>
          <span className="text-xs font-medium">Salir</span>
        </button>
      </div>
    </nav>
  );
}

export default TabNavigation;
