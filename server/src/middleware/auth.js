import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'trip-secret-key-2026';

/**
 * Middleware para verificar el token JWT
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token requerido' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
}

/**
 * Genera un token JWT para un usuario
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export { JWT_SECRET };
export default { authenticateToken, generateToken, JWT_SECRET };
