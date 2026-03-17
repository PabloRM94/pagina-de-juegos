import { useState } from 'react';
import { Card } from '../components/index.js';
import { api, ENDPOINTS } from '../api/index.js';

/**
 * Vista de Cambio de Contraseña (sin email, directo)
 * @param {object} props
 * @param {function} props.onBackToLogin - Volver al login
 */
export function ResetPasswordView({ onBackToLogin }) {
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!username.trim()) {
      setError('Ingresa tu nombre de usuario');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    
    if (newPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await api.post(ENDPOINTS.RESET_PASSWORD_DIRECT, { 
        username: username.trim(),
        newPassword 
      });
      
      if (response.success) {
        setMessage('¡Contraseña cambiada exitosamente!');
        setTimeout(() => {
          onBackToLogin();
        }, 2000);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-2xl">
            <span className="text-5xl">🔐</span>
          </div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Cambiar Contraseña</h1>
          <p className="text-gray-400">Ingresá tus datos</p>
        </div>
        
        <Card>
          {!message ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Usuario</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Tu nombre de usuario"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Nueva Contraseña</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                  minLength={4}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Confirmar Contraseña</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  minLength={4}
                />
              </div>
              
              {error && (
                <p className="text-red-400 text-center mb-4 text-sm bg-red-500/10 p-3 rounded-lg">
                  {error}
                </p>
              )}
              
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading || !username.trim() || !newPassword || !confirmPassword}
              >
                {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-green-400 text-lg">{message}</p>
            </div>
          )}
          
          <button
            className="btn-secondary w-full mt-4"
            onClick={onBackToLogin}
            disabled={loading}
          >
            Volver al Login
          </button>
        </Card>
      </div>
    </div>
  );
}

export default ResetPasswordView;
