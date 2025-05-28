enum PlayerPollingFlag {
  ERROR = -1,
  IN_LOBBY = 0, // After joining a lobby
  JOINED_ROUND = 1, // After client joins round
  ROUND_STARTED = 2, // After all clients have joined round
  FINISHED_ROUND = 3, // After clients round ends
  WAITING = 4, // After sending their data
  WAITED = 5, // After waiting
  GAME_ENDED = 6, // Sent after client timer ends
}

// For resilience
enum ServerPollingFlag {
  IN_LOBBY = 0,
  ROUND_STARTED = 2,
  FINISHED_ROUND = 3,
  GAME_ENDED = 6,
}

export interface Player {
  id: string;
  name: string;
  searchTime: number;
  lobbyId: string;
  pollingFlag: PlayerPollingFlag;
  score: number;
  admin: boolean;
  lastPollTime: number;
  cumScore: number;
}

export interface Lobby {
  id: string;
  adminId: string;
  maxPlayers: number;
  numRounds: number;
  players: { [playerId: string]: Player };
  started: boolean;
  roundCount: number;
  leaderboard: [playerName: string, score: number, totalTime: number][];
  serverFlag: ServerPollingFlag;
  imageRandomiser: number[];
  waitingTimer: number;
  maxSearchTime: number;
}

export interface Lobbies {
  [lobbyId: string]: Lobby;
}

export interface Round {
  shape: number;
  allShapes: any;
}

export interface Server {}
