import { GameState } from '../models/game.models';

/** A fresh Two Player game as the backend returns it; tests override only the fields they need. */
export function createGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: '8a6e0804-2bd0-4672-b79d-d97027f9071a',
    mode: 'TwoPlayer',
    board: [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    currentPlayer: 'X',
    status: 'InProgress',
    winner: null,
    winningCells: [],
    moveHistory: [],
    canUndo: false,
    scoreboard: { xWins: 0, oWins: 0, draws: 0 },
    ...overrides,
  };
}
