import { useState, useEffect } from 'react';
import { getSocket } from '../hooks/useSocket.js';

/**
 * Componente que muestra el estado de conexión al servidor
 * Muestra un indicador visual de conexión/desconexión
 */
export function ConnectionStatus() {
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const socket = getSocket();
    
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Estado inicial
    setConnected(socket.connected);
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);
  
  return (
    <div className={`fixed top-4 right-4 z-50 px-3 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
      connected 
        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
    }`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
      {connected ? 'Conectado' : 'Desconectado'}
    </div>
  );
}

export default ConnectionStatus;
