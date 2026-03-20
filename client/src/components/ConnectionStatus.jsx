import { useState, useEffect } from 'react';
import { getSocket } from '../hooks/useSocket.js';

/**
 * Componente que muestra el estado de conexión al servidor
 * Indicador fijo en el header - solo punto verde cuando conectado
 */
export function ConnectionStatus() {
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [shownOnce, setShownOnce] = useState(false);
  
  useEffect(() => {
    const socket = getSocket();
    
    const handleConnect = () => {
      setConnected(true);
      setShownOnce(true);
    };
    const handleDisconnect = () => setConnected(false);
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Estado inicial
    if (socket.connected) {
      setConnected(true);
      setShownOnce(true);
    }
    
    // Leer roomId de sessionStorage
    const timesupRoom = sessionStorage.getItem('timesup_roomId');
    if (timesupRoom) {
      setRoomId(timesupRoom);
    }
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);
  
  // Escuchar cambios en sessionStorage
  useEffect(() => {
    const interval = setInterval(() => {
      const timesupRoom = sessionStorage.getItem('timesup_roomId');
      setRoomId(timesupRoom || '');
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Si ya se mostró conectado alguna vez y ahora está conectado, solo mostrar punto
  if (shownOnce && connected) {
    return (
      <div className="fixed top-4 right-4 z-50" title="Conectado">
        <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse block"></span>
      </div>
    );
  }
  
  // Mostrar indicador completo cuando está desconectado
  return (
    <div className={`fixed top-4 right-4 z-50 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${
      connected 
        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
    }`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
      {connected ? 'Conectado' : 'Desconectado'}
      {roomId && !connected && (
        <span className="text-xs opacity-75 ml-1">
          | Sala: {roomId}
        </span>
      )}
    </div>
  );
}

export default ConnectionStatus;
