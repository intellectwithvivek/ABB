// TypeScript mirrors of the backend's JSON contract (see docs/API.md).

export type Player = 'X' | 'O';

export type CellValue = Player | null;

export type GameMode = 'TwoPlayer' | 'VsComputer';

export type GameStatus = 'InProgress' | 'Won' | 'Draw';

/** A board coordinate, 0-based like the API. */
export interface CellPosition {
  row: number;
  col: number;
}

export interface MoveRecord {
  moveNumber: number;
  player: Player;
  row: number;
  col: number;
}

export interface Scoreboard {
  xWins: number;
  oWins: number;
  draws: number;
}

export interface GameState {
  gameId: string;
  mode: GameMode;
  /** board[row][col] */
  board: CellValue[][];
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  winningCells: CellPosition[];
  moveHistory: MoveRecord[];
  canUndo: boolean;
  scoreboard: Scoreboard;
}

export interface MoveRequest {
  player: Player;
  row: number;
  col: number;
}
