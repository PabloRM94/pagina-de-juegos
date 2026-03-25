import { useState, useEffect, useCallback } from 'react';
import { getSocket } from './hooks/useSocket.js';
import { useAuth } from './hooks/useAuth.js';
import { useCounters } from './hooks/useCounters.js';
import { useGame } from './hooks/useGame.js';
import { VIEWS } from './constants/index.js';
import { api, ENDPOINTS } from './api/index.js';

import {
  LoginView,
  RegisterView,
  WaitingView,
  DashboardView,
  ChecklistView,
  GamesView,
  AdminView,
  GameView,
  EncounterResultView,
  ResetPasswordView,
  StatsView,
  GameWinnerView,
  TimesUpLobbyView,
  TimesUpTeamNameView,
  TimesUpWordInputView,
  TimesUpPlayView,
  TimesUpRoundResultView,
  TimesUpFinalResultView,
  ApuestasLobbyView,
  ApuestasConfigView,
  ApuestasPlayView,
  ApuestasResultView,
  ApuestasFinalView
} from './views/index.js';

import { AppLayout, ConnectionStatus, LogoutModal } from './components/index.js';

export default function App() {
  // === Auth ===
  const { user, token, loading: authLoading, error: authError, login, register, logout, loginAsGuest, updateUser } = useAuth();
  
  // === Counters ===
  const { counters, users, updateCounter, refreshCounters, checklist, loadChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem, updateUserName } = useCounters(token);
  
  // === Trip Config ===
  const [tripConfig, setTripConfig] = useState(null);
  
  // === Turbo State ===
  const [turboState, setTurboState] = useState(null);
  
  // === Counter Types ===
  const [counterTypes, setCounterTypes] = useState([]);
  
  // === View State ===
  const [view, setView] = useState(VIEWS.LOGIN);
  
  // === Logout Modal ===
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // === Form State ===
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // === Game State ===
  const [avatarStyle, setAvatarStyle] = useState('adventurer');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  
  const {
    room,
    player,
    currentPlayer,
    aliveOpponents,
    pendingEncounters,
    lastEncounter,
    encounterDenied,
    selectedOpponent,
    setSelectedOpponent,
    createRoom,
    joinRoom,
    leaveRoom,
    setHidden,
    proposeEncounter,
    confirmEncounter,
    denyEncounter,
    setLastEncounter,
    setEncounterDenied,
    allies,
    gameFinished,
    setGameFinished
  } = useGame(token);
  
  // === Socket Connection ===
  const [socketConnected, setSocketConnected] = useState(false);
  
  // === Load Trip Config & Turbo ===
  useEffect(() => {
    if (!token) return;
    
    const loadInitialData = async () => {
      try {
        const [configRes, turboRes, counterTypesRes] = await Promise.all([
          api.get(ENDPOINTS.TRIP_CONFIG),
          api.get(ENDPOINTS.TURBO_STATE),
          api.get(ENDPOINTS.COUNTER_TYPES)
        ]);
        
        if (configRes.success) setTripConfig(configRes.config);
        if (turboRes.success) setTurboState(turboRes.turboState);
        if (counterTypesRes.success) setCounterTypes(counterTypesRes.counterTypes);
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    };
    
    loadInitialData();
  }, [token]);
  
  // === Load trip config even without token (for guest mode) ===
  useEffect(() => {
    const loadTripConfig = async () => {
      try {
        const configRes = await api.get(ENDPOINTS.TRIP_CONFIG);
        if (configRes.success) {
          setTripConfig(configRes.config);
        } else {
          // Fallback: enable guest mode by default if config fails
          setTripConfig({ guest_mode: 1, trip_started: true, admin_only: 0 });
        }
      } catch (err) {
        console.error('Error loading trip config:', err);
        // Fallback: enable guest mode by default if API fails
        setTripConfig({ guest_mode: 1, trip_started: true, admin_only: 0 });
      }
    };
    
    loadTripConfig();
  }, []);
  
  // === Socket Events ===
  useEffect(() => {
    const socket = getSocket();
    
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    
    const handleCountersUpdated = async () => {
      await refreshCounters();
    };
    
    const handleTurboStateChanged = (data) => {
      setTurboState(prev => ({ ...prev, active: data.active }));
    };
    
    const handleTurboTriggered = (data) => {
      setTurboState(prev => ({
        ...prev,
        current_target_user_id: data.targetUserId,
        current_confirmations: 0
      }));
    };
    
    const handleTurboConfirmations = (data) => {
      setTurboState(prev => ({
        ...prev,
        current_confirmations: data.currentConfirmations
      }));
    };
    
    const handleTurboCompleted = async () => {
      const [turboRes, countersRes] = await Promise.all([
        api.get(ENDPOINTS.TURBO_STATE),
        api.get(ENDPOINTS.COUNTERS)
      ]);
      
      if (turboRes.success) setTurboState(turboRes.turboState);
      if (countersRes.success) {
        const countersMap = {};
        countersRes.counters.forEach(c => countersMap[c.user_id] = c);
        // Actualizar el estado de contadores
        // Usamos la función de actualización de useCounters si está disponible
        if (countersRes.counters) {
          // Forzar actualización de contadores
          setTurboState(prev => ({ ...prev })); // Trigger re-render
        }
      }
      // Recargar contadores completa
      await refreshCounters();
    };
    
    const handleTurboCancelled = async () => {
      const turboRes = await api.get(ENDPOINTS.TURBO_STATE);
      if (turboRes.success) setTurboState(turboRes.turboState);
    };
    
    const handleChecklistUpdated = async () => {
      await loadChecklist();
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('counter-updated', handleCountersUpdated);
    socket.on('turbo-state-changed', handleTurboStateChanged);
    socket.on('turbo-triggered', handleTurboTriggered);
    socket.on('turbo-confirmation-updated', handleTurboConfirmations);
    socket.on('turbo-completed', handleTurboCompleted);
    socket.on('turbo-cancelled', handleTurboCancelled);
    socket.on('checklist-updated', handleChecklistUpdated);
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('counter-updated', handleCountersUpdated);
      socket.off('turbo-state-changed', handleTurboStateChanged);
      socket.off('turbo-triggered', handleTurboTriggered);
      socket.off('turbo-confirmation-updated', handleTurboConfirmations);
      socket.off('turbo-completed', handleTurboCompleted);
      socket.off('turbo-cancelled', handleTurboCancelled);
      socket.off('checklist-updated', handleChecklistUpdated);
    };
  }, [refreshCounters]);
  
  // === Handle session restored ===
  useEffect(() => {
    // Cuando termina de cargar y hay un token válido, redirigir al dashboard
    if (!authLoading && token && user) {
      if (view === VIEWS.LOGIN || view === VIEWS.REGISTER) {
        setView(VIEWS.DASHBOARD);
      }
    }
  }, [authLoading, token, user, view]);

  // === Handle game finished ===
  useEffect(() => {
    if (gameFinished && (view === VIEWS.GAME || view === VIEWS.ENCOUNTER_RESULT || view === VIEWS.GAME_LOBBY || view === VIEWS.HIDDEN)) {
      if (lastEncounter) {
        setView(VIEWS.ENCOUNTER_RESULT);
      } else {
        setView(VIEWS.GAME_WINNER);
      }
    }
  }, [gameFinished, lastEncounter, view]);

  // === Handlers ===
  const handleLogin = async () => {
    const result = await login(username, password);
    if (result.success) {
      setView(VIEWS.DASHBOARD);
    }
  };
  
  const handleRegister = async () => {
    const result = await register(username, password);
    if (result.success) {
      setView(VIEWS.DASHBOARD);
    }
  };
  
  const handleLoginAsGuest = async () => {
    const result = await loginAsGuest();
    if (result.success) {
      setView(VIEWS.GAMES);
    }
  };
  
  const handleLogout = () => {
    leaveRoom();
    logout();
    setView(VIEWS.LOGIN);
    setUsername('');
    setPassword('');
    setShowLogoutModal(false);
  };
  
  const handleUpdateCounter = async (userId, counterType, action) => {
    await updateCounter(userId, counterType, action);
  };
  
  const handleToggleTurbo = async (active) => {
    await api.post(ENDPOINTS.TURBO_TOGGLE, { active });
  };
  
  const handleTriggerTurbo = async () => {
    await api.post(ENDPOINTS.TURBO_TRIGGER);
  };
  
  const handleConfirmTurbo = async () => {
    await api.post(ENDPOINTS.TURBO_CONFIRM);
  };
  
  const handleCancelTurbo = async () => {
    await api.post(ENDPOINTS.TURBO_CANCEL);
  };
  
  const handleConfigTurbo = async (requiredConfirmations) => {
    const result = await api.post(ENDPOINTS.TURBO_CONFIG, { required_confirmations: requiredConfirmations });
    if (result.success) {
      setTurboState(result.turboState);
    }
  };
  
  const handleConfigUpdate = (config) => {
    setTripConfig(config);
  };
  
  const handleCreateCounterType = async (name, icon) => {
    const result = await api.post(ENDPOINTS.COUNTER_TYPES, { name, icon });
    if (result.success) {
      const typesRes = await api.get(ENDPOINTS.COUNTER_TYPES);
      if (typesRes.success) setCounterTypes(typesRes.counterTypes);
    }
    return result;
  };
  
  const handleDeleteCounterType = async (id) => {
    console.log('[Admin] Eliminando contador id:', id);
    const result = await api.delete(`${ENDPOINTS.COUNTER_TYPES}/${id}`);
    console.log('[Admin] Result delete:', result);
    if (result.success) {
      const typesRes = await api.get(ENDPOINTS.COUNTER_TYPES);
      console.log('[Admin] Reload counter types:', typesRes);
      if (typesRes.success) setCounterTypes(typesRes.counterTypes);
    }
    return result;
  };
  
  const handleUpdateCounterType = async (id, name, icon) => {
    console.log('[Admin] Actualizando contador id:', id, 'name:', name, 'icon:', icon);
    const result = await api.put(`${ENDPOINTS.COUNTER_TYPES}/${id}`, { name, icon });
    console.log('[Admin] Result update:', result);
    if (result.success) {
      const typesRes = await api.get(ENDPOINTS.COUNTER_TYPES);
      console.log('[Admin] Reload counter types:', typesRes);
      if (typesRes.success) setCounterTypes(typesRes.counterTypes);
    }
    return result;
  };
  
  const handleContinueFromEncounter = () => {
    setLastEncounter(null);
    if (gameFinished) {
      setView(VIEWS.GAME_WINNER);
    } else {
      setView(VIEWS.GAME);
    }
  };
  
  // === Reset Password Handler ===
  const handleForgotPassword = () => {
    setView(VIEWS.RESET_PASSWORD);
  };

  const handlePasswordResetComplete = () => {
    setView(VIEWS.LOGIN);
  };
  
  // === Can See Dashboard ===
  const canSeeDashboard = tripConfig?.trip_started && (
    tripConfig?.admin_only === 0 ||
    tripConfig?.admin_only === undefined ||
    user?.isAdmin
  );
  
  const isAdmin = user?.isAdmin === 1 || user?.isAdmin === true;
  
  // === Handle navigation from tabs ===
  const handleTabNavigate = (targetView) => {
    // Scroll to top en móvil para que el contenido siempre aparezca desde el inicio
    window.scrollTo(0, 0);
    
    if (room && targetView !== VIEWS.GAME && targetView !== VIEWS.GAME_LOBBY && targetView !== VIEWS.HIDDEN) {
      leaveRoom();
    }
    if (!gameFinished) {
      setGameFinished(null);
    }
    setView(targetView);
  };
  
  // === Handle navigation to game ===
  const handleNavigateToGame = () => {
    setView(VIEWS.GAME);
  };
  
  // === Handle back to dashboard from game ===
  const handleBackToDashboardFromGame = () => {
    leaveRoom();
    setGameFinished(null);
    setView(VIEWS.GAMES);
  };
  
  // === Render functions for different views ===
  
  // Mostrar spinner mientras carga la sesión restored
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando sesión...</div>
      </div>
    );
  }
  
  // Login / Register views (no layout, no tabs)
  if (view === VIEWS.LOGIN) {
    return (
      <>
        <ConnectionStatus />
        <LoginView
          onLogin={handleLogin}
          onSwitchToRegister={() => setView(VIEWS.REGISTER)}
          onForgotPassword={handleForgotPassword}
          loading={authLoading}
          error={authError}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          guestMode={tripConfig?.guest_mode === 1}
          onLoginAsGuest={handleLoginAsGuest}
          showPWABanner={false}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  if (view === VIEWS.REGISTER) {
    return (
      <>
        <ConnectionStatus />
        <RegisterView
          onRegister={handleRegister}
          onSwitchToLogin={() => setView(VIEWS.LOGIN)}
          loading={authLoading}
          error={authError}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Reset Password
  if (view === VIEWS.RESET_PASSWORD) {
    return (
      <>
        <ConnectionStatus />
        <ResetPasswordView
          onBackToLogin={() => setView(VIEWS.LOGIN)}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Waiting (countdown) - si no puede ver dashboard
  if (!canSeeDashboard || view === VIEWS.WAITING) {
    return (
      <AppLayout 
        currentView={view} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        showTabs={false}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <WaitingView
          tripConfig={tripConfig}
          user={user}
          onConfigUpdate={handleConfigUpdate}
          onNavigateToDashboard={() => setView(VIEWS.DASHBOARD)}
          onUpdateUserName={async (userId, newName) => {
            const result = await updateUserName(userId, newName);
            if (result.success) {
              updateUser({ name: newName });
            }
            return result;
          }}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Dashboard
  if (view === VIEWS.DASHBOARD) {
    return (
      <AppLayout 
        currentView={view} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <DashboardView
          user={user}
          counters={counters}
          users={users}
          counterTypes={counterTypes}
          onUpdateCounter={handleUpdateCounter}
          turboState={turboState}
          onToggleTurbo={handleToggleTurbo}
          onTriggerTurbo={handleTriggerTurbo}
          onConfirmTurbo={handleConfirmTurbo}
          onCancelTurbo={handleCancelTurbo}
          onUpdateUserName={async (userId, newName) => {
            const result = await updateUserName(userId, newName);
            if (result.success) {
              updateUser({ name: newName });
            }
            return result;
          }}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Games View
  if (view === VIEWS.GAMES) {
    return (
      <AppLayout 
        currentView={view} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <GamesView
          onNavigate={handleTabNavigate}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Checklist View
  if (view === VIEWS.CHECKLIST) {
    return (
      <AppLayout 
        currentView={view} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <ChecklistView
          tripConfig={tripConfig}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Stats View
  if (view === VIEWS.STATS) {
    return (
      <AppLayout 
        currentView={view} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <StatsView
          counters={counters}
          users={users}
          counterTypes={counterTypes}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Admin View
  if (view === VIEWS.ADMIN) {
    return (
      <AppLayout 
        currentView={view} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <AdminView
          user={user}
          users={users}
          counterTypes={counterTypes}
          tripConfig={tripConfig}
          turboState={turboState}
          onConfigUpdate={handleConfigUpdate}
          onToggleTurbo={handleToggleTurbo}
          onTriggerTurbo={handleTriggerTurbo}
          onCancelTurbo={handleCancelTurbo}
          onConfigTurbo={handleConfigTurbo}
          onCreateCounterType={handleCreateCounterType}
          onUpdateCounterType={handleUpdateCounterType}
          onDeleteCounterType={handleDeleteCounterType}
          onNavigateToWaiting={() => setView(VIEWS.WAITING)}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Game Winner (victoria del equipo)
  if (view === VIEWS.GAME_WINNER) {
    return (
      <AppLayout 
        currentView={VIEWS.GAMES} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <GameWinnerView
          gameFinished={gameFinished}
          currentPlayer={currentPlayer}
          onBackToDashboard={handleBackToDashboardFromGame}
          avatarStyle={avatarStyle}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Encounter Result
  if (view === VIEWS.ENCOUNTER_RESULT) {
    return (
      <AppLayout 
        currentView={VIEWS.GAMES} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
        showTabs={false}
      >
        <EncounterResultView
          encounter={lastEncounter}
          currentPlayer={currentPlayer}
          onContinue={handleContinueFromEncounter}
          avatarStyle={avatarStyle}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Game (Lobby and Playing)
  if (view === VIEWS.GAME || view === VIEWS.GAME_LOBBY || view === VIEWS.HIDDEN) {
    return (
      <AppLayout 
        currentView={view} 
        onNavigate={handleTabNavigate}
        isAuthenticated={!!token}
        isAdmin={isAdmin}
        onLogoutClick={() => setShowLogoutModal(true)}
      >
        <GameView
          view={view}
          room={room}
          player={player}
          currentPlayer={currentPlayer}
          aliveOpponents={aliveOpponents}
          pendingEncounters={pendingEncounters}
          encounterDenied={encounterDenied}
          selectedOpponent={selectedOpponent}
          setSelectedOpponent={setSelectedOpponent}
          onBackToDashboard={handleBackToDashboardFromGame}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onLeaveRoom={leaveRoom}
          onSetHidden={setHidden}
          onProposeEncounter={proposeEncounter}
          onConfirmEncounter={confirmEncounter}
          onDenyEncounter={denyEncounter}
          onClearEncounterDenied={() => setEncounterDenied(null)}
          playerName={playerName}
          setPlayerName={setPlayerName}
          avatarStyle={avatarStyle}
          setAvatarStyle={setAvatarStyle}
          avatarSeed={avatarSeed}
          setAvatarSeed={setAvatarSeed}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          allies={allies}
          gameFinished={gameFinished}
        />
        <LogoutModal 
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </AppLayout>
    );
  }
  
  // Time's Up - Lobby
  if (view === VIEWS.TIMESUP_LOBBY) {
    return (
      <>
        <ConnectionStatus />
        <TimesUpLobbyView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Time's Up - Team Names
  if (view === VIEWS.TIMESUP_TEAM_NAME) {
    return (
      <>
        <ConnectionStatus />
        <TimesUpTeamNameView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Time's Up - Word Input
  if (view === VIEWS.TIMESUP_WORD_INPUT) {
    return (
      <>
        <ConnectionStatus />
        <TimesUpWordInputView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Time's Up - Play
  if (view === VIEWS.TIMESUP_PLAY) {
    return (
      <>
        <ConnectionStatus />
        <TimesUpPlayView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Time's Up - Round Result
  if (view === VIEWS.TIMESUP_ROUND_RESULT) {
    return (
      <>
        <ConnectionStatus />
        <TimesUpRoundResultView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Time's Up - Final Result
  if (view === VIEWS.TIMESUP_FINAL_RESULT) {
    return (
      <>
        <ConnectionStatus />
        <TimesUpFinalResultView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }

  // Apuestas - Lobby
  if (view === VIEWS.APUESTAS_LOBBY) {
    return (
      <>
        <ConnectionStatus />
        <ApuestasLobbyView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }

  // Apuestas - Config
  if (view === VIEWS.APUESTAS_CONFIG) {
    return (
      <>
        <ConnectionStatus />
        <ApuestasConfigView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }

  // Apuestas - Play
  if (view === VIEWS.APUESTAS_PLAY) {
    return (
      <>
        <ConnectionStatus />
        <ApuestasPlayView
          onNavigate={handleTabNavigate}
        />
      </>
    );
  }

  // Apuestas - Result
  if (view === VIEWS.APUESTAS_RESULT) {
    return (
      <>
        <ConnectionStatus />
        <ApuestasResultView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }

  // Apuestas - Final
  if (view === VIEWS.APUESTAS_FINAL) {
    return (
      <>
        <ConnectionStatus />
        <ApuestasFinalView
          onNavigate={handleTabNavigate}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-400 text-xs bg-gray-900 border-t border-gray-800">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  return null;
}
