export interface Player {
  id: string;
  name: string;
  score: number;
  ws: WebSocket;
}

export interface GameState {
  currentPhase: 'WAITING' | 'DESCRIBING' | 'VOTING' | 'RESULTS';
  colors: string[];
  currentColorIndex: number;
  descriptions: Map<string, Map<string, string>>;  // color -> (playerId -> description)
  votes: Map<string, Map<string, string>>;  // color -> (voterId -> descriptionPlayerId)
  timeRemaining: number;
}

export interface GameSettings {
  numberOfColors: number;
  timePerRound: number;
}

export interface GameMessage {
  type: 'JOIN' | 'START' | 'DESCRIPTION' | 'VOTE' | 'STATE_UPDATE';
  payload: any;
}
