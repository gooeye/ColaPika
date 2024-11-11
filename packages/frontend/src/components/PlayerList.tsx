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
}

const PlayerList: React.FC<PlayerListProps> = ({ players, currentPlayerId, gamePhase }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="players-sidebar">
      <h3>Players</h3>
      <div className="players-list">
        {sortedPlayers.map((player) => (
          <div key={player.id} className="player-item">
            <span className="player-name">
              {player.name} {player.id === currentPlayerId ? '(You)' : ''}
            </span>
            {gamePhase !== 'WAITING' && (
              <span className="player-score">{player.score} points</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerList;
