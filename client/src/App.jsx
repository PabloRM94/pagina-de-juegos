import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Conectar al servidor
const socket = io('http://localhost:3001');

function App() {
  const [view, setView] = useState('home'); // home, create, join, room
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [lastEncounter, setLastEncounter] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Escuchar actualizaciones de sala
    socket.on('room-updated', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    // Escuchar cuando todos están escondidos
    socket.on('all-hidden', (data) => {
      setRoom(data.room);
    });

    // Escuchar resultado de encuentro
    socket.on('encounter-resolved', (result) => {
      setLastEncounter(result);
    });

    return () => {
      socket.off('room-updated');
      socket.off('all-hidden');
      socket.off('encounter-resolved');
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }
    
    socket.emit('create-room', {}, (response) => {
      if (response.success) {
        // Unirse a la sala creada
        socket.emit('join-room', { 
          roomId: response.roomId, 
          playerName 
        }, (joinResponse) => {
          if (joinResponse.success) {
            setRoom(joinResponse.room);
            setPlayer(joinResponse.player);
            setView('room');
            setError('');
          }
        });
      } else {
        setError(response.error);
      }
    });
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) {
      setError('Ingresa tu nombre y el código de sala');
      return;
    }
    
    socket.emit('join-room', { 
      roomId: roomCode.trim().toUpperCase(), 
      playerName 
    }, (response) => {
      if (response.success) {
        setRoom(response.room);
        setPlayer(response.player);
        setView('room');
        setError('');
      } else {
        setError(response.error);
      }
    });
  };

  const setHidden = () => {
    if (!room) return;
    
    socket.emit('set-hidden', { roomId: room.id }, (response) => {
      if (response.success) {
        setRoom(response.room);
      } else {
        setError(response.error);
      }
    });
  };

  const reportEncounter = () => {
    if (!room || !selectedOpponent) return;
    
    socket.emit('report-encounter', { 
      roomId: room.id, 
      opponentId: selectedOpponent 
    }, (response) => {
      if (response.success) {
        setLastEncounter(response.encounterResult);
      } else {
        setError(response.error);
      }
    });
  };

  const getCurrentPlayer = () => {
    if (!room || !player) return null;
    return room.players.find(p => p.id === player.id);
  };

  const currentPlayer = getCurrentPlayer();
  const isGameActive = room?.state === 'hidden' || room?.state === 'playing';
  const myRole = room?.roles?.[player?.id];

  // VISTA: Home
  if (view === 'home') {
    return (
      <div className="container">
        <h1>🎭 Juego del Escondite</h1>
        
        <div className="card">
          <input
            type="text"
            className="input"
            placeholder="Tu nombre"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          
          <button className="btn" onClick={createRoom}>
            Crear Sala
          </button>
          
          <button className="btn" onClick={() => setView('join')}>
            Unirse a Sala
          </button>
        </div>
        
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // VISTA: Unirse
  if (view === 'join') {
    return (
      <div className="container">
        <h1>🎭 Unirse a Sala</h1>
        
        <div className="card">
          <input
            type="text"
            className="input"
            placeholder="Tu nombre"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          
          <input
            type="text"
            className="input"
            placeholder="Código de sala"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
          
          <button className="btn" onClick={joinRoom}>
            Unirse
          </button>
          
          <button className="btn" onClick={() => setView('home')}>
            Volver
          </button>
        </div>
        
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // VISTA: Sala
  return (
    <div className="container">
      <h1>🎭 Juego del Escondite</h1>
      
      <div className="card">
        <p className="text-center text-muted">Código de sala:</p>
        <div className="room-code">{room?.id}</div>
        
        {room?.state === 'waiting' && (
          <div className="game-status">
            Esperando que todos se escondan...
          </div>
        )}
        
        {room?.state === 'hidden' && (
          <div className="game-status" style={{ background: 'var(--success)' }}>
            ¡Todos escondidos! El juego comenzó
          </div>
        )}
        
        {room?.state === 'finished' && (
          <div className="game-status" style={{ background: 'var(--danger)' }}>
            Juego terminado
          </div>
        )}
      </div>

      {/* Estado del jugador */}
      <div className="card">
        <h3>Tu Estado</h3>
        <p className="text-center" style={{ marginTop: '10px' }}>
          <span className={`status ${currentPlayer?.isHidden ? 'hidden' : 'waiting'}`}>
            {currentPlayer?.isHidden ? 'Escondido' : 'Visible'}
          </span>
        </p>
        
        {currentPlayer?.eliminated && (
          <p className="text-center" style={{ marginTop: '10px', color: 'var(--danger)' }}>
            ¡Has sido eliminado!
          </p>
        )}
        
        {myRole && !currentPlayer?.eliminated && (
          <p className="text-center" style={{ marginTop: '10px' }}>
            Tu rol: <span className="role">{myRole.toUpperCase()}</span>
          </p>
        )}
        
        {!currentPlayer?.isHidden && !currentPlayer?.eliminated && room?.state === 'waiting' && (
          <button className="btn btn-success" onClick={setHidden}>
            Marcarse como Escondido
          </button>
        )}
      </div>

      {/* Lista de jugadores */}
      <div className="card">
        <h3>Jugadores ({room?.players?.length || 0})</h3>
        <ul className="player-list">
          {room?.players?.map((p) => (
            <li key={p.id} className="player-item">
              <span className="player-name">
                {p.name} {p.id === player?.id && '(tú)'}
              </span>
              <span>
                {p.eliminated ? (
                  <span className="status eliminated">Eliminado</span>
                ) : p.isHidden ? (
                  <span className="status hidden">Escondido</span>
                ) : (
                  <span className="status waiting">Visible</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sistema de encuentros */}
      {isGameActive && !currentPlayer?.eliminated && (
        <div className="card">
          <h3>Reportar Encuentro</h3>
          
          <div className="select-opponent">
            <label>¿Con quién te encontraste?</label>
            <select 
              className="input"
              value={selectedOpponent}
              onChange={(e) => setSelectedOpponent(e.target.value)}
            >
              <option value="">Seleccionar jugador</option>
              {room?.players
                .filter(p => p.id !== player?.id && p.isAlive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          
          <button 
            className="btn btn-warning" 
            onClick={reportEncounter}
            disabled={!selectedOpponent}
          >
            ¡Nos encontramos!
          </button>
        </div>
      )}

      {/* Resultado del último encuentro */}
      {lastEncounter && (
        <div className="card">
          <h3>Resultado del Encuentro</h3>
          <div className="encounter-result">
            <div className="roles-display">
              <div className="role-box">
                <p>{lastEncounter.player1.name}</p>
                <span className="role">{lastEncounter.player1.role.toUpperCase()}</span>
              </div>
              <div className="role-box">
                <p>{lastEncounter.player2.name}</p>
                <span className="role">{lastEncounter.player2.role.toUpperCase()}</span>
              </div>
            </div>
            
            {lastEncounter.result === 'tie' ? (
              <p className="tie">¡Empate! Ambos siguen jugando</p>
            ) : (
              <>
                <p className="winner">
                  ¡{lastEncounter.winner?.name} gana!
                </p>
                <p className="loser">
                  {lastEncounter.loser?.name} ha sido eliminado
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Jugadores restantes */}
      {room?.state === 'finished' && (
        <div className="card">
          <h3>Ganador</h3>
          <p className="text-center winner" style={{ fontSize: '24px', marginTop: '10px' }}>
            {room.players.find(p => p.isAlive)?.name || 'Empate'}
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      
      <button 
        className="btn" 
        onClick={() => {
          setView('home');
          setRoom(null);
          setPlayer(null);
        }}
        style={{ marginTop: '20px' }}
      >
        Salir de la Sala
      </button>
    </div>
  );
}

export default App;
