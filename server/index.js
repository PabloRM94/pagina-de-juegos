import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Rutas
import { authRoutes, tripRoutes, counterRoutes, turboRoutes } from './src/routes/index.js';

// Socket handlers
import { setupSocketHandlers } from './src/socket/index.js';

const app = express();

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Endpoint raíz
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Game server running' });
});

// Endpoint de debug para verificar base de datos
app.get('/debug/db', async (req, res) => {
  const useTurso = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;
  res.json({
    useTurso,
    database: useTurso ? 'Turso (libSQL)' : 'SQLite (local)',
    tursoUrl: process.env.TURSO_DATABASE_URL ? 'configurada' : 'no configurada',
    tursoToken: process.env.TURSO_AUTH_TOKEN ? 'configurada' : 'no configurada'
  });
});

// Endpoint de debug para probar escritura en DB
app.get('/debug/db-test', async (req, res) => {
  try {
    const dbType = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN ? 'Turso' : 'SQLite';
    
    // Intentar hacer un SELECT simple
    const users = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    
    res.json({
      success: true,
      database: dbType,
      userCount: users?.count || 0,
      message: `Conexión a ${dbType} funcionando correctamente`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Verificar que las tablas existan en la base de datos'
    });
  }
});

// Rutas API
app.use('/api', authRoutes);
app.use('/api', tripRoutes);
app.use('/api', counterRoutes);
app.use('/api', turboRoutes);

// Crear servidor HTTP
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3001",
      "https://pagina-de-juegos-mm2mba18g-pablorm94s-projects.vercel.app",
      "https://pagina-de-juegos-pywuqj9ng-pablorm94s-projects.vercel.app",
      "https://pagina-de-juegos.vercel.app",
      "*"
    ],
    methods: ["GET", "POST", "DELETE"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Guardar referencia a io en la app
app.set('io', io);

// Setup socket handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
