import React from 'react';

interface Player {
  id: string;
  name: string;
  score: number;
}

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
  gamePhase: string;
  showScores?: boolean;
  minPlayers?: number;
  isHost?: boolean;
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players, 
  currentPlayerId, 
  gamePhase, 
  showScores = true,
  minPlayers,
  isHost = false
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const playersNeeded = minPlayers ? Math.max(0, minPlayers - players.length) : 0;

  return (
    <div className="players-sidebar">
      <h3>Players {minPlayers && `(${players.length}/${minPlayers})`}</h3>
      <div className="players-list">
        {sortedPlayers.map((player) => (
          <div key={player.id} className="player-item">
            <span className="player-name">
              {player.name} 
              {player.id === currentPlayerId && ' (You)'}
              {isHost && player.id === players[0]?.id && ' (Host)'}
            </span>
            {showScores && gamePhase !== 'WAITING' && (
              <span className="player-score">{player.score} points</span>
            )}
          </div>
        ))}
      </div>
      {minPlayers && playersNeeded > 0 && (
        <div className="players-needed">
          Need {playersNeeded} more player{playersNeeded !== 1 ? 's' : ''} to start
        </div>
      )}
    </div>
  );
};

export default PlayerList;
