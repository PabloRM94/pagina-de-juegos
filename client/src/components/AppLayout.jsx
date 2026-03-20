import { ConnectionStatus } from './ConnectionStatus.jsx';
import { TabNavigation } from './TabNavigation.jsx';

/**
 * Layout global de la aplicación
 * Incluye ConnectionStatus, contenido children, tabs y footer
 * @param {object} props
 * @param {React.ReactNode} props.children - Contenido principal
 * @param {string} props.currentView - Vista actual
 * @param {function} props.onNavigate - Función para navegar
 * @param {boolean} props.isAuthenticated - Si está autenticado
 * @param {boolean} props.showTabs - Si mostrar tabs de navegación
 * @param {boolean} props.isAdmin - Si el usuario es admin
 * @param {function} props.onLogoutClick - Callback para logout
 */
export function AppLayout({ 
  children, 
  currentView, 
  onNavigate, 
  isAuthenticated, 
  showTabs = true,
  isAdmin = false,
  onLogoutClick
}) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ConnectionStatus siempre visible */}
      <ConnectionStatus />
      
      {/* Contenido principal */}
      <main className="pb-20">
        {children}
      </main>
      
      {/* Navegación por tabs */}
      {showTabs && isAuthenticated && (
        <TabNavigation 
          currentView={currentView} 
          onNavigate={onNavigate}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          onLogoutClick={onLogoutClick}
        />
      )}
      
      {/* Footer fijo - más grande para mobile */}
      <footer 
        className="fixed bottom-0 left-0 right-0 py-5 text-center text-gray-400 text-sm bg-gray-900 border-t border-gray-800 z-30"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        © Hecho por Pabels con amor ❤️
      </footer>
    </div>
  );
}

export default AppLayout;
