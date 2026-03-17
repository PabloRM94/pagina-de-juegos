import { useState } from 'react';
import {
  Card,
  Avatar,
  StatusBadge,
  AvatarSelector
} from '../components/index.js';
import { getAvatarSeed, getMyAvatarUrl, getPlayerAvatarUrl } from '../utils/avatar.js';
import { VIEWS } from '../constants/index.js';

// Helper para obtener emoji del rol
const getRoleEmoji = (role) => {
  switch (role) {
    case 'piedra': return '🪨';
    case 'papel': return '📄';
    case 'tijera': return '✂️';
    default: return '';
  }
};

// Helper para obtener nombre del rol
const getRoleName = (role) => {
  switch (role) {
    case 'piedra': return 'Piedra';
    case 'papel': return 'Papel';
    case 'tijera': return 'Tijera';
    default: return '';
  }
};

/**
 * Vista del Juego (Lobby y Juego)
 * @param {object} props
 * @param {string} props.view - Vista actual
 * @param {object} props.room - Sala actual
 * @param {object} props.player - Jugador actual
 * @param {object} props.currentPlayer - Jugador actual con estado actualizado
 * @param {object} props.aliveOpponents - Oponentes vivos
 * @param {object} props.pendingEncounters - Encuentros pendientes
 * @param {object} props.encounterDenied - Encuentro denegado
 * @param {string} props.selectedOpponent - Oponente seleccionado
 * @param {function} props.setSelectedOpponent - Setter de oponente seleccionado
 * @param {function} props.onBackToDashboard - Volver al dashboard
 * @param {function} props.onCreateRoom - Crear sala
 * @param {function} props.onJoinRoom - Unirse a sala
 * @param {function} props.onSetHidden - Marcarse escondido
 * @param {function} props.onProposeEncounter - Proponer encuentro
 * @param {function} props.onConfirmEncounter - Confirmar encuentro
 * @param {function} props.onDenyEncounter - Denegar encuentro
 * @param {function} props.onClearEncounterDenied - Limpiar encuentro denegado
 * @param {string} props.playerName - Nombre del jugador
 * @param {function} props.setPlayerName - Setter del nombre del jugador
 * @param {string} props.avatarStyle - Estilo de avatar
 * @param {function} props.setAvatarStyle - Setter de estilo de avatar
 * @param {string} props.avatarSeed - Seed de avatar
 * @param {function} props.setAvatarSeed - Setter de seed de avatar
 * @param {string} props.roomCode - Código de sala
 * @param {function} props.setRoomCode - Setter de código de sala
 */
