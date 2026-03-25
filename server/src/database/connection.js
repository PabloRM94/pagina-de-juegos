import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Wrapper para mantener compatibilidad con la API de better-sqlite3
 * pero usando @libsql/client para conexiones remotas
 */
class DbWrapper {
  constructor(client) {
    this.client = client;
  }

  prepare(sql) {
    const client = this.client;
    
    return {
      get: (...args) => this._execute(sql, args, 'get'),
      all: (...args) => this._execute(sql, args, 'all'),
      run: (...args) => this._execute(sql, args, 'run'),
    };
  }

  async _execute(sql, args, mode) {
    try {
      const result = await this.client.execute({
        sql: sql,
        args: args || []
      });

      if (mode === 'get') {
        return result.rows?.[0] || null;
      } else if (mode === 'all') {
        return result.rows || [];
      } else if (mode === 'run') {
        return {
          lastInsertRowid: Number(result.lastInsertRowid) || 0,
          changes: result.rowsAffected
        };
      }
      return result;
    } catch (error) {
      console.error('Database error:', error.message, 'SQL:', sql);
      throw error;
    }
  }

  exec(sql) {
    // Para statements múltiples (DDL)
    return this.client.executeMultiple(sql);
  }
}

// Debug: Mostrar variables de entorno disponibles
console.log('=== DATABASE CONFIG DEBUG ===');
console.log('TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? '✓ configurada' : '✗ NO configurada');
console.log('TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? '✓ configurada' : '✗ NO configurada');
console.log('================================');

// Determinar tipo de conexión según variables de entorno (con trim para evitar espacios)
const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
const useTurso = tursoUrl && tursoToken;

let db;

if (useTurso) {
  // Conexión a Turso (producción o desarrollo con credenciales)
  console.log('🔌 Conectando a Turso...');
  console.log('   URL:', tursoUrl);
  try {
    const client = createClient({
      url: tursoUrl,
      authToken: tursoToken
    });
    db = new DbWrapper(client);
    console.log('✅ Conexión a Turso establecida');
  } catch (err) {
    console.error('❌ Error conectando a Turso:', err.message);
    // Caer a SQLite local si Turso falla
    console.log('📁 Cayendo a base de datos local...');
    const dbPath = join(__dirname, 'trip.db');
    db = new Database(dbPath);
  }
} else {
  // Conexión local con better-sqlite3 (desarrollo offline)
  console.log('📁 Usando base de datos local...');
  const dbPath = join(__dirname, 'trip.db');
  db = new Database(dbPath);
}

/**
 * Inicializa las tablas de la base de datos
 */
export async function initDatabase() {
  // Agregar columna section si no existe (para bases de datos existentes)
  // Solo para better-sqlite3 local, Turso ya tiene la tabla creada
  if (!useTurso) {
    try {
      db.exec("ALTER TABLE checklist_items ADD COLUMN section TEXT DEFAULT ''");
    } catch (e) {
      // Columna ya existe o tabla no existe aún
    }
  }
  
  const createTablesSQL = `
    -- Tabla de usuarios
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      reset_token TEXT,
      reset_token_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Configuración del viaje
    CREATE TABLE IF NOT EXISTS trip_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      trip_started INTEGER DEFAULT 0,
      trip_ended INTEGER DEFAULT 0,
      admin_only INTEGER DEFAULT 0,
      guest_mode INTEGER DEFAULT 0,
      show_pwa_banner INTEGER DEFAULT 1
    );

    -- Contadores por día por usuario
    CREATE TABLE IF NOT EXISTS counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      cervezas INTEGER DEFAULT 0,
      banos_piscina INTEGER DEFAULT 0,
      agua_gas INTEGER DEFAULT 0,
      turbolatas INTEGER DEFAULT 0,
      custom_counters TEXT DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, date)
    );
    
    -- Tipos de contadores personalizados (definidos por admin)
    CREATE TABLE IF NOT EXISTS counter_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Historial de contadores para gráficos
    CREATE TABLE IF NOT EXISTS counter_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      counter_type TEXT NOT NULL,
      old_value INTEGER NOT NULL,
      new_value INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Lista de checks compartida
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      section TEXT DEFAULT '',
      completed INTEGER DEFAULT 0,
      completed_by INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (completed_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    
    -- Secciones del checklist (para agrupar items)
    CREATE TABLE IF NOT EXISTS checklist_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Estado del Turbo Lata
    CREATE TABLE IF NOT EXISTS turbo_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      active INTEGER DEFAULT 0,
      last_triggered DATETIME,
      current_target_user_id INTEGER,
      required_confirmations INTEGER DEFAULT 3,
      current_confirmations INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Confirmaciones de Turbo Lata
    CREATE TABLE IF NOT EXISTS turbo_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_user_id INTEGER NOT NULL,
      confirmed_by_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_user_id) REFERENCES users(id),
      FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id)
    );

    -- Inicializar configuración del viaje si no existe
    INSERT OR IGNORE INTO trip_config (id, start_date, end_date, trip_started, trip_ended)
    VALUES (1, '2026-03-27 19:00:00', '2026-03-29 23:59:59', 0, 0);

    -- Inicializar estado turbo si no existe
    INSERT OR IGNORE INTO turbo_state (id, active, last_triggered, current_target_user_id, required_confirmations, current_confirmations)
    VALUES (1, 0, NULL, NULL, 3, 0);
  `;

  if (useTurso) {
    // Para Turso, ejecutar cada statement individualmente
    console.log('📋 Creando tablas en Turso si no existen...');
    
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        reset_token TEXT,
        reset_token_expires DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS trip_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        trip_started INTEGER DEFAULT 0,
        trip_ended INTEGER DEFAULT 0,
        admin_only INTEGER DEFAULT 0,
        guest_mode INTEGER DEFAULT 0,
        show_pwa_banner INTEGER DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS counters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        cervezas INTEGER DEFAULT 0,
        banos_piscina INTEGER DEFAULT 0,
        agua_gas INTEGER DEFAULT 0,
        turbolatas INTEGER DEFAULT 0,
        custom_counters TEXT DEFAULT '{}',
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, date)
      )`,
      `CREATE TABLE IF NOT EXISTS counter_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS counter_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        counter_type TEXT NOT NULL,
        old_value INTEGER NOT NULL,
        new_value INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS checklist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        section TEXT DEFAULT '',
        completed INTEGER DEFAULT 0,
        completed_by INTEGER,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (completed_by) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS turbo_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active INTEGER DEFAULT 0,
        last_triggered DATETIME,
        current_target_user_id INTEGER,
        required_confirmations INTEGER DEFAULT 3,
        current_confirmations INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS turbo_confirmations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_user_id INTEGER NOT NULL,
        confirmed_by_user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_user_id) REFERENCES users(id),
        FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id)
      )`
    ];

    for (const sql of tables) {
      try {
        await db.prepare(sql).run();
        console.log('   ✓ Tabla creada');
      } catch (e) {
        // Tabla ya existe o error - continuar
        console.log('   - Tabla:', e.message.includes('already exists') ? 'ya existe' : 'error: ' + e.message);
      }
    }

    // Insertar datos iniciales
    try {
      await db.prepare('INSERT OR IGNORE INTO trip_config (id, start_date, end_date, trip_started, trip_ended) VALUES (1, ?, ?, 0, 0)').run('2026-03-27 19:00:00', '2026-03-29 23:59:59');
      console.log('   ✓ trip_config inicializado');
    } catch (e) { /* ignorar */ }
    
    try {
      await db.prepare('INSERT OR IGNORE INTO turbo_state (id, active, last_triggered, current_target_user_id, required_confirmations, current_confirmations) VALUES (1, 0, NULL, NULL, 3, 0)').run();
      console.log('   ✓ turbo_state inicializado');
    } catch (e) { /* ignorar */ }
    
    console.log('✅ Tablas creadas en Turso');
  } else {
    db.exec(createTablesSQL);
  }
}

// Inicializar automáticamente con await para asegurar que termine antes de recibir requests
initDatabase()
  .then(() => console.log('✅ Base de datos inicializada'))
  .catch(err => console.error('❌ Error inicializando base de datos:', err.message));

export default db;
