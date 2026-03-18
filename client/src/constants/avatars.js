// Estilos de avatar disponibles
export const AVATAR_STYLES = [
  { id: 'adventurer', name: 'Aventurero' },
  { id: 'avataaars', name: 'Avatar' },
  { id: 'big-smile', name: 'Sonriente' },
  { id: 'micah', name: 'Micah' },
  { id: 'open-peeps', name: 'Minimalista' },
  { id: 'thumbs', name: 'Thumbnails' }
];

// Generar URL de avatar
export const getAvatarUrl = (style, seed) => 
  `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
