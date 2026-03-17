/**
 * Componente Avatar - Muestra un avatar de usuario
 * @param {string} src - URL de la imagen
 * @param {string} alt - Texto alternativo
 * @param {string} size - Tamaño: sm, md, lg, xl
 * @param {string} className - Clases adicionales
 */
export function Avatar({ src, alt, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  };
  
  return (
    <img
      src={src}
      alt={alt}
      className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/20 shadow-lg ${className}`}
    />
  );
}

export default Avatar;
