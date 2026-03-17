import { AVATAR_STYLES, getAvatarUrl } from '../constants/avatars.js';

/**
 * Componente AvatarSelector - Selector de estilo de avatar
 * @param {string} selectedStyle - Estilo seleccionado
 * @param {function} onSelect - Callback cuando se selecciona un estilo
 */
export function AvatarSelector({ selectedStyle, onSelect }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400">Estilo de avatar</p>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {AVATAR_STYLES.map(style => (
          <button
            key={style.id}
            onClick={() => onSelect(style.id)}
            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${
              selectedStyle === style.id
                ? 'ring-2 ring-indigo-500 scale-110'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <img
              src={getAvatarUrl(style.id, 'preview')}
              alt={style.name}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default AvatarSelector;
