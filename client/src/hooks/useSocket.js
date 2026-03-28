import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../constants/views.js';

// Singleton del socket
let socketInstance = null;
let heartbeatInterval = null;
let reconnectInterval = null; // Interval para reintentar rejoin cada 3 segundos
let isRejoining = false; // Flag para evitar múltiples reintentos simultáneos

/**
 * Configuración de Socket.IO para mejor handling de background
 */
const SOCKET_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  pingInterval: 25000,
  pingTimeout: 20000,
};

/**
 * Hook para gestionar la conexión Socket.IO
 * @param {function} onEventCallbacks - Objeto con callbacks para eventos { eventName: callback }
 * @returns {object} - { socket, connected }
 */
export function useSocket(onEventCallbacks = {}) {
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef(onEventCallbacks);
  const isReconnecting = useRef(false);
  
  // Actualizar callbacks sin re-crear el socket
  useEffect(() => {
    callbacksRef.current = onEventCallbacks;
  }, [onEventCallbacks]);
  
  useEffect(() => {
    // Crear socket si no existe
    if (!socketInstance) {
      socketInstance = io(SERVER_URL, SOCKET_OPTIONS);
    }
    
    const socket = socketInstance;
    
    // Listener para conexión
    const handleConnect = () => {
      console.log('[useSocket] Conectado al servidor');
      setConnected(true);
      isReconnecting.current = false;
      
      // Detener intentos de rejoin automáticos
      stopRejoinAttempts();
      
      // Intentar re-join a sala si estaba en una
      attemptRejoinRoom(socket);
    };
    
    const handleDisconnect = (reason) => {
      console.log('[useSocket] Desconectado:', reason);
      setConnected(false);
      
      // Si la desconexión no fue intencional, iniciar intentos de rejoin cada 3 segundos
      if (reason !== 'io client disconnect') {
        isReconnecting.current = true;
        startRejoinAttempts(socket);
      }
    };
    
    const handleConnectError = (error) => {
      console.error('[useSocket] Error de conexión:', error);
    };
    
    const handleReconnect = (attemptNumber) => {
      console.log('[useSocket] Reconectando, intento:', attemptNumber);
    };
    
    const handleReconnectAttempt = (attemptNumber) => {
      console.log('[useSocket] Intentando reconectar, intento:', attemptNumber);
    };
    
    const handleReconnectFailed = () => {
      console.error('[useSocket] Reconexión fallida después de todos los intentos');
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_failed', handleReconnectFailed);
    
    // Estado inicial
    setConnected(socket.connected);
    
    // Iniciar heartbeat
    startHeartbeat(socket);
    
    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect_failed', handleReconnectFailed);
      stopHeartbeat();
      stopRejoinAttempts();
    };
  }, []);
  
  // Efecto separado para registrar callbacks
  useEffect(() => {
    const socket = socketInstance;
    if (!socket) return;
    
    const eventNames = Object.keys(callbacksRef.current);
    
    // Registrar callbacks
    eventNames.forEach(eventName => {
      socket.on(eventName, callbacksRef.current[eventName]);
    });
    
    // Cleanup de callbacks
    return () => {
      eventNames.forEach(eventName => {
        socket.off(eventName);
      });
    };
  }, []); // Solo se ejecuta una vez al montar
  
  /**
   * Emitir evento al servidor
   */
  const emit = useCallback((event, data, callback) => {
    if (socketInstance) {
      socketInstance.emit(event, data, callback);
    }
  }, []);
  
  return {
    socket: socketInstance,
    connected,
    emit
  };
}

/**
 * Obtener el socket singleton
 */
export const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(SERVER_URL, SOCKET_OPTIONS);
  }
  return socketInstance;
};

/**
 * Iniciar heartbeat para mantener conexión activa
 */
function startHeartbeat(socket) {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      // Enviar ping manualmente si es necesario
      // Socket.IO maneja ping/pong automáticamente, esto es para mantener activo el transport
      socket.emit('ping', {}, () => {
        // Pong recibido
      });
    }
  }, 30000); // Cada 30 segundos
}

/**
 * Detener heartbeat
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Iniciar intentos de rejoin cada 3 segundos cuando está desconectado
 */
function startRejoinAttempts(socket) {
  if (reconnectInterval) return; // Ya hay un intervalo activo
  
  // Verificar si hay sala guardada
  const roomId = sessionStorage.getItem('timesup_roomId') || 
                  sessionStorage.getItem('escondite_roomId') ||
                  sessionStorage.getItem('apuestas_roomId');
  
  if (!roomId) return;
  
  console.log('[useSocket] Iniciando intentos de rejoin cada 3 segundos...');
  
  reconnectInterval = setInterval(() => {
    if (socket.connected && !isRejoining) {
      isRejoining = true;
      console.log('[useSocket] Intentando rejoin...');
      
      attemptRejoinRoom(socket);
      
      // Resetear flag después de un momento
      setTimeout(() => {
        isRejoining = false;
      }, 2000);
    }
  }, 3000); // Cada 3 segundos
}

/**
 * Detener intentos de rejoin
 */
function stopRejoinAttempts() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
    console.log('[useSocket] Detenidos los intentos de rejoin');
  }
}

/**
 * Intentar re-join a una sala después de reconexión
 */
function attemptRejoinRoom(socket) {
  // Verificar si hay información de sala guardada
  const roomId = sessionStorage.getItem('timesup_roomId') || 
                  sessionStorage.getItem('escondite_roomId') ||
                  sessionStorage.getItem('apuestas_roomId');
  const playerId = sessionStorage.getItem('timesup_playerId') ||
                   sessionStorage.getItem('escondite_playerId');
  
  if (!roomId) return;
  
  console.log('[useSocket] Intentando re-join a sala:', roomId);
  
  // Determinar tipo de juego
  if (sessionStorage.getItem('timesup_roomId')) {
    // Time's Up
    socket.emit('timesup-rejoin', { roomId, playerId: socket.id }, (response) => {
      if (response.success) {
        console.log('[useSocket] Re-join exitoso a Time\'s Up:', roomId);
      } else {
        console.log('[useSocket] No se pudo re-join a Time\'s Up:', response.error);
      }
    });
  } else if (sessionStorage.getItem('escondite_roomId')) {
    // Escondite
    socket.emit('rejoin-room', { roomId }, (response) => {
      if (response.success) {
        console.log('[useSocket] Re-join exitoso a Escondite:', roomId);
      } else {
        console.log('[useSocket] No se pudo re-join a Escondite:', response.error);
      }
    });
  } else if (sessionStorage.getItem('apuestas_roomId')) {
    // Apuestas
    socket.emit('apuestas-rejoin', { roomId, playerId: socket.id }, (response) => {
      if (response.success) {
        console.log('[useSocket] Re-join exitoso a Apuestas:', roomId);
      } else {
        console.log('[useSocket] No se pudo re-join a Apuestas:', response.error);
      }
    });
  }
}

/**
 * Guardar info de sala para re-join después de reconexión
 */
export const saveRoomInfo = (gameType, roomId, playerId) => {
  const key = `${gameType}_roomId`;
  const playerKey = `${gameType}_playerId`;
  sessionStorage.setItem(key, roomId);
  if (playerId) {
    sessionStorage.setItem(playerKey, playerId);
  }
};

/**
 * Limpiar info de sala
 */
export const clearRoomInfo = (gameType) => {
  sessionStorage.removeItem(`${gameType}_roomId`);
  sessionStorage.removeItem(`${gameType}_playerId`);
};

export default useSocket;
