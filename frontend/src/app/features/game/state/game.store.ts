import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { toErrorMessage } from '../../../core/http/api-error';
import { GameApiService } from '../data-access/game-api.service';
import { CellValue, GameMode, GameState } from '../models/game.models';

const GAME_ID_STORAGE_KEY = 'tictactoe.gameId';

const GAME_EXPIRED_MESSAGE = 'That game expired on the server, so a new game was started.';

/** Rendered before the first snapshot arrives, e.g. while the server is unreachable. */
const EMPTY_BOARD: CellValue[][] = [
  [null, null, null],
  [null, null, null],
  [null, null, null],
];

/**
 * Single place the UI reads state from and sends actions to. The game itself is server state:
 * `game` only ever holds the latest snapshot returned by the backend. The store adds UI state only
 * (selected mode, loading flag, error message).
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly api = inject(GameApiService);
  private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;

  // Writable signals stay private; components get read-only views and change state through methods.
  private readonly gameState = signal<GameState | null>(null);
  private readonly selectedModeState = signal<GameMode>('TwoPlayer');
  private readonly loadingState = signal(false);
  private readonly errorMessageState = signal<string | null>(null);

  readonly game = this.gameState.asReadonly();
  readonly selectedMode = this.selectedModeState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly errorMessage = this.errorMessageState.asReadonly();

  readonly board = computed(() => this.game()?.board ?? EMPTY_BOARD);
  readonly winningCells = computed(() => this.game()?.winningCells ?? []);
  readonly moves = computed(() => this.game()?.moveHistory ?? []);
  readonly scoreboard = computed(() => this.game()?.scoreboard ?? null);
  // Whether an action is available at all. A running request does not disable the controls,
  // because disabling the focused control would drop keyboard focus; run() ignores clicks instead.
  readonly canPlay = computed(() => this.game()?.status === 'InProgress');
  readonly canUndo = computed(() => this.game()?.canUndo ?? false);
  readonly canReset = computed(() => this.game() !== null);

  /** Resumes the game saved for this browser tab, or starts a new one. */
  init(): void {
    const savedGameId = readSavedGameId();
    const createGameRequest = this.api.createGame(this.selectedMode());
    // Games live in server memory, so a saved id is stale after a server restart.
    // Any failure to resume therefore falls back to a new game.
    const request = savedGameId
      ? this.api.getGame(savedGameId).pipe(catchError(() => createGameRequest))
      : createGameRequest;
    // A resumed game may be VsComputer, so the mode picker follows the game actually shown.
    this.runGameRequest(request.pipe(tap((game) => this.selectedModeState.set(game.mode))));
  }

  newGame(): void {
    this.runGameRequest(this.api.createGame(this.selectedMode()));
  }

  play(row: number, col: number): void {
    const game = this.game();
    if (game) {
      this.runGameAction(
        game,
        this.api.submitMove(game.gameId, { player: game.currentPlayer, row, col }),
      );
    }
  }

  undo(): void {
    const game = this.game();
    if (game) {
      this.runGameAction(game, this.api.undoMove(game.gameId));
    }
  }

  resetGame(): void {
    const game = this.game();
    if (game) {
      this.runGameAction(game, this.api.resetGame(game.gameId));
    }
  }

  resetScoreboard(): void {
    // This endpoint returns only the scoreboard, so only that part of the snapshot is replaced.
    this.run(this.api.resetScoreboard(), (scoreboard) =>
      this.gameState.update((game) => (game ? { ...game, scoreboard } : game)),
    );
  }

  selectMode(mode: GameMode): void {
    this.selectedModeState.set(mode);
  }

  dismissError(): void {
    this.errorMessageState.set(null);
  }

  /**
   * Sends an action on the game on screen. When the server rejects it because this tab's copy is
   * out of date, the screen is brought back in line with the server instead of staying stale.
   */
  private runGameAction(game: GameState, request: Observable<GameState>): void {
    this.runGameRequest(request.pipe(catchError((error: unknown) => this.resync(game, error))));
  }

  private resync(game: GameState, error: unknown): Observable<GameState> {
    const status = error instanceof HttpErrorResponse ? error.status : null;
    // 404: the server no longer has the game (removed after idling, or the server restarted).
    if (status === 404) {
      return this.api
        .createGame(game.mode)
        .pipe(tap(() => this.errorMessageState.set(GAME_EXPIRED_MESSAGE)));
    }
    // 400: the action broke a rule on the server's board, e.g. another tab already played that
    // cell. The reason is shown next to the board the server actually has.
    if (status === 400) {
      return this.api
        .getGame(game.gameId)
        .pipe(tap(() => this.errorMessageState.set(toErrorMessage(error, this.apiBaseUrl))));
    }
    return throwError(() => error);
  }

  private runGameRequest(request: Observable<GameState>): void {
    this.run(request, (game) => this.showGame(game));
  }

  private run<T>(request: Observable<T>, onSuccess: (response: T) => void): void {
    // One request at a time: a double click must not submit the same action twice.
    if (this.loading()) {
      return;
    }
    this.loadingState.set(true);
    this.errorMessageState.set(null);
    request.pipe(finalize(() => this.loadingState.set(false))).subscribe({
      next: onSuccess,
      error: (error: unknown) => this.errorMessageState.set(toErrorMessage(error, this.apiBaseUrl)),
    });
  }

  private showGame(game: GameState): void {
    this.gameState.set(game);
    rememberGameId(game.gameId);
  }
}

/**
 * The game id is remembered per tab, so a page refresh resumes the game instead of starting over.
 * Storage access throws when the browser blocks it (e.g. Safari with all cookies blocked); the game
 * then still works, it just is not resumed after a refresh.
 */
function readSavedGameId(): string | null {
  try {
    return sessionStorage.getItem(GAME_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberGameId(gameId: string): void {
  try {
    sessionStorage.setItem(GAME_ID_STORAGE_KEY, gameId);
  } catch {
    // Blocked storage only costs resuming after a refresh (see readSavedGameId).
  }
}
