import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { TEST_APP_CONFIG } from '../../../testing/app-config.fixture';
import { GameApiService } from '../data-access/game-api.service';
import { GameState } from '../models/game.models';
import { createGameState } from '../testing/game-state.fixture';
import { GameStore } from './game.store';

const GAME_ID_STORAGE_KEY = 'tictactoe.gameId';

/** Stand-in for GameApiService; each test programs the endpoints it uses with of()/throwError(). */
function createApiStub() {
  return {
    createGame: vi.fn<GameApiService['createGame']>(),
    getGame: vi.fn<GameApiService['getGame']>(),
    submitMove: vi.fn<GameApiService['submitMove']>(),
    undoMove: vi.fn<GameApiService['undoMove']>(),
    resetGame: vi.fn<GameApiService['resetGame']>(),
    resetScoreboard: vi.fn<GameApiService['resetScoreboard']>(),
  };
}

/** An error response carrying ProblemDetails, as the backend sends for 400 and 404. */
function apiError(status: number, detail: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { status, detail } });
}

/** Status 0: no HTTP response at all, e.g. the server is down. */
const UNREACHABLE = new HttpErrorResponse({ status: 0 });
const UNREACHABLE_MESSAGE =
  'Cannot reach the game server at https://api.test. Is the backend running?';

