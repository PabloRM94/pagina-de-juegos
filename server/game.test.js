import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import { createServer } from 'http';

let httpServer;
let ioServer;
const clients = [];

const TEST_PORT = 3101;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

// Variables globales del servidor de pruebas
const rooms = new Map();
const ROLES = ['piedra', 'papel', 'tijera'];

// Configurar servidor de pruebas
const setupTestServer = () => {
  return new Promise((resolveServer) => {
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: '*' }
    });
    
    const assignRandomRole = () => ROLES[Math.floor(Math.random() * ROLES.length)];
    
    const resolveEncounter = (role1, role2) => {
      if (role1 === role2) return 'tie';
      const wins = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' };
      return wins[role1] === role2 ? 'player1' : 'player2';
    };
    
    ioServer.on('connection', (socket) => {
      socket.on('create-room', (data, callback) => {
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const room = {
          id: roomId,
          host: socket.id,
          players: [{
            id: socket.id,
            name: 'Host',
            isHidden: false,
            isAlive: true,
            eliminated: false
          }],
          state: 'lobby',
          roles: {},
          pendingEncounters: {}
        };
        rooms.set(roomId, room);
        socket.join(roomId);
        socket.roomId = roomId; // Guardar en el socket
        callback({ success: true, roomId, room });
      });

      socket.on('join-room', (data, callback) => {
        const { roomId, playerName } = data;
        const room = rooms.get(roomId.toUpperCase());
        if (!room) {
          callback({ success: false, error: 'Sala no encontrada' });
          return;
        }
        const player = {
          id: socket.id,
          name: playerName,
          isHidden: false,
          isAlive: true,
          eliminated: false
        };
        room.players.push(player);
        socket.join(roomId);
        socket.roomId = roomId;
        callback({ success: true, room, player });
        ioServer.to(roomId).emit('room-updated', room);
      });

      socket.on('set-hidden', (data, callback) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (!room) {
          callback({ success: false, error: 'Sala no encontrada' });
          return;
        }
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
          callback({ success: false, error: 'Jugador no encontrado' });
          return;
        }
        player.isHidden = true;
        
        const allHidden = room.players.every(p => p.isHidden);
        if (allHidden && room.state === 'lobby') {
          room.state = 'ready';
          room.players.forEach(p => {
            if (p.isAlive) room.roles[p.id] = assignRandomRole();
          });
          ioServer.to(roomId).emit('all-hidden', { room });
          setTimeout(() => {
            room.state = 'playing';
            ioServer.to(roomId).emit('game-started', { room });
            ioServer.to(roomId).emit('room-updated', room);
          }, 50);
        }
        callback({ success: true, room });
        ioServer.to(roomId).emit('room-updated', room);
      });

      socket.on('propose-encounter', (data, callback) => {
        const { roomId, opponentId } = data;
        const room = rooms.get(roomId);
        if (!room || room.state !== 'playing') {
          callback({ success: false, error: 'El juego no está activo' });
          return;
        }
        const player1 = room.players.find(p => p.id === socket.id);
        const player2 = room.players.find(p => p.id === opponentId);
        if (!player1 || !player2) {
          callback({ success: false, error: 'Jugador no encontrado' });
          return;
        }
        if (!player1.isAlive || !player2.isAlive) {
          callback({ success: false, error: 'Jugador eliminado' });
          return;
        }
        
        const encounterId = `${socket.id}-${opponentId}`;
        const reverseEncounterId = `${opponentId}-${socket.id}`;
        if (room.pendingEncounters[encounterId] || room.pendingEncounters[reverseEncounterId]) {
          callback({ success: false, error: 'Ya existe un encuentro pendiente' });
          return;
        }
        
        room.pendingEncounters[encounterId] = {
          player1Id: socket.id,
          player2Id: opponentId,
          confirmedBy: [socket.id],
          status: 'pending'
        };
        
        ioServer.to(roomId).emit('encounter-proposed', {
          encounterId,
          proposerId: socket.id,
          proposerName: player1.name,
          targetId: opponentId,
          targetName: player2.name
        });
        
        callback({ success: true, encounterId });
      });

      socket.on('confirm-encounter', (data, callback) => {
        const { roomId, encounterId } = data;
        const room = rooms.get(roomId);
        if (!room || room.state !== 'playing') {
          callback({ success: false, error: 'El juego no está activo' });
          return;
        }
        
        const encounter = room.pendingEncounters[encounterId];
        if (!encounter) {
          callback({ success: false, error: 'Encuentro no encontrado' });
          return;
        }
        
        if (encounter.confirmedBy.includes(socket.id)) {
          callback({ success: false, error: 'Ya has confirmado' });
          return;
        }
        
        encounter.confirmedBy.push(socket.id);
        
        const player1 = room.players.find(p => p.id === encounter.player1Id);
        const player2 = room.players.find(p => p.id === encounter.player2Id);
        
        const role1 = room.roles[player1.id];
        const role2 = room.roles[player2.id];
        
        const result = resolveEncounter(role1, role2);
        
        let winner = null, loser = null, eliminatedPlayerId = null;
        
        if (result === 'player1') {
          player2.eliminated = true;
          player2.isAlive = false;
          eliminatedPlayerId = player2.id;
          winner = player1;
          loser = player2;
        } else if (result === 'player2') {
          player1.eliminated = true;
          player1.isAlive = false;
          eliminatedPlayerId = player1.id;
          winner = player2;
          loser = player1;
        }
        
        const alivePlayers = room.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 1) {
          room.state = 'finished';
        }
        
        const encounterResult = {
          encounterId,
          player1: { id: player1.id, name: player1.name, role: role1 },
          player2: { id: player2.id, name: player2.name, role: role2 },
          result,
          winner: winner ? { id: winner.id, name: winner.name } : null,
          loser: loser ? { id: loser.id, name: loser.name } : null,
          eliminatedPlayerId,
          room
        };
        
        delete room.pendingEncounters[encounterId];
        
        callback({ success: true, encounterResult });
        ioServer.to(roomId).emit('encounter-resolved', encounterResult);
        ioServer.to(roomId).emit('room-updated', room);
      });
      
      socket.on('get-room', (data, callback) => {
        const { roomId } = data;
        const room = rooms.get(roomId.toUpperCase());
        if (!room) {
          callback({ success: false, error: 'Sala no encontrada' });
          return;
        }
        callback({ success: true, room });
      });
    });
    
    httpServer.listen(TEST_PORT, () => resolveServer());
  });
};

