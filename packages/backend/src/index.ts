import express from 'express';
import cors from 'cors';
import { Server as WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

import { Player, GameState, GameSettings, GameMessage } from './types';

interface GameSession {
  id: string;
  password?: string;
  players: Map<string, Player>;
  gameState?: GameState;
  settings: GameSettings;
  timer?: NodeJS.Timeout;
}

const DEFAULT_SETTINGS: GameSettings = {
  numberOfColors: 5,
  timePerDescriptionRound: 30,
  timePerVotingRound: 15
};

function generateRandomColor(): string {
  return '#' + Math.floor(Math.random()*16777215).toString(16);
}

function broadcastToSession(session: GameSession, message: GameMessage) {
  session.players.forEach(player => {
    if (player.ws.readyState === 1) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

const app = express();
const port = process.env.PORT || 3001;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store active game sessions
const sessions = new Map<string, GameSession>();

app.get('/', (req, res) => {
  res.json({ message: 'Game Server Running' });
});

app.post('/sessions', (req, res) => {
  const sessionId = uuidv4();
  const { password, settings } = req.body;
  
  sessions.set(sessionId, {
    id: sessionId,
    password,
    players: new Map(),
    settings: { ...DEFAULT_SETTINGS, ...settings }
  });
  
  res.json({ sessionId });
});

function startNewRound(session: GameSession) {
  const colors = Array(session.settings.numberOfColors)
    .fill(0)
    .map(() => generateRandomColor());
    
  session.gameState = {
    currentPhase: 'DESCRIBING',
    colors,
    currentColorIndex: 0,
    descriptions: new Map(),
    votes: new Map(),
    timeRemaining: session.settings.timePerDescriptionRound
  };

  broadcastToSession(session, {
    type: 'STATE_UPDATE',
    payload: {
      phase: session.gameState.currentPhase,
      color: colors[0],
      timeRemaining: session.settings.timePerRound
    }
  });

  session.timer = setInterval(() => {
    if (session.gameState) {
      session.gameState.timeRemaining--;
      
      if (session.gameState.timeRemaining <= 0) {
        advanceGameState(session);
      } else {
        broadcastToSession(session, {
          type: 'STATE_UPDATE',
          payload: { timeRemaining: session.gameState.timeRemaining }
        });
      }
    }
  }, 1000);
}

function advanceGameState(session: GameSession) {
  if (!session.gameState) return;
  
  clearInterval(session.timer);
  
  if (session.gameState.currentPhase === 'DESCRIBING') {
    if (session.gameState.currentColorIndex < session.gameState.colors.length - 1) {
      // Reset all players' description status
      session.players.forEach(player => {
        player.description = undefined;
      });
        
      session.gameState.currentColorIndex++;
      session.gameState.timeRemaining = session.settings.timePerDescriptionRound;
      
      broadcastToSession(session, {
        type: 'STATE_UPDATE',
        payload: {
          color: session.gameState.colors[session.gameState.currentColorIndex],
          timeRemaining: session.settings.timePerRound
        }
      });
      
      session.timer = setInterval(() => {
        if (session.gameState) {
          session.gameState.timeRemaining--;
          
          broadcastToSession(session, {
            type: 'STATE_UPDATE',
            payload: { timeRemaining: session.gameState.timeRemaining }
          });
          
          if (session.gameState.timeRemaining <= 0) {
            advanceGameState(session);
          }
        }
      }, 1000);
    } else {
      session.gameState.currentPhase = 'VOTING';
      session.gameState.currentColorIndex = 0;
      session.gameState.timeRemaining = session.settings.timePerVotingRound;

      // Convert descriptions Map to array format
      const descriptionsArray = Array.from(session.gameState.descriptions.get(session.gameState.colors[0]) || new Map())
        .map(([id, text]) => ({ id, text }));

      broadcastToSession(session, {
        type: 'STATE_UPDATE',
        payload: {
          phase: 'VOTING',
          color: session.gameState.colors[0],
          descriptions: descriptionsArray,
          timeRemaining: session.settings.timePerRound
        }
      });

      session.timer = setInterval(() => {
        if (session.gameState) {
          session.gameState.timeRemaining--;
          
          broadcastToSession(session, {
            type: 'STATE_UPDATE',
            payload: { timeRemaining: session.gameState.timeRemaining }
          });
          
          if (session.gameState.timeRemaining <= 0) {
            advanceGameState(session);
          }
        }
      }, 1000);
    }
  } else if (session.gameState.currentPhase === 'VOTING') {
    // Calculate scores for current color
    const currentColor = session.gameState.colors[session.gameState.currentColorIndex];
    const votes = session.gameState.votes.get(currentColor) || new Map();
    
    votes.forEach((votedForId) => {
      const player = session.players.get(votedForId);
      if (player) {
        player.score = (player.score || 0) + 1;
      }
    });

    // Show intermediate results
    broadcastToSession(session, {
      type: 'STATE_UPDATE',
      payload: {
        phase: 'INTERMEDIATE_RESULTS',
        scores: Array.from(session.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          score: p.score
        }))
      }
    });

    // Move to next color or final results
    if (session.gameState.currentColorIndex < session.gameState.colors.length - 1) {
      session.gameState.currentColorIndex++;
      session.gameState.currentPhase = 'INTERMEDIATE_RESULTS';
    } else {
      session.gameState.currentPhase = 'RESULTS';
      broadcastToSession(session, {
        type: 'STATE_UPDATE',
        payload: {
          phase: 'RESULTS',
          scores: Array.from(session.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            score: p.score
          }))
        }
      });
    }
  }
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `ws://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const password = url.searchParams.get('password');
  const playerName = url.searchParams.get('playerName');

  if (!sessionId || !sessions.has(sessionId) || !playerName) {
    ws.close(1008, 'Invalid session or missing player name');
    return;
  }

  const session = sessions.get(sessionId)!;
  
  if (session.password && session.password !== password) {
    ws.close(1008, 'Invalid password');
    return;
  }

  const playerId = uuidv4();
  const player: Player = {
    id: playerId,
    name: playerName,
    score: 0,
    ws
  };
  
  session.players.set(playerId, player);

  // Send initial state to new player
  ws.send(JSON.stringify({
    type: 'JOIN',
    payload: {
      playerId,
      players: Array.from(session.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
      })),
      gameState: session.gameState
    }
  }));

  // Broadcast updated player list to all players
  broadcastToSession(session, {
    type: 'PLAYERS_UPDATE',
    payload: {
      players: Array.from(session.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
      }))
    }
  });

  // Handle messages from the client
  ws.on('message', (data: string) => {
    try {
      const message: GameMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'START':
          if (session.players.size >= 3) {
            startNewRound(session);
          }
          break;

        case 'UPDATE_SETTINGS':
          // Update session settings
          session.settings = {
            ...session.settings,
            ...message.payload
          };
          
          // Broadcast new settings to all players
          broadcastToSession(session, {
            type: 'STATE_UPDATE',
            payload: {
              settings: session.settings
            }
          });
          break;
          
        case 'DESCRIPTION':
          if (session.gameState?.currentPhase === 'DESCRIBING') {
            const currentColor = session.gameState.colors[session.gameState.currentColorIndex];
            if (!session.gameState.descriptions.has(currentColor)) {
              session.gameState.descriptions.set(currentColor, new Map());
            }
            // Update player's description status
            const player = session.players.get(playerId);
            if (player) {
              player.description = message.payload.description;
            }
            session.gameState.descriptions.get(currentColor)!.set(playerId, message.payload.description);
            
            // Broadcast updated player statuses
            broadcastToSession(session, {
              type: 'STATE_UPDATE',
              payload: {
                descriptions: Array.from(session.players.values()).map(p => ({
                  id: p.id,
                  text: p.description
                }))
              }
            });
            
            // Check if all players have submitted descriptions
            const descriptionsForColor = session.gameState.descriptions.get(currentColor)!;
            if (descriptionsForColor.size === session.players.size) {
              // Everyone has submitted, advance to next color
              advanceGameState(session);
            }
          }
          break;
          
        case 'VOTE':
          if (session.gameState?.currentPhase === 'VOTING') {
            const currentColor = session.gameState.colors[session.gameState.currentColorIndex];
            if (!session.gameState.votes.has(currentColor)) {
              session.gameState.votes.set(currentColor, new Map());
            }
            session.gameState.votes.get(currentColor)!.set(playerId, message.payload.votedForId);
            
            // Check if everyone has voted
            const votes = session.gameState.votes.get(currentColor)!;
            if (votes.size === session.players.size) {
              // Everyone has voted, advance the game state
              advanceGameState(session);
            }
          }
          break;
          
        case 'NEXT_VOTE':
          if (session.gameState?.currentPhase === 'INTERMEDIATE_RESULTS') {
            // Start voting phase for the next color
            session.gameState.currentPhase = 'VOTING';
            session.gameState.timeRemaining = session.settings.timePerRound;
            const currentColor = session.gameState.colors[session.gameState.currentColorIndex];
            
            // Get descriptions for the current color
            const descriptionsArray = Array.from(
              session.gameState.descriptions.get(currentColor) || new Map()
            ).map(([id, text]) => ({ id, text }));
            
            broadcastToSession(session, {
              type: 'STATE_UPDATE',
              payload: {
                phase: 'VOTING',
                color: currentColor,
                descriptions: descriptionsArray,
                timeRemaining: session.settings.timePerRound
              }
            });
            
            session.timer = setInterval(() => {
              if (session.gameState) {
                session.gameState.timeRemaining--;
                
                broadcastToSession(session, {
                  type: 'STATE_UPDATE',
                  payload: { timeRemaining: session.gameState.timeRemaining }
                });
                
                if (session.gameState.timeRemaining <= 0) {
                  advanceGameState(session);
                }
              }
            }, 1000);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    session.players.delete(playerId);
    if (session.players.size === 0) {
      clearInterval(session.timer);
      sessions.delete(sessionId);
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
