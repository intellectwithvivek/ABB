import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { GAME_MODE_LABELS } from '../../models/game-mode-labels';
import { GameState, Player } from '../../models/game.models';

/** In VsComputer mode the backend always seats the human as X and the computer as O. */
const HUMAN_PLAYER: Player = 'X';
const COMPUTER_PLAYER: Player = 'O';

/**
 * A free hosting plan puts the API to sleep when idle, and its first answer can then take 30–60 s.
 * After this long without a first game, the status says so instead of only "Loading game…".
 */
const SLOW_START_MS = 5000;

/** Shows whose turn it is or how the game ended, worded from the backend's snapshot. */
@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBarComponent {
  readonly game = input.required<GameState | null>();
  readonly loading = input(false);

  private readonly waitingForFirstGame = computed(() => this.loading() && this.game() === null);
  private readonly slowStart = signal(false);

  protected readonly message = computed(() => {
    const game = this.game();
    if (game) {
      return describeGame(game);
    }
    if (!this.loading()) {
      return 'Press New Game to start';
    }
    return this.slowStart()
      ? 'Still loading: the game server may be waking up, which can take up to a minute.'
      : 'Loading game…';
  });

  /**
   * What screen readers hear. A live region speaks only when its text changes, and the visible
   * message often stays the same (in Vs Computer mode it reads "Your turn (X)" after every move),
   * so the latest moves are spelled out first.
   */
  protected readonly announcement = computed(() => {
    const game = this.game();
    return game ? `${describeLatestMoves(game)} ${this.message()}` : this.message();
  });

  protected readonly modeLabel = computed(() => {
    const game = this.game();
    return game ? GAME_MODE_LABELS[game.mode] : null;
  });

  /**
   * Colors the status after the player it is about: the one to move, or the winner.
   * 'neutral' (no game yet, or a draw) keeps the muted default tone that `.status` sets.
   */
  protected readonly tone = computed(() => {
    const game = this.game();
    if (!game || game.status === 'Draw') {
      return 'neutral';
    }
    const player = game.status === 'Won' ? game.winner : game.currentPlayer;
    return player === 'X' ? 'x' : 'o';
  });

  constructor() {
    // Runs whenever waitingForFirstGame changes; the cleanup cancels the timer and resets the flag.
    effect((onCleanup) => {
      if (!this.waitingForFirstGame()) {
        return;
      }
      const timer = setTimeout(() => this.slowStart.set(true), SLOW_START_MS);
      onCleanup(() => {
        clearTimeout(timer);
        this.slowStart.set(false);
      });
    });
  }
}

function describeGame(game: GameState): string {
  const vsComputer = game.mode === 'VsComputer';
  switch (game.status) {
    case 'InProgress':
      return vsComputer
        ? `Your turn (${game.currentPlayer})`
        : `Player ${game.currentPlayer}'s turn`;
    case 'Won':
      if (vsComputer) {
        return game.winner === HUMAN_PLAYER ? 'You win!' : 'Computer wins!';
      }
      return `Player ${game.winner} wins!`;
    case 'Draw':
      return "It's a draw!";
  }
}

/**
 * "X played Row 1, Column 1." In Vs Computer mode one request plays the human's move and the
 * computer's reply, so both are described.
 */
function describeLatestMoves(game: GameState): string {
  const moves = game.moveHistory;
  const lastMove = moves.at(-1);
  if (!lastMove) {
    return 'The board is empty.';
  }
  const count = game.mode === 'VsComputer' && lastMove.player === COMPUTER_PLAYER ? 2 : 1;
  return moves
    .slice(-count)
    .map((move) => `${move.player} played Row ${move.row + 1}, Column ${move.col + 1}.`)
    .join(' ');
}