export function GameView({
  view,
  room,
  player,
  currentPlayer,
  aliveOpponents,
  pendingEncounters,
  encounterDenied,
  selectedOpponent,
  setSelectedOpponent,
  onBackToDashboard,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSetHidden,
  onProposeEncounter,
  onConfirmEncounter,
  onDenyEncounter,
  onClearEncounterDenied,
  playerName,
  setPlayerName,
  avatarStyle,
  setAvatarStyle,
  avatarSeed,
  setAvatarSeed,
  roomCode,
  setRoomCode
}) {
  const isGameView = view === VIEWS.GAME || view === VIEWS.GAME_LOBBY || view === VIEWS.HIDDEN;
  
  if (!isGameView) return null;
  
  const showLobby = !player;
  const isEliminated = currentPlayer?.eliminated;
  
  return (
    <div className={`min-h-screen p-4 pb-24 ${isEliminated ? 'bg-red-900/30' : ''}`}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onBackToDashboard} className="btn-secondary">← Dashboard</button>
          <h1 className="text-xl font-bold text-white">Escondite</h1>
          <div className="w-16"></div>
        </div>
        
        {/* Lobby: Entry */}
        {showLobby && (
          <Card>
            <h3 className="text-white font-bold mb-4">Tu nombre en el juego</h3>
            <div className="flex items-center gap-4 mb-4">
              <Avatar src={getMyAvatarUrl(avatarStyle, avatarSeed)} alt="Tu avatar" size="lg" />
              <div className="flex-1">
                <input
                  type="text"
                  className="input-field mb-3"
                  placeholder="Tu nombre"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                />
                <AvatarSelector
                  selectedStyle={avatarStyle}
                  onSelect={setAvatarStyle}
                />
              </div>
            </div>
            <button
              className="btn-primary w-full mb-3"
              onClick={() => onCreateRoom(playerName, avatarStyle, getAvatarSeed(avatarSeed, playerName))}
            >
              Crear Sala
            </button>
            <div className="mt-4">
              <input
                type="text"
                className="input-field text-center"
                placeholder="Código sala"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
            <button
              className="btn-secondary w-full mt-2"
              onClick={() => onJoinRoom(roomCode, playerName, avatarStyle, getAvatarSeed(avatarSeed, playerName))}
            >
              Unirse
            </button>
            <button
              className="text-red-400 text-sm w-full mt-3 hover:text-red-300 transition-colors"
              onClick={() => {
                setPlayerName('');
                setRoomCode('');
                onLeaveRoom && onLeaveRoom();
              }}
            >
              Salir de la sala
            </button>
            </div>
          </Card>
        )}
        
        {/* Game: Playing */}
        {player && room && (
          <>
            {/* Info de sala y jugador */}
            <Card>
              <div className="text-center mb-4">
                <p className="text-gray-400">Sala</p>
                <div className="room-code-display">{room.id}</div>
              </div>
              <div className="flex items-center gap-4">
                <Avatar
                  src={getMyAvatarUrl(avatarStyle, getAvatarSeed(avatarSeed, playerName))}
                  alt="Tu avatar"
                  size="lg"
                />
                <div>
                  <h2 className="text-xl font-bold text-white">{player.name}</h2>
                  <StatusBadge status={currentPlayer?.isHidden ? 'hidden' : currentPlayer?.eliminated ? 'eliminated' : 'waiting'} />
                  {room?.roles?.[player?.id] && (
                    <p className="text-lg mt-1">
                      <span className="text-2xl">{getRoleEmoji(room.roles[player.id])}</span>
                      <span className="text-gray-400 text-sm ml-1">{getRoleName(room.roles[player.id])}</span>
                    </p>
                  )}
                  {isEliminated && (
                    <p className="text-red-400 text-sm font-bold mt-1">👁️ Espectador</p>
                  )}
                </div>
              </div>
              {isEliminated ? (
                <div className="mt-4 p-3 bg-red-500/20 rounded-lg text-center">
                  <p className="text-red-300">Has sido eliminado del juego</p>
                  <p className="text-gray-400 text-sm mt-1">Podés seguir viendo la partida</p>
                </div>
              ) : view !== VIEWS.HIDDEN && !currentPlayer?.isHidden && (
                <button className="btn-success mt-4 w-full" onClick={onSetHidden}>
                  ✓ Ya estoy escondido
                </button>
              )}
            </Card>
            
            {/* Encuentros pendientes: propuesta hacia mí - solo si no está eliminado */}
            {!isEliminated && Object.values(pendingEncounters).some(e => e.targetId === player?.id) && (
              <Card className="bg-amber-500/10 border-amber-500/30">
                <h3 className="text-amber-400 font-semibold mb-4">⚠️ Te han propuesto un encuentro</h3>
                {Object.values(pendingEncounters)
                  .filter(e => e.targetId === player?.id)
                  .map(enc => (
                    <div key={enc.encounterId} className="text-center">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <Avatar
                          src={getMyAvatarUrl(avatarStyle, getAvatarSeed(avatarSeed, playerName))}
                          alt="Vos"
                          size="md"
                        />
                        <span className="text-gray-400">vs</span>
                        <Avatar
                          src={getPlayerAvatarUrl(avatarStyle, enc.proposerName)}
                          alt={enc.proposerName}
                          size="md"
                        />
                      </div>
                      <button
                        className="btn-success w-full mb-2"
                        onClick={() => onConfirmEncounter(enc.encounterId)}
                      >
                        ✓ Confirmar
                      </button>
                      <button
                        className="btn-secondary w-full text-red-400"
                        onClick={() => onDenyEncounter(enc.encounterId)}
                      >
                        ✕ Denegar
                      </button>
                    </div>
                  ))}
              </Card>
            )}
            
            {/* Encuentro denegado */}
            {encounterDenied && (
              <Card className="bg-red-500/10 border-red-500/30">
                <div className="text-center">
                  <div className="text-4xl mb-4">🚫</div>
                  <h3 className="text-red-400 font-semibold mb-2">Encuentro Denegado</h3>
                  <p className="text-gray-300">{encounterDenied.deniedBy} ha denegado el encuentro</p>
                  <button className="btn-secondary mt-4" onClick={onClearEncounterDenied}>
                    Entendido
                  </button>
                </div>
              </Card>
            )}
            
            {/* Reportar encuentro - solo si no está eliminado */}
            {!isEliminated && !currentPlayer?.eliminated && Object.keys(pendingEncounters).length === 0 && (
              <Card>
                <h3 className="section-title">Reportar Encuentro</h3>
                <select
                  className="input-field-select mb-4"
                  value={selectedOpponent}
                  onChange={e => setSelectedOpponent(e.target.value)}
                >
                  <option value="">Seleccionar jugador</option>
                  {aliveOpponents.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  className="btn-warning w-full"
                  onClick={() => onProposeEncounter(selectedOpponent)}
                  disabled={!selectedOpponent}
                >
                  ✓ Proponer encuentro
                </button>
              </Card>
            )}
            
            {/* Lista de jugadores */}
            <Card>
              <h3 className="section-title">Jugadores ({room.players.length})</h3>
              <div className="space-y-2">
                {room.players.map(p => (
                  <div key={p.id} className="player-item">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={getPlayerAvatarUrl(avatarStyle, p.name)}
                        alt={p.name}
                        size="sm"
                      />
                      <span className="text-white font-medium">
                        {p.name} {p.id === player?.id && <span className="text-indigo-400">(vos)</span>}
                        {room?.roles?.[p.id] && (
                          <span className="ml-1 text-lg" title={getRoleName(room.roles[p.id])}>
                            {getRoleEmoji(room.roles[p.id])}
                          </span>
                        )}
                      </span>
                    </div>
                    <StatusBadge status={p.eliminated ? 'eliminated' : p.isHidden ? 'hidden' : 'waiting'} />
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default GameView;
