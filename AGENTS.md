# AGENTS.md - Agentes de Codificación

Este archivo establece las convenciones y comandos para agentes que operan en este repositorio.

## Estructura del Proyecto

```
pagina-de-juegos/
├── client/           # Frontend React + Vite
│   ├── src/
│   │   ├── api/      # Cliente API
│   │   ├── components/   # Componentes React
│   │   ├── constants/    # Constantes
│   │   ├── hooks/        # Custom hooks (useAuth, useGame, etc.)
│   │   ├── views/        # Vistas de página completa
│   │   └── utils/         # Utilidades
│   └── package.json
├── server/           # Backend Express + Socket.io
│   ├── src/
│   │   ├── database/  # Conexión a BD
│   │   ├── middleware/ # Auth middleware
│   │   ├── routes/    # Rutas API REST
│   │   ├── services/  # Lógica de negocio
│   │   └── socket/    # Handlers de Socket.io
│   └── package.json
└── package.json      # Scripts raíz
```

## Comandos de Build, Lint y Test

### General

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia both server (3001) + client (5173) |
| `npm run server` | Solo server en puerto 3001 |
| `npm run client` | Solo client en puerto 5173 |

### Server

| Comando | Descripción |
|---------|-------------|
| `cd server && npm start` | Inicia server (production) |
| `cd server && npm run dev` | Inicia server con watch mode |
| `cd server && npm test` | **Ejecuta todos los tests** |
| `cd server && npm test -- --testNamePattern="test name"` | **Ejecuta un solo test por nombre** |
| `cd server && npm test -- --testPathPattern=game.test` | Ejecuta un archivo específico |

### Client

| Comando | Descripción |
|---------|-------------|
| `cd client && npm run dev` | Dev server con HMR |
| `cd client && npm run build` | Build para producción |
| `cd client && npm run preview` | Preview del build |

## Convenciones de Código

### Imports

- **Extensión `.js` requerida** en imports locales: `import db from '../database/connection.js'`
- Imports de barrel files: `import { api, ENDPOINTS } from './api/index.js'`
- Orden sugerido: externos → relative → internos

### Formato

- **2 espacios** de indentación
- No hay ESLint/Prettier configurado - mantener consistencia manual
- Líneas max ~100 caracteres cuando sea posible

### Tipos

- **No TypeScript** - JavaScript vanilla
- Usar JSDoc para documentar funciones importantes:
  ```js
  /**
   * @param {string} username
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  ```

### Nombres

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Variables/funciones | camelCase | `handleLogin`, `userData` |
| Componentes React | PascalCase | `LoginView`, `CounterCard` |
| Constantes | SCREAMING_SNAKE | `VIEWS.LOGIN`, `ROLES` |
| Archivos | kebab-case | `game-engine.js`, `use-auth.js` |
| Hooks | `useX` | `useAuth`, `useGame` |

### Manejo de Errores

- **Formato consistente** para respuestas de error:
  ```js
  res.status(400).json({ success: false, error: 'Mensaje en español' })
  ```
- try/catch en todas las rutas async:
  ```js
  router.post('/endpoint', async (req, res) => {
    try {
      // lógica
    } catch (error) {
      console.error('Error en endpoint:', error);
      res.status(500).json({ success: false, error: 'Error en el servidor' });
    }
  });
  ```

### Patterns React

- **Export default** en componentes: `export default function LoginView() {}`
- **Barrel exports** en `index.js` para imports limpios
- **Custom hooks** encapsulan lógica de estado/side effects
- useEffect con cleanup para event listeners de socket

### API Responses

Formato estándar (usar siempre):
```js
// Éxito
res.json({ success: true, data: ... })

// Error
res.status(400).json({ success: false, error: 'Mensaje' })
```

### Base de Datos (Server)

- **better-sqlite3** para SQLite local
- **@libsql/client** para Turso (production)
- Preparar statements: `db.prepare('SELECT * FROM users WHERE id = ?')`
- Convertir BigInt de Turso: `Number(result.lastInsertRowid)`

### Socket.io Events

- Usar callbacks para respuestas sincronas: `socket.emit('event', data, callback)`
- Eventos del servidor: `room-updated`, `game-started`, `encounter-resolved`, etc.
- Limpiar listeners en cleanup de useEffect

### Testing (Server)

- **Jest** con `--experimental-vm-modules`
- Tests de integración con socket.io-client
- Puerto de test: 3101
- Pattern de test:
  ```js
  test('1. Descripción del test', async () => {
    // arrange
    const client = await createClient();
    // act
    const result = await createRoom(client);
    // assert
    expect(result.success).toBe(true);
  });
  ```

### Git Conventions

- Commits en español o inglés consistente
- Conventional commits si aplica: `feat:`, `fix:`, `refactor:`
- **NO** Co-Authored-By para atribución de IA

## Notas Importantes

1. **Puerto Server**: 3001 (no 3000)
2. **Puerto Client**: 5173
3. **Proxy**: Client tiene proxy configurado hacia server para desarrollo
4. **Test DB**: Los tests crean su propio servidor en puerto 3101
5. **Admin hardcoded**: Usuario "Domingoadmin" se crea como admin automáticamente
6. **Guest mode**: Controlado por config en tabla `trip_config`

## Archivos de Referencia

- Server entry: `server/index.js`
- Client entry: `client/src/main.jsx`
- Routes: `server/src/routes/`
- Socket handlers: `server/src/socket/`
- React components: `client/src/components/`
- Views: `client/src/views/`
- Hooks: `client/src/hooks/`
