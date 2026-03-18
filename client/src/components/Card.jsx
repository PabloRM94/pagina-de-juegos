/**
 * Componente Card - Contenedor con estilo glassmorphism
 * @param {ReactNode} children - Contenido
 * @param {string} className - Clases adicionales
 */
export function Card({ children, className = '' }) {
  return (
    <div className={`glass-card p-6 ${className}`}>
      {children}
    </div>
  );
}

export default Card;
