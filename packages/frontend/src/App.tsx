import React, { useState, useEffect, useRef, useCallback } from 'react';

function App() {
  const [sessionId, setSessionId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [gamePhase, setGamePhase] = useState<string>('WAITING');
  const [currentColor, setCurrentColor] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [descriptions, setDescriptions] = useState<{id: string, text: string}[]>([]);
  const [players, setPlayers] = useState<{id: string, name: string, score: number}[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const createSession = async () => {
    try {
      const response = await fetch('http://localhost:3001/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      setSessionId(data.sessionId);
      setIsHost(true);
      connectToSession(data.sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const connectToSession = (sid: string) => {
    const ws = new WebSocket(
      `ws://localhost:3001?sessionId=${sid}${password ? `&password=${password}` : ''}&playerName=${playerName}`
    );

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to session');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'JOIN':
          setCurrentPlayerId(message.payload.playerId);
          setPlayers(message.payload.players);
          break;
          
        case 'PLAYERS_UPDATE':
          setPlayers(message.payload.players);
          break;
          
        case 'STATE_UPDATE':
          if (message.payload.phase) setGamePhase(message.payload.phase);
          if (message.payload.color) setCurrentColor(message.payload.color);
          if (message.payload.timeRemaining) setTimeRemaining(message.payload.timeRemaining);
          if (message.payload.descriptions) setDescriptions(message.payload.descriptions);
          if (message.payload.scores) setPlayers(message.payload.scores);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from session');
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleSubmitDescription = useCallback(() => {
    if (wsRef.current && description) {
      wsRef.current.send(JSON.stringify({
        type: 'DESCRIPTION',
        payload: { description }
      }));
      setDescription('');
    }
  }, [description]);

  const handleVote = useCallback((descriptionId: string) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'VOTE',
        payload: { votedForId: descriptionId }
      }));
    }
  }, []);

  const startGame = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'START' }));
    }
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Color Description Game</h1>
      
      {!isConnected ? (
        <div>
          <div>
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Session ID (for joining)"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button onClick={createSession} disabled={!playerName}>Create New Session</button>
          <button onClick={() => connectToSession(sessionId)} disabled={!sessionId || !playerName}>
            Join Session
          </button>
        </div>
      ) : (
        <div>
          <h2>Session: {sessionId}</h2>
          <div>
            <h3>Players:</h3>
            {players.map(p => (
              <div key={p.id}>
                {p.name} {p.id === currentPlayerId ? '(You)' : ''}
              </div>
            ))}
          </div>
          
          {gamePhase === 'WAITING' && (
            <button onClick={startGame} disabled={players.length < 3}>
              Start Game (Need {Math.max(0, 3 - players.length)} more players)
            </button>
          )}
          
          {gamePhase === 'DESCRIBING' && (
            <div>
              <div style={{
                width: '200px',
                height: '200px',
                backgroundColor: currentColor,
                margin: '20px 0'
              }} />
              <div>Time remaining: {timeRemaining}s</div>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this color..."
              />
              <button onClick={handleSubmitDescription}>Submit Description</button>
            </div>
          )}
          
          {gamePhase === 'VOTING' && (
            <div>
              <div style={{
                width: '200px',
                height: '200px',
                backgroundColor: currentColor,
                margin: '20px 0'
              }} />
              <div>Time remaining: {timeRemaining}s</div>
              <h3>Vote for the best description:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {descriptions
                  .filter(d => d.id !== playerId)
                  .map((d) => (
                    <button 
                      key={d.id}
                      onClick={() => handleVote(d.id)}
                      style={{
                        padding: '10px',
                        fontSize: '16px',
                        cursor: 'pointer'
                      }}
                    >
                      {d.text}
                    </button>
                  ))}
              </div>
            </div>
          )}
          
          {gamePhase === 'RESULTS' && (
            <div>
              <h3>Final Scores:</h3>
              {players
                .sort((a, b) => b.score - a.score)
                .map((player, i) => (
                  <div key={player.id}>
                    {i + 1}. {player.name}: {player.score} points
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
