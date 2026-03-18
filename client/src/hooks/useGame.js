import { useState, useCallback, useEffect } from 'react';
import { getSocket } from './useSocket.js';

/**
 * Hook para gestionar el estado del juego de escondite
 * @param {string|null} token - Token de autenticación
 * @returns {object} - Estado y funciones del juego
 */
export function useGame(token) {
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [pendingEncounters, setPendingEncounters] = useState({});
  const [lastEncounter, setLastEncounter] = useState(null);
  const [encounterDenied, setEncounterDenied] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [allies, setAllies] = useState(new Set()); // Set de IDs de aliados
  const [gameFinished, setGameFinished] = useState(null); // Info de victoria del equipo
  
  const socket = getSocket();
  
  // Configurar listeners de socket
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomUpdated = (updatedRoom) => {
      setRoom(updatedRoom);
      // Actualizar el player actual
      const me = updatedRoom.players.find(p => p.id === player?.id);
      if (me) setPlayer(me);
    };
    
    const handleEncounterProposed = (data) => {
      setPendingEncounters(prev => ({
        ...prev,
        [data.encounterId]: data
      }));
    };
    
    const handleEncounterCancelled = (data) => {
      setPendingEncounters(prev => {
        const next = { ...prev };
        delete next[data.encounterId];
        return next;
      });
    };
    
    const handleEncounterResolved = (result) => {
      setLastEncounter(result);
      setPendingEncounters({});
      
      // Si el encuentro fue con un aliado, agregarlo a la lista
      if (result.isAlly && player) {
        const allyId = result.player1.id === player.id 
          ? result.player2.id 
          : result.player1.id;
        setAllies(prev => new Set([...prev, allyId]));
      }
    };
    
    const handleGameFinished = (data) => {
      setGameFinished(data);
    };
    
    const handleEncounterDenied = (data) => {
      console.log('Encuentro denegado recibido:', data);
      // Primero limpiar todos los pending encounters
      setPendingEncounters({});
      // Luego guardar la info de denegación
      setEncounterDenied(data);
    };
    
    socket.on('room-updated', handleRoomUpdated);
    socket.on('encounter-proposed', handleEncounterProposed);
    socket.on('encounter-cancelled', handleEncounterCancelled);
    socket.on('encounter-resolved', handleEncounterResolved);
    socket.on('encounter-denied', handleEncounterDenied);
    socket.on('game-finished', handleGameFinished);
    
    return () => {
      socket.off('room-updated', handleRoomUpdated);
      socket.off('encounter-proposed', handleEncounterProposed);
      socket.off('encounter-cancelled', handleEncounterCancelled);
      socket.off('encounter-resolved', handleEncounterResolved);
      socket.off('encounter-denied', handleEncounterDenied);
      socket.off('game-finished', handleGameFinished);
    };
  }, [socket, player]);
  
  /**
   * Crear una sala
   */
  const createRoom = useCallback((playerName, avatarStyle, avatarSeed) => {
    return new Promise((resolve) => {
      socket.emit('create-room', {}, (response) => {
        if (response.success) {
          // Unirse a la sala
          socket.emit('join-room', {
            roomId: response.roomId,
            playerName,
            avatarStyle,
            avatarSeed
          }, (joinResponse) => {
            if (joinResponse.success) {
              setRoom(joinResponse.room);
              setPlayer(joinResponse.player);
            }
            resolve(joinResponse);
          });
        } else {
          resolve(response);
        }
      });
    });
  }, [socket]);
  
  /**
   * Unirse a una sala
   */
  const joinRoom = useCallback((roomCode, playerName, avatarStyle, avatarSeed) => {
    return new Promise((resolve) => {
      socket.emit('join-room', {
        roomId: roomCode.toUpperCase(),
        playerName,
        avatarStyle,
        avatarSeed
      }, (response) => {
        if (response.success) {
          setRoom(response.room);
          setPlayer(response.player);
          
          // Detectar si se une tarde como espectador
          const joinedLate = response.room.state === 'playing';
          const hasEliminated = response.room.players?.some(p => p.eliminated);
          setIsSpectator(joinedLate && hasEliminated);
        }
        resolve(response);
      });
    });
  }, [socket]);
  
  /**
   * Marcarse como escondido
   */
  const setHidden = useCallback(() => {
    return new Promise((resolve) => {
      socket.emit('set-hidden', { roomId: room.id }, (response) => {
        if (response.success) {
          setRoom(response.room);
        }
        resolve(response);
      });
    });
  }, [socket, room]);
  
  /**
   * Proponer encuentro
   */
  const proposeEncounter = useCallback((opponentId) => {
    return new Promise((resolve) => {
      socket.emit('propose-encounter', {
        roomId: room.id,
        opponentId
      }, (response) => {
        if (response.success) {
          setSelectedOpponent('');
        }
        resolve(response);
      });
    });
  }, [socket, room]);
  
  /**
   * Confirmar encuentro
   */
  const confirmEncounter = useCallback((encounterId) => {
    return new Promise((resolve) => {
      socket.emit('confirm-encounter', {
        roomId: room.id,
        encounterId
      }, resolve);
    });
  }, [socket, room]);
  
  /**
   * Denegar encuentro
   */
  const denyEncounter = useCallback((encounterId) => {
    return new Promise((resolve) => {
      socket.emit('deny-encounter', {
        roomId: room.id,
        encounterId
      }, resolve);
    });
  }, [socket, room]);
  
  /**
   * Salir de la sala
   */
  const leaveRoom = useCallback(() => {
    return new Promise((resolve) => {
      socket.emit('leave-room', { roomId: room.id }, (response) => {
        setRoom(null);
        setPlayer(null);
        setPendingEncounters({});
        setSelectedOpponent('');
        setIsSpectator(false);
        setAllies(new Set());
        setGameFinished(null);
        resolve(response);
      });
    });
  }, [socket, room]);
  
  /**
   * Limpiar estado del juego
   */
  const clearGame = useCallback(() => {
    setRoom(null);
    setPlayer(null);
    setPendingEncounters({});
    setLastEncounter(null);
    setEncounterDenied(null);
    setSelectedOpponent('');
    setIsSpectator(false);
    setAllies(new Set());
    setGameFinished(null);
  }, []);
  
  // Utilidades
  const currentPlayer = room?.players?.find(p => p.id === player?.id);
  const aliveOpponents = room?.players?.filter(
    p => p.id !== player?.id && p.isAlive && !p.eliminated
  ) || [];
  
  return {
    room,
    player,
    currentPlayer,
    aliveOpponents,
    pendingEncounters,
    lastEncounter,
    encounterDenied,
    selectedOpponent,
    setSelectedOpponent,
    isSpectator,
    allies,
    gameFinished,
    createRoom,
    joinRoom,
    leaveRoom,
    setHidden,
    proposeEncounter,
    confirmEncounter,
    denyEncounter,
    clearGame,
    setLastEncounter,
    setEncounterDenied,
    setGameFinished
  };
}

export default useGame;
