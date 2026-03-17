import { Card } from '../components/index.js';

/**
 * Vista de Registro
 * @param {object} props
 * @param {function} props.onRegister - Callback de registro
 * @param {function} props.onSwitchToLogin - Callback para ir a login
 * @param {boolean} props.loading - Estado de carga
 * @param {string} props.error - Mensaje de error
 * @param {string} props.username - Username actual
 * @param {function} props.setUsername - Setter de username
 * @param {string} props.password - Password actual
 * @param {function} props.setPassword - Setter de password
 */
export function RegisterView({ 
  onRegister, 
  onSwitchToLogin, 
  loading, 
  error,
  username,
  setUsername,
  password,
  setPassword
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-2xl">
            <span className="text-5xl">🏖️</span>
          </div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Viaje 2026</h1>
          <p className="text-gray-400">Creá tu cuenta</p>
        </div>
        
        <Card>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Nombre</label>
            <input
              type="text"
              className="input-field"
              placeholder="Tu nombre"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          
          {error && (
            <p className="text-red-400 text-center mb-4 text-sm bg-red-500/10 p-3 rounded-lg">
              {error}
            </p>
          )}
          
          <div className="space-y-3">
            <button
              className="btn-primary w-full"
              onClick={onRegister}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Registrarse'}
            </button>
            <button
              className="btn-secondary w-full"
              onClick={onSwitchToLogin}
            >
              ¿Ya tenés cuenta? Iniciá sesión
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default RegisterView;