describe('GameStore', () => {
  let api: ReturnType<typeof createApiStub>;
  let store: GameStore;

  beforeEach(() => {
    sessionStorage.clear();
    api = createApiStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameApiService, useValue: api },
        { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
      ],
    });
    store = TestBed.inject(GameStore);
  });

  afterEach(() => vi.restoreAllMocks());

  /** Puts a backend snapshot on screen the way the UI does: through New Game. */
  function loadGame(game: GameState): void {
    api.createGame.mockReturnValue(of(game));
    store.newGame();
  }

  describe('init', () => {
    it('creates a game in the selected mode when no game was saved', () => {
      const created = createGameState({ gameId: 'new-game' });
      api.createGame.mockReturnValue(of(created));

      store.init();

      expect(api.createGame).toHaveBeenCalledWith('TwoPlayer');
      expect(store.game()).toEqual(created);
      expect(sessionStorage.getItem(GAME_ID_STORAGE_KEY)).toBe('new-game');
    });

    it('restores the saved game after a page refresh and follows its mode', () => {
      sessionStorage.setItem(GAME_ID_STORAGE_KEY, 'saved-game');
      const saved = createGameState({ gameId: 'saved-game', mode: 'VsComputer' });
      const newGameRequest = new Subject<GameState>();
      api.getGame.mockReturnValue(of(saved));
      api.createGame.mockReturnValue(newGameRequest);

      store.init();

      expect(api.getGame).toHaveBeenCalledWith('saved-game');
      expect(newGameRequest.observed).toBe(false);
      expect(store.game()).toEqual(saved);
      expect(store.selectedMode()).toBe('VsComputer');
    });

    it('falls back to a new game when the saved game no longer exists on the server', () => {
      sessionStorage.setItem(GAME_ID_STORAGE_KEY, 'stale-game');
      const created = createGameState({ gameId: 'new-game' });
      api.getGame.mockReturnValue(
        throwError(() => apiError(404, "Game 'stale-game' was not found.")),
      );
      api.createGame.mockReturnValue(of(created));

      store.init();

      expect(store.game()).toEqual(created);
      expect(store.errorMessage()).toBeNull();
      expect(sessionStorage.getItem(GAME_ID_STORAGE_KEY)).toBe('new-game');
    });

    it('reports an unreachable server in errorMessage', () => {
      api.createGame.mockReturnValue(throwError(() => UNREACHABLE));

      store.init();

      expect(store.game()).toBeNull();
      expect(store.errorMessage()).toBe(UNREACHABLE_MESSAGE);
      expect(store.loading()).toBe(false);
    });

    it('still starts a game when the browser blocks session storage', () => {
      const blocked = () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      };
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
      const created = createGameState({ gameId: 'new-game' });
      api.createGame.mockReturnValue(of(created));

      store.init();

      expect(store.game()).toEqual(created);
      expect(store.errorMessage()).toBeNull();
    });
  });

  describe('play', () => {
    it('sends the move for the player whose turn the backend reported and shows the reply', () => {
      const game = createGameState({ currentPlayer: 'O' });
      const afterMove = createGameState({ currentPlayer: 'X', canUndo: true });
      loadGame(game);
      api.submitMove.mockReturnValue(of(afterMove));

      store.play(1, 2);

      expect(api.submitMove).toHaveBeenCalledWith(game.gameId, { player: 'O', row: 1, col: 2 });
      expect(store.game()).toEqual(afterMove);
    });

    it('shows why a move was rejected next to the board the server actually has', () => {
      // This tab is out of date: another tab has already played (0, 0).
      const staleGame = createGameState();
      const serverGame = createGameState({
        board: [
          ['X', null, null],
          [null, null, null],
          [null, null, null],
        ],
        currentPlayer: 'O',
        moveHistory: [{ moveNumber: 1, player: 'X', row: 0, col: 0 }],
        canUndo: true,
      });
      loadGame(staleGame);
      api.submitMove.mockReturnValue(
        throwError(() => apiError(400, 'Cell (row 0, col 0) is already taken by X.')),
      );
      api.getGame.mockReturnValue(of(serverGame));

      store.play(0, 0);

      expect(api.getGame).toHaveBeenCalledWith(staleGame.gameId);
      expect(store.game()).toEqual(serverGame);
      expect(store.errorMessage()).toBe('Cell (row 0, col 0) is already taken by X.');
      expect(store.loading()).toBe(false);
    });

    it('keeps the last snapshot when the server cannot be reached', () => {
      const game = createGameState();
      loadGame(game);
      api.submitMove.mockReturnValue(throwError(() => UNREACHABLE));

      store.play(0, 0);

      expect(store.game()).toEqual(game);
      expect(store.errorMessage()).toBe(UNREACHABLE_MESSAGE);
    });

    it('clears the previous error when the next request starts', () => {
      loadGame(createGameState());
      api.submitMove.mockReturnValueOnce(throwError(() => UNREACHABLE));
      store.play(0, 0);
      api.submitMove.mockReturnValueOnce(of(createGameState({ currentPlayer: 'O' })));

      store.play(0, 1);

      expect(store.errorMessage()).toBeNull();
    });
  });

  describe('when the server no longer has the game (expired after idling, or restarted)', () => {
    const expiredGame = createGameState({ gameId: 'expired-game', mode: 'VsComputer' });
    const replacement = createGameState({ gameId: 'new-game', mode: 'VsComputer' });

    beforeEach(() => {
      loadGame(expiredGame);
      const notFound = throwError(() => apiError(404, "Game 'expired-game' was not found."));
      api.submitMove.mockReturnValue(notFound);
      api.undoMove.mockReturnValue(notFound);
      api.resetGame.mockReturnValue(notFound);
      api.createGame.mockReturnValue(of(replacement));
    });

    it.each<[string, () => void]>([
      ['play', () => store.play(0, 0)],
      ['undo', () => store.undo()],
      ['resetGame', () => store.resetGame()],
    ])('%s starts a new game in the same mode and says why', (_action, act) => {
      act();

      expect(api.createGame).toHaveBeenLastCalledWith('VsComputer');
      expect(store.game()).toEqual(replacement);
      expect(store.errorMessage()).toBe(
        'That game expired on the server, so a new game was started.',
      );
      expect(sessionStorage.getItem(GAME_ID_STORAGE_KEY)).toBe('new-game');
    });
  });

  describe('while a request is in flight', () => {
    // A Subject stays pending until the test calls next()/complete(), like a slow server.
    let pendingMove: Subject<GameState>;

    beforeEach(() => {
      loadGame(createGameState({ canUndo: true }));
      pendingMove = new Subject<GameState>();
      api.submitMove.mockReturnValue(pendingMove);
      store.play(0, 0);
    });

    it('sets loading but leaves the actions available, so the focused control keeps focus', () => {
      expect(store.loading()).toBe(true);
      expect(store.canPlay()).toBe(true);
      expect(store.canUndo()).toBe(true);
    });

    it('ignores further actions, so a double click sends only one request', () => {
      // HttpClient observables are cold: a request is sent on subscribe, not when the service
      // method returns it. So "ignored" means the store never subscribes to these.
      const secondMove = new Subject<GameState>();
      const undoRequest = new Subject<GameState>();
      const newGameRequest = new Subject<GameState>();
      api.submitMove.mockReturnValue(secondMove);
      api.undoMove.mockReturnValue(undoRequest);
      api.createGame.mockReturnValue(newGameRequest);

      store.play(0, 1);
      store.undo();
      store.newGame();

      expect(pendingMove.observed).toBe(true);
      expect(secondMove.observed).toBe(false);
      expect(undoRequest.observed).toBe(false);
      expect(newGameRequest.observed).toBe(false);
    });

    it('clears loading once the response arrives', () => {
      pendingMove.next(createGameState({ currentPlayer: 'O' }));
      pendingMove.complete();

      expect(store.loading()).toBe(false);
      expect(store.canPlay()).toBe(true);
    });
  });

  it('newGame creates a game in the selected mode', () => {
    store.selectMode('VsComputer');
    api.createGame.mockReturnValue(of(createGameState({ mode: 'VsComputer' })));

    store.newGame();

    expect(api.createGame).toHaveBeenCalledWith('VsComputer');
    expect(store.game()?.mode).toBe('VsComputer');
  });

  it('undo sends the game id and shows the restored state', () => {
    const game = createGameState({ canUndo: true });
    const restored = createGameState({ canUndo: false });
    loadGame(game);
    api.undoMove.mockReturnValue(of(restored));

    store.undo();

    expect(api.undoMove).toHaveBeenCalledWith(game.gameId);
    expect(store.game()).toEqual(restored);
  });

  it('resetGame sends the game id and shows the fresh board', () => {
    const game = createGameState({ status: 'Won', winner: 'X' });
    const fresh = createGameState();
    loadGame(game);
    api.resetGame.mockReturnValue(of(fresh));

    store.resetGame();

    expect(api.resetGame).toHaveBeenCalledWith(game.gameId);
    expect(store.game()).toEqual(fresh);
  });

  it('resetScoreboard replaces only the scoreboard part of the snapshot', () => {
    const game = createGameState({
      currentPlayer: 'O',
      scoreboard: { xWins: 2, oWins: 1, draws: 3 },
    });
    const zeroed = { xWins: 0, oWins: 0, draws: 0 };
    loadGame(game);
    api.resetScoreboard.mockReturnValue(of(zeroed));

    store.resetScoreboard();

    expect(store.game()).toEqual({ ...game, scoreboard: zeroed });
    expect(store.scoreboard()).toEqual(zeroed);
  });

  it('blocks playing and undoing once the backend reports the game is over', () => {
    loadGame(createGameState({ status: 'Won', winner: 'X', canUndo: false }));

    expect(store.canPlay()).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it('dismissError clears the error message', () => {
    api.createGame.mockReturnValue(throwError(() => apiError(400, 'Rejected.')));
    store.newGame();
    expect(store.errorMessage()).toBe('Rejected.');

    store.dismissError();

    expect(store.errorMessage()).toBeNull();
  });
});
