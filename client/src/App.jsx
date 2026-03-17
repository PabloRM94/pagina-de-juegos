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
  GameView,
  EncounterResultView,
  ResetPasswordView
} from './views/index.js';

import { ConnectionStatus } from './components/index.js';

export default function App() {
  // === Auth ===
  const { user, token, loading: authLoading, error: authError, login, register, logout } = useAuth();
  
  // === Counters ===
  const { counters, users, updateCounter, refreshCounters } = useCounters(token);
  
  // === Trip Config ===
  const [tripConfig, setTripConfig] = useState(null);
  
  // === Turbo State ===
  const [turboState, setTurboState] = useState(null);
  
  // === View State ===
  const [view, setView] = useState(VIEWS.LOGIN);
  
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
    setEncounterDenied
  } = useGame(token);
  
  // === Socket Connection ===
  const [socketConnected, setSocketConnected] = useState(false);
  
  // === Load Trip Config & Turbo ===
  useEffect(() => {
    if (!token) return;
    
    const loadInitialData = async () => {
      try {
        const [configRes, turboRes] = await Promise.all([
          api.get(ENDPOINTS.TRIP_CONFIG),
          api.get(ENDPOINTS.TURBO_STATE)
        ]);
        
        if (configRes.success) setTripConfig(configRes.config);
        if (turboRes.success) setTurboState(turboRes.turboState);
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    };
    
    loadInitialData();
  }, [token]);
  
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
      }
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('counter-updated', handleCountersUpdated);
    socket.on('turbo-state-changed', handleTurboStateChanged);
    socket.on('turbo-triggered', handleTurboTriggered);
    socket.on('turbo-confirmation-updated', handleTurboConfirmations);
    socket.on('turbo-completed', handleTurboCompleted);
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('counter-updated', handleCountersUpdated);
      socket.off('turbo-state-changed', handleTurboStateChanged);
      socket.off('turbo-triggered', handleTurboTriggered);
      socket.off('turbo-confirmation-updated', handleTurboConfirmations);
      socket.off('turbo-completed', handleTurboCompleted);
    };
  }, [refreshCounters]);
  
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
  
  const handleLogout = () => {
    logout();
    setView(VIEWS.LOGIN);
    setUsername('');
    setPassword('');
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
  
  const handleConfigUpdate = (config) => {
    setTripConfig(config);
  };
  
  const handleContinueFromEncounter = () => {
    setLastEncounter(null);
    setView(VIEWS.GAME);
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
  
  // === Render ===
  
  // Login / Register
  if (view === VIEWS.LOGIN) {
    return (
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
      />
    );
  }
  
  if (view === VIEWS.REGISTER) {
    return (
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
    );
  }
  
  // Reset Password (simplified - username + new password + confirm)
  if (view === VIEWS.RESET_PASSWORD) {
    return (
      <ResetPasswordView
        onBackToLogin={() => setView(VIEWS.LOGIN)}
      />
    );
  }

  // Waiting (countdown) - solo si admin quiere verla
  if (view === VIEWS.WAITING) {
    return (
      <>
        <ConnectionStatus />
        <WaitingView
          tripConfig={tripConfig}
          user={user}
          onConfigUpdate={handleConfigUpdate}
          onNavigateToDashboard={() => setView(VIEWS.DASHBOARD)}
        />
      </>
    );
  }
  
  // Waiting (countdown) - si no puede ver dashboard
  if (!canSeeDashboard) {
    return (
      <>
        <ConnectionStatus />
        <WaitingView
          tripConfig={tripConfig}
          user={user}
          onConfigUpdate={handleConfigUpdate}
          onNavigateToDashboard={() => setView(VIEWS.DASHBOARD)}
        />
      </>
    );
  }
  
  // Dashboard
  if (view === VIEWS.DASHBOARD) {
    return (
      <>
        <ConnectionStatus />
        <DashboardView
          user={user}
          tripConfig={tripConfig}
          onLogout={handleLogout}
          onNavigateToGame={() => setView(VIEWS.GAME)}
          onNavigateToWaiting={() => setView(VIEWS.WAITING)}
          counters={counters}
          users={users}
          onUpdateCounter={handleUpdateCounter}
          turboState={turboState}
          onToggleTurbo={handleToggleTurbo}
          onTriggerTurbo={handleTriggerTurbo}
          onConfirmTurbo={handleConfirmTurbo}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-500 text-xs bg-gray-900/80">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Game
  if (view === VIEWS.GAME || view === VIEWS.GAME_LOBBY || view === VIEWS.HIDDEN) {
    return (
      <>
        <ConnectionStatus />
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
          onBackToDashboard={() => setView(VIEWS.DASHBOARD)}
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
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-500 text-xs bg-gray-900/80">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  // Encounter Result
  if (view === VIEWS.ENCOUNTER_RESULT) {
    return (
      <>
        <ConnectionStatus />
        <EncounterResultView
          encounter={lastEncounter}
          currentPlayer={currentPlayer}
          onContinue={handleContinueFromEncounter}
          avatarStyle={avatarStyle}
        />
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-gray-500 text-xs bg-gray-900/80">
          © Hecho por Pabels con amor ❤️
        </footer>
      </>
    );
  }
  
  return null;
}
