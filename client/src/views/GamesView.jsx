import { Card } from '../components/index.js';
import { VIEWS } from '../constants/index.js';

/**
 * Lista de juegos disponibles
 */
const GAMES = [
  {
    id: 'escondite',
    name: 'Escondite',
    icon: '🎭',
    description: 'Encuentra a tus amigos y ganá',
    view: VIEWS.GAME
  },
  {
    id: 'timesup',
    name: "Time's Up",
    icon: '⏱️',
    description: 'Adivina palabras en equipo (multijugador)',
    view: VIEWS.TIMESUP_LOBBY
  },
  {
    id: 'timesupnew',
    name: 'TimeUp New',
    icon: '🎯',
    description: 'Adivina palabras en un solo móvil',
    view: VIEWS.TIMESUP_NEW_LOBBY
  },
  {
    id: 'apuestas',
    name: 'Apuestas',
    icon: '🎯',
    description: 'Cronómetro de precisión',
    view: VIEWS.APUESTAS_LOBBY
  },
  {
    id: 'beerpong',
    name: 'BeerPong',
    icon: '🏆',
    description: 'Torneo de beerpong',
    view: VIEWS.BEERPONG_LOBBY
  }
];

/**
 * Vista de Juegos
 * Muestra tarjetas para acceder a los diferentes minijuegos
 * @param {object} props
 * @param {function} props.onNavigate - Función para navegar a un juego
 */
export function GamesView({ onNavigate }) {
  return (
    <div className="p-4 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-white">🎮 Juegos</h1>
          <p className="text-gray-400">Elegí un juego para jugar</p>
        </div>
        
        {/* Grid de juegos */}
        <div className="grid grid-cols-2 gap-4">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => onNavigate(game.view)}
              className="group bg-gray-800/50 border border-gray-700 hover:border-indigo-500/50 rounded-2xl p-6 text-center transition-all hover:bg-gray-800 hover:scale-105 active:scale-95"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">
                {game.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{game.name}</h3>
              <p className="text-gray-400 text-sm">{game.description}</p>
            </button>
          ))}
        </div>
        
        {/* Más juegos pronto */}
        <div className="text-center py-8">
          <p className="text-gray-500">Más juegos pronto... 🎉</p>
        </div>
      </div>
    </div>
  );
}

export default GamesView;
