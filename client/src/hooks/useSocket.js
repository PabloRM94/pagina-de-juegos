import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../constants/views.js';

// Singleton del socket
let socketInstance = null;

/**
 * Hook para gestionar la conexión Socket.IO
 * @param {function} onEventCallbacks - Objeto con callbacks para eventos { eventName: callback }
 * @returns {object} - { socket, connected }
 */
export function useSocket(onEventCallbacks = {}) {
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef(onEventCallbacks);
  
  // Actualizar callbacks sin re-crear el socket
  useEffect(() => {
    callbacksRef.current = onEventCallbacks;
  }, [onEventCallbacks]);
  
  useEffect(() => {
    // Crear socket si no existe
    if (!socketInstance) {
      socketInstance = io(SERVER_URL);
    }
    
    const socket = socketInstance;
    
    // Listener para conexión
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Estado inicial
    setConnected(socket.connected);
    
    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
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
    socketInstance = io(SERVER_URL);
  }
  return socketInstance;
};

export default useSocket;
