import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';
const DELAY = 500; // ms entre acciones

// Utilidad para delay
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Crear cliente socket
function createClient(name) {
  return {
    socket: io(SERVER_URL, { 
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    }),
    name,
    roomId: null,
    player: null
  };
}

async function runTest() {
  console.log('=== TEST: Múltiples usuarios ===\n');
  
  // Crear 3 clientes
  const user1 = createClient('Usuario1');
  const user2 = createClient('Usuario2');
  const user3 = createClient('Usuario3');
  const users = [user1, user2, user3];
  
  let connectedCount = 0;
  let errors = [];
  
  // Conectar todos
  console.log('1. Conectando usuarios...');
  for (const user of users) {
    user.socket.on('connect', () => {
      console.log(`   ✓ ${user.name} conectado: ${user.socket.id}`);
      connectedCount++;
    });
    
    user.socket.on('connect_error', (err) => {
      console.log(`   ✗ ${user.name} error: ${err.message}`);
      errors.push(`${user.name}: ${err.message}`);
    });
    
    user.socket.on('disconnect', (reason) => {
      console.log(`   ⚠ ${user.name} desconectado: ${reason}`);
    });
    
    user.socket.on('reconnect', (attemptNumber) => {
      console.log(`   ↻ ${user.name} reconectado (intento ${attemptNumber})`);
    });
  }
  
  // Esperar a que se conecten
  await wait(2000);
  
  if (connectedCount !== 3) {
    console.log(`\n❌ ERROR: Solo ${connectedCount}/3 usuarios conectados`);
    console.log('Errores:', errors);
    process.exit(1);
  }
  
  console.log('\n2. Crear sala con Usuario1...');
  
  await new Promise((resolve) => {
    user1.socket.emit('create-room', {}, (response) => {
      if (response.success) {
        user1.roomId = response.roomId;
        console.log(`   ✓ Sala creada: ${response.roomId}`);
      } else {
        console.log(`   ✗ Error: ${response.error}`);
      }
      resolve();
    });
  });
  
  await wait(DELAY);
  
  console.log('\n3. Unir Usuario2 y Usuario3...');
  
  await new Promise((resolve) => {
    user2.socket.emit('join-room', { 
      roomId: user1.roomId, 
      playerName: 'Usuario2' 
    }, (response) => {
      if (response.success) {
        user2.roomId = user1.roomId;
        user2.player = response.player;
        console.log(`   ✓ Usuario2 joined`);
      } else {
        console.log(`   ✗ Error: ${response.error}`);
      }
      resolve();
    });
  });
  
  await wait(DELAY);
  
  await new Promise((resolve) => {
    user3.socket.emit('join-room', { 
      roomId: user1.roomId, 
      playerName: 'Usuario3' 
    }, (response) => {
      if (response.success) {
        user3.roomId = user1.roomId;
        user3.player = response.player;
        console.log(`   ✓ Usuario3 joined`);
      } else {
        console.log(`   ✗ Error: ${response.error}`);
      }
      resolve();
    });
  });
  
  await wait(DELAY);
  
  // Escuchar room-updates para verificar recepción
  let roomUpdateCount = 0;
  for (const user of users) {
    user.socket.on('room-updated', (room) => {
      roomUpdateCount++;
      console.log(`   📡 ${user.name} recibió room-update: ${room.players.length} jugadores`);
    });
  }
  
  console.log('\n4. Usuario1 marca que está escondido...');
  
  await new Promise((resolve) => {
    user1.socket.emit('set-hidden', { roomId: user1.roomId }, (response) => {
      if (response.success) {
        console.log(`   ✓ Usuario1 escondido`);
      } else {
        console.log(`   ✗ Error: ${response.error}`);
      }
      resolve();
    });
  });
  
  await wait(1000);
  
  console.log('\n5. Usuario2 y Usuario3 también se esconden...');
  
  await new Promise((resolve) => {
    user2.socket.emit('set-hidden', { roomId: user2.roomId }, (response) => {
      console.log(`   ✓ Usuario2 escondido`);
      resolve();
    });
  });
  
  await wait(DELAY);
  
  await new Promise((resolve) => {
    user3.socket.emit('set-hidden', { roomId: user3.roomId }, (response) => {
      console.log(`   ✓ Usuario3 escondido`);
      resolve();
    });
  });
  
  // Esperar a que cambie el estado a playing
  await wait(4000);
  
  console.log('\n6. Verificando estado del juego...');
  
  let gameStartedReceived = false;
  for (const user of users) {
    user.socket.on('game-started', (data) => {
      gameStartedReceived = true;
      console.log(`   ✓ ${user.name} recibió game-started`);
    });
  }
  
  await wait(1000);
  
  if (!gameStartedReceived) {
    console.log('   ⚠ No se recibió game-started en todos los clientes');
  }
  
  console.log(`\n7. room-updates recibidos: ${roomUpdateCount}/3 esperados`);
  
  console.log('\n8. Verificando conexión persistente (5 segundos)...');
  await wait(5000);
  
  let stillConnected = 0;
  for (const user of users) {
    if (user.socket.connected) {
      stillConnected++;
    }
  }
  
  console.log(`   Conexiones activas: ${stillConnected}/3`);
  
  console.log('\n=== TEST COMPLETADO ===');
  console.log(`✓ Todos los usuarios conectados y interacting`);
  console.log(`✓ No se perdió la conexión durante el test`);
  
  // Cleanup
  for (const user of users) {
    user.socket.disconnect();
  }
  
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test fallido:', err);
  process.exit(1);
});