import express from 'express';
import cors from 'cors';
import { Server as WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

interface GameSession {
  id: string;
  password?: string;
  players: Set<WebSocket>;
}

const app = express();
const port = process.env.PORT || 3001;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store active game sessions
const sessions = new Map<string, GameSession>();

// REST endpoints
app.get('/', (req, res) => {
  res.json({ message: 'Game Server Running' });
});

app.post('/sessions', (req, res) => {
  const sessionId = uuidv4();
  const { password } = req.body;
  
  sessions.set(sessionId, {
    id: sessionId,
    password,
    players: new Set()
  });
  
  res.json({ sessionId });
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `ws://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const password = url.searchParams.get('password');

  if (!sessionId || !sessions.has(sessionId)) {
    ws.close(1008, 'Invalid session');
    return;
  }

  const session = sessions.get(sessionId)!;
  
  if (session.password && session.password !== password) {
    ws.close(1008, 'Invalid password');
    return;
  }

  session.players.add(ws);

  // Handle messages from the client
  ws.on('message', (message: string) => {
    // Broadcast message to all players in the session except sender
    session.players.forEach(player => {
      if (player !== ws && player.readyState === 1) {
        player.send(message);
      }
    });
  });

  // Handle client disconnect
  ws.on('close', () => {
    session.players.delete(ws);
    if (session.players.size === 0) {
      sessions.delete(sessionId);
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
