import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'trip.db');
const db = new Database(dbPath);

/**
 * Inicializa las tablas de la base de datos
 */
export function initDatabase() {
  db.exec(`
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
      guest_mode INTEGER DEFAULT 0
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
  `);
}

// Inicializar automáticamente
initDatabase();

export default db;
