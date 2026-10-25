import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../../core/config/app-config';
import { TEST_APP_CONFIG } from '../../../testing/app-config.fixture';
import { GameState, Scoreboard } from '../models/game.models';
import { createGameState } from '../testing/game-state.fixture';
import { GameApiService } from './game-api.service';

const GAME_ID = '8a6e0804-2bd0-4672-b79d-d97027f9071a';
const GAMES_URL = `${TEST_APP_CONFIG.apiBaseUrl}/games`;

describe('GameApiService', () => {
  let service: GameApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // provideHttpClientTesting() swaps the real network backend for HttpTestingController,
      // which records each request so the test can inspect it and answer it with flush().
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
      ],
    });
    service = TestBed.inject(GameApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  // Fails the test if the service sent a request that no test expected.
  afterEach(() => httpTesting.verify());

  it('createGame POSTs the mode to /games and returns the new game state', () => {
    const created = createGameState({ gameId: GAME_ID, mode: 'VsComputer' });
    let response: GameState | undefined;

    service.createGame('VsComputer').subscribe((game) => (response = game));

    const request = httpTesting.expectOne(GAMES_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ mode: 'VsComputer' });
    request.flush(created);
    expect(response).toEqual(created);
  });

  it('submitMove POSTs the move to /games/{id}/moves and returns the updated game state', () => {
    const updated = createGameState({
      gameId: GAME_ID,
      board: [
        [null, null, null],
        [null, null, 'X'],
        [null, null, null],
      ],
      currentPlayer: 'O',
      moveHistory: [{ moveNumber: 1, player: 'X', row: 1, col: 2 }],
      canUndo: true,
    });
    let response: GameState | undefined;

    service
      .submitMove(GAME_ID, { player: 'X', row: 1, col: 2 })
      .subscribe((game) => (response = game));

    const request = httpTesting.expectOne(`${GAMES_URL}/${GAME_ID}/moves`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ player: 'X', row: 1, col: 2 });
    request.flush(updated);
    expect(response).toEqual(updated);
  });

  it('getGame GETs /games/{id}', () => {
    service.getGame(GAME_ID).subscribe();

    httpTesting
      .expectOne({ method: 'GET', url: `${GAMES_URL}/${GAME_ID}` })
      .flush(createGameState());
  });

  it('undoMove POSTs to /games/{id}/undo without a body', () => {
    service.undoMove(GAME_ID).subscribe();

    const request = httpTesting.expectOne({ method: 'POST', url: `${GAMES_URL}/${GAME_ID}/undo` });
    expect(request.request.body).toBeNull();
    request.flush(createGameState());
  });

  it('resetGame POSTs to /games/{id}/reset without a body', () => {
    service.resetGame(GAME_ID).subscribe();

    const request = httpTesting.expectOne({ method: 'POST', url: `${GAMES_URL}/${GAME_ID}/reset` });
    expect(request.request.body).toBeNull();
    request.flush(createGameState());
  });

  it('resetScoreboard POSTs to /scoreboard/reset and returns the zeroed scoreboard', () => {
    const zeroed: Scoreboard = { xWins: 0, oWins: 0, draws: 0 };
    let response: Scoreboard | undefined;

    service.resetScoreboard().subscribe((scoreboard) => (response = scoreboard));

    const request = httpTesting.expectOne({
      method: 'POST',
      url: `${TEST_APP_CONFIG.apiBaseUrl}/scoreboard/reset`,
    });
    expect(request.request.body).toBeNull();
    request.flush(zeroed);
    expect(response).toEqual(zeroed);
  });
});
