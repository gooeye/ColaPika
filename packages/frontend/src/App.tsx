import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [sessionId, setSessionId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<string[]>([]);
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
      `ws://localhost:3001?sessionId=${sid}${password ? `&password=${password}` : ''}`
    );

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to session');
    };

    ws.onmessage = (event) => {
      setMessages(prev => [...prev, event.data]);
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

  return (
    <div style={{ padding: '20px' }}>
      <h1>Game Client</h1>
      
      {!isConnected ? (
        <div>
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
          <button onClick={createSession}>Create New Session</button>
          <button onClick={() => connectToSession(sessionId)} disabled={!sessionId}>
            Join Session
          </button>
        </div>
      ) : (
        <div>
          <h2>Connected to Session: {sessionId}</h2>
          <div>
            {messages.map((msg, index) => (
              <div key={index}>{msg}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
