import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import PlayerList from './components/PlayerList';

function App() {
  const [sessionId, setSessionId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [gamePhase, setGamePhase] = useState<string>('WAITING');
  const [settings, setSettings] = useState<{
    numberOfColors: number, 
    timePerDescriptionRound: number,
    timePerVotingRound: number
  }>({
    numberOfColors: 5,
    timePerDescriptionRound: 30,
    timePerVotingRound: 15
  });
  const [currentColor, setCurrentColor] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [descriptions, setDescriptions] = useState<{id: string, text: string}[]>([]);
  const [players, setPlayers] = useState<{id: string, name: string, score: number, description?: string}[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [selectedDescriptionId, setSelectedDescriptionId] = useState<string>('');
  const [submittedVotes, setSubmittedVotes] = useState<{[color: string]: boolean}>({});
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
          if (message.payload.phase) {
            setGamePhase(message.payload.phase);
            // Reset selection when phase changes
            setSelectedDescriptionId('');
          }
          if (message.payload.color) {
            setCurrentColor(message.payload.color);
            // Reset selection when color changes
            setSelectedDescriptionId('');
          }
          if (message.payload.timeRemaining) setTimeRemaining(message.payload.timeRemaining);
          if (message.payload.descriptions) {
            setDescriptions(message.payload.descriptions);
            // Update players' description status
            setPlayers(prevPlayers => prevPlayers.map(player => ({
              ...player,
              description: message.payload.descriptions.find((d: {id: string}) => d.id === player.id)?.text
            })));
          }
          if (message.payload.scores) setPlayers(message.payload.scores);
          if (message.payload.settings) setSettings(message.payload.settings);
          break;
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      console.log('Disconnected from session');
      
      if (event.reason === 'Name already taken') {
        alert('That name is already taken in this session. Please choose a different name.');
        setPlayerName('');
      }
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
      // Update local state to show this player is done
      setPlayers(prevPlayers => prevPlayers.map(player => 
        player.id === currentPlayerId 
          ? { ...player, description: description }
          : player
      ));
      setDescription('');
    }
  }, [description, currentPlayerId]);

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
    <div className="game-container">
      {isConnected && (
        <div className="players-sidebar">
          <PlayerList 
            players={players}
            currentPlayerId={currentPlayerId}
            gamePhase={gamePhase}
            isHost={isHost}
          />
        </div>
      )}
      
      <div className="main-content">
        <h1 className="game-title">ColaPika</h1>
        
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
            {!window.location.search.includes('session=') && (
              <>
                <div>
                  <input
                    type="password"
                    placeholder="Password (optional)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button onClick={createSession} disabled={!playerName}>
                  Create New Session
                </button>
              </>
            )}
            {window.location.search.includes('session=') && (
              <button 
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  const sid = params.get('session');
                  const pwd = params.get('password');
                  if (sid) {
                    setSessionId(sid);
                    if (pwd) setPassword(pwd);
                    connectToSession(sid);
                  }
                }} 
                disabled={!playerName}
              >
                Join Session
              </button>
            )}
          </div>
      ) : (
        <div>
          <div className="session-id">Session ID: {sessionId}</div>
          {gamePhase === 'WAITING' && (
            <div>
              {isHost && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                  <h3>Game Settings</h3>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        Number of Colors:
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={settings.numberOfColors}
                          onChange={(e) => {
                            const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                            setSettings(prev => ({...prev, numberOfColors: value}));
                          }}
                          style={{ marginLeft: '10px' }}
                        />
                      </label>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        Time per Description Round (seconds):
                        <input
                          type="number"
                          min="10"
                          max="120"
                          value={settings.timePerDescriptionRound}
                          onChange={(e) => {
                            const value = Math.max(10, Math.min(120, parseInt(e.target.value) || 10));
                            setSettings(prev => ({...prev, timePerDescriptionRound: value}));
                          }}
                          style={{ marginLeft: '10px' }}
                        />
                      </label>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        Time per Voting Round (seconds):
                        <input
                          type="number"
                          min="10"
                          max="120"
                          value={settings.timePerVotingRound}
                          onChange={(e) => {
                            const value = Math.max(10, Math.min(120, parseInt(e.target.value) || 10));
                            setSettings(prev => ({...prev, timePerVotingRound: value}));
                          }}
                          style={{ marginLeft: '10px' }}
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => {
                        if (wsRef.current) {
                          wsRef.current.send(JSON.stringify({
                            type: 'UPDATE_SETTINGS',
                            payload: settings
                          }));
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Update Settings
                    </button>
                  </div>
                </div>
              )}
              {!isHost && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                  <h3>Current Settings</h3>
                  <p>Number of Colors: {settings.numberOfColors}</p>
                  <p>Time per Description Round: {settings.timePerDescriptionRound} seconds</p>
                  <p>Time per Voting Round: {settings.timePerVotingRound} seconds</p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                <button onClick={startGame} disabled={players.length < 3}>
                  Start Game (Need {Math.max(0, 3 - players.length)} more players)
                </button>
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('session', sessionId);
                    if (password) url.searchParams.set('password', password);
                    navigator.clipboard.writeText(url.toString());
                    alert('Share link copied to clipboard!');
                  }}
                >
                  Copy Share Link
                </button>
              </div>
            </div>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && description.trim()) {
                    handleSubmitDescription();
                  }
                }}
                placeholder="Describe this color..."
              />
              <button onClick={handleSubmitDescription}>Submit Description</button>
            </div>
          )}
          
          {(gamePhase === 'VOTING' || gamePhase === 'INTERMEDIATE_RESULTS') && (
            <div>
              {gamePhase === 'VOTING' && (
                <>
                  <div style={{
                    width: '200px',
                    height: '200px',
                    backgroundColor: currentColor,
                    margin: '20px 0'
                  }} />
                  <div>Time remaining: {timeRemaining}s</div>
                  
                  {descriptions.find(d => d.id === currentPlayerId) && (
                    <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                      <h4>Your Description:</h4>
                      <div>{descriptions.find(d => d.id === currentPlayerId)?.text}</div>
                    </div>
                  )}

                  <h3>Vote for the best description:</h3>
                  {submittedVotes[currentColor] ? (
                    <div>
                      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '5px', marginBottom: '20px' }}>
                        <strong>Your vote:</strong> {descriptions.find(d => d.id === selectedDescriptionId)?.text}
                      </div>
                      <div style={{ color: '#4CAF50', textAlign: 'center', padding: '20px' }}>
                        Vote submitted! Waiting for other players...
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {descriptions
                          .filter(d => d.id !== currentPlayerId)
                          .map((d) => (
                            <button 
                              key={d.id}
                              onClick={() => setSelectedDescriptionId(d.id)}
                              style={{
                                padding: '10px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                width: '100%',
                                backgroundColor: selectedDescriptionId === d.id ? '#e0e0e0' : 'white',
                                border: '1px solid #ccc',
                                borderRadius: '5px'
                              }}
                            >
                              {d.text}
                            </button>
                          ))}
                      </div>
                      <button 
                        onClick={() => {
                          if (selectedDescriptionId) {
                            handleVote(selectedDescriptionId);
                            setSubmittedVotes(prev => ({
                              ...prev,
                              [currentColor]: true
                            }));
                          }
                        }}
                        style={{
                          padding: '10px 20px',
                          fontSize: '16px',
                          backgroundColor: selectedDescriptionId ? '#4CAF50' : '#cccccc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: selectedDescriptionId ? 'pointer' : 'not-allowed',
                          width: '100%'
                        }}
                        disabled={!selectedDescriptionId || submittedVotes[currentColor]}
                      >
                        Confirm Vote
                      </button>
                    </>
                  )}
                </>
              )}
              
              {gamePhase === 'INTERMEDIATE_RESULTS' && (
                <div>
                  <PlayerList 
                    players={players}
                    currentPlayerId={currentPlayerId}
                    gamePhase={gamePhase}
                    showScores={true}
                  />
                  <button 
                    onClick={() => {
                      if (wsRef.current) {
                        wsRef.current.send(JSON.stringify({ type: 'NEXT_VOTE' }));
                      }
                    }}
                    style={{ marginTop: '20px' }}
                  >
                    Next Color
                  </button>
                </div>
              )}
            </div>
          )}
          
          {gamePhase === 'RESULTS' && (
            <div>
              <PlayerList 
                players={players}
                currentPlayerId={currentPlayerId}
                gamePhase={gamePhase}
                showScores={true}
              />
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