// Helpers
const createClient = () => {
  const client = io(SERVER_URL, { transports: ['websocket'] });
  clients.push(client);
  return new Promise((resolve) => {
    client.on('connect', () => resolve(client));
  });
};

const createRoom = (client) => {
  return new Promise((resolve) => {
    client.emit('create-room', {}, (res) => {
      resolve(res);
    });
  });
};

const joinRoom = (client, roomId, name) => {
  return new Promise((resolve) => {
    // Primero escuchar room-updated
    client.once('room-updated', () => {});
    client.emit('join-room', { roomId, playerName: name }, (res) => {
      resolve(res);
    });
  });
};

const setHidden = (client, roomId) => {
  return new Promise((resolve) => {
    client.emit('set-hidden', { roomId }, (res) => {
      resolve(res);
    });
  });
};

const proposeEncounter = (client, roomId, opponentId) => {
  return new Promise((resolve) => {
    client.emit('propose-encounter', { roomId, opponentId }, (res) => {
      resolve(res);
    });
  });
};

const confirmEncounter = (client, roomId, encounterId) => {
  return new Promise((resolve) => {
    client.emit('confirm-encounter', { roomId, encounterId }, (res) => {
      resolve(res);
    });
  });
};

// TESTS
describe('Game del Escondite', () => {
  beforeAll(async () => {
    await setupTestServer();
  }, 10000);

  afterEach(() => {
    // Limpiar clientes entre tests
    clients.forEach(c => c.disconnect());
    clients.length = 0;
    // Limpiar salas
    rooms.clear();
  });

  afterAll((done) => {
    ioServer.close();
    httpServer.close(done);
  });

  test('1. Crear sala', async () => {
    const client = await createClient();
    const result = await createRoom(client);
    
    expect(result.success).toBe(true);
    expect(result.roomId).toBeDefined();
    expect(result.room.state).toBe('lobby');
  });

  test('2. Unirse a sala', async () => {
    const client1 = await createClient();
    const roomResult = await createRoom(client1);
    const roomId = roomResult.roomId;
    console.log('Sala creada:', roomId, 'Jugadores:', roomResult.room.players.length);
    
    const client2 = await createClient();
    const joinResult = await joinRoom(client2, roomId, 'Player2');
    console.log('Jugador 2 se unió:', joinResult.success, 'Jugadores:', joinResult.room?.players?.length);
    
    expect(joinResult.success).toBe(true);
    expect(joinResult.room.players.length).toBe(2);
  });

  test('3. Esconderse y comenzar juego', async () => {
    const client1 = await createClient();
    const roomResult = await createRoom(client1);
    const roomId = roomResult.roomId;
    
    const client2 = await createClient();
    await joinRoom(client2, roomId, 'Player2');
    
    // Ambos se esconden
    await setHidden(client1, roomId);
    await setHidden(client2, roomId);
    
    // Esperar a que llegue el evento game-started
    await new Promise((resolve) => {
      client1.once('game-started', resolve);
    });
    
    // Obtener estado de la sala
    const getRoom = () => new Promise((resolve) => {
      client1.emit('get-room', { roomId }, resolve);
    });
    const result = await getRoom();
    
    expect(result.success).toBe(true);
    expect(result.room.state).toBe('playing');
    expect(result.room.roles[client1.id]).toBeDefined();
    expect(result.room.roles[client2.id]).toBeDefined();
  });

  test('4. Propuesta de encuentro', async () => {
    const client1 = await createClient();
    const roomResult = await createRoom(client1);
    const roomId = roomResult.roomId;
    
    const client2 = await createClient();
    await joinRoom(client2, roomId, 'Player2');
    
    // Ambos se esconden para iniciar juego
    await setHidden(client1, roomId);
    await setHidden(client2, roomId);
    
    // Esperar a que inicie el juego
    await new Promise(r => setTimeout(r, 100));
    
    // Cliente 1 propone encuentro
    const result = await proposeEncounter(client1, roomId, client2.id);
    
    expect(result.success).toBe(true);
    expect(result.encounterId).toContain(client1.id);
    expect(result.encounterId).toContain(client2.id);
  });

  test('5. Confirmar encuentro y resolución', async () => {
    const client1 = await createClient();
    const roomResult = await createRoom(client1);
    const roomId = roomResult.roomId;
    
    const client2 = await createClient();
    await joinRoom(client2, roomId, 'Player2');
    
    await setHidden(client1, roomId);
    await setHidden(client2, roomId);
    await new Promise(r => setTimeout(r, 100));
    
    // Cliente 1 propone
    const proposeResult = await proposeEncounter(client1, roomId, client2.id);
    const encounterId = proposeResult.encounterId;
    
    // Cliente 2 confirma
    const confirmResult = await confirmEncounter(client2, roomId, encounterId);
    
    expect(confirmResult.success).toBe(true);
    expect(confirmResult.encounterResult).toBeDefined();
    expect(confirmResult.encounterResult.result).toMatch(/tie|player1|player2/);
    
    // Verificar lógica de piedra-papel-tijera
    const { player1, player2, result } = confirmResult.encounterResult;
    if (player1.role === player2.role) {
      expect(result).toBe('tie');
    } else if (
      (player1.role === 'piedra' && player2.role === 'tijera') ||
      (player1.role === 'papel' && player2.role === 'piedra') ||
      (player1.role === 'tijera' && player2.role === 'papel')
    ) {
      expect(result).toBe('player1');
    } else {
      expect(result).toBe('player2');
    }
  });

  test('6. Eliminación de jugador', async () => {
    const client1 = await createClient();
    const roomResult = await createRoom(client1);
    const roomId = roomResult.roomId;
    
    const client2 = await createClient();
    await joinRoom(client2, roomId, 'Player2');
    
    await setHidden(client1, roomId);
    await setHidden(client2, roomId);
    await new Promise(r => setTimeout(r, 100));
    
    // Jugar hasta que alguien pierda (no sea empate), con límite de intentos
    let eliminatedId = null;
    let attempts = 0;
    while (!eliminatedId && attempts < 20) {
      const proposeResult = await proposeEncounter(client1, roomId, client2.id);
      const confirmResult = await confirmEncounter(client2, roomId, proposeResult.encounterId);
      
      if (confirmResult.encounterResult.eliminatedPlayerId) {
        eliminatedId = confirmResult.encounterResult.eliminatedPlayerId;
      }
      attempts++;
    }
    
    expect(eliminatedId).toBeDefined();
    expect([client1.id, client2.id]).toContain(eliminatedId);
  }, 15000);

  test('7. No se puede proponer encuentro si ya existe uno pendiente', async () => {
    const client1 = await createClient();
    const roomResult = await createRoom(client1);
    const roomId = roomResult.roomId;
    
    const client2 = await createClient();
    await joinRoom(client2, roomId, 'Player2');
    
    await setHidden(client1, roomId);
    await setHidden(client2, roomId);
    await new Promise(r => setTimeout(r, 100));
    
    // Cliente 1 propone encuentro
    await proposeEncounter(client1, roomId, client2.id);
    
    // Intentar proponer de nuevo (debería fallar)
    const result = await proposeEncounter(client1, roomId, client2.id);
    
    expect(result.success).toBe(false);
    expect(result.error.toLowerCase()).toContain('ya existe');
  });
});
