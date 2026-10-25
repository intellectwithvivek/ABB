import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { TEST_APP_CONFIG } from '../../testing/app-config.fixture';
import { GamePageComponent } from './game-page.component';
import { createGameState } from './testing/game-state.fixture';

const GAMES_URL = `${TEST_APP_CONFIG.apiBaseUrl}/games`;

/**
 * Wiring test: the real store, service and components, with only the network replaced.
 * It checks that a click travels to the right endpoint and that the reply is what gets rendered.
 */
describe('GamePageComponent', () => {
  let fixture: ComponentFixture<GamePageComponent>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;

  const newGame = createGameState();

  beforeEach(async () => {
    // The store remembers the game id per tab; start every test as a first visit.
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GamePageComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => httpTesting.verify());

  function cells(): HTMLButtonElement[] {
    return Array.from(page.querySelectorAll('button.cell'));
  }

  function statusMessage(): string | undefined {
    return page.querySelector('app-status-bar .status-message')?.textContent?.trim();
  }

  async function answerCreateGame(): Promise<void> {
    httpTesting.expectOne({ method: 'POST', url: GAMES_URL }).flush(newGame);
    await fixture.whenStable();
  }

  it('starts a new game on load and shows that it is X to move', async () => {
    const request = httpTesting.expectOne({ method: 'POST', url: GAMES_URL });
    expect(request.request.body).toEqual({ mode: 'TwoPlayer' });

    request.flush(newGame);
    await fixture.whenStable();

    expect(statusMessage()).toBe("Player X's turn");
    expect(cells()).toHaveLength(9);
    expect(cells().every((cell) => cell.getAttribute('aria-disabled') === 'false')).toBe(true);
  });

  it('sends a clicked cell as a move and renders the board and history the backend returns', async () => {
    await answerCreateGame();

    cells()[4].click();

    const request = httpTesting.expectOne({
      method: 'POST',
      url: `${GAMES_URL}/${newGame.gameId}/moves`,
    });
    expect(request.request.body).toEqual({ player: 'X', row: 1, col: 1 });
    request.flush(
      createGameState({
        board: [
          [null, null, null],
          [null, 'X', null],
          [null, null, null],
        ],
        currentPlayer: 'O',
        moveHistory: [{ moveNumber: 1, player: 'X', row: 1, col: 1 }],
        canUndo: true,
      }),
    );
    await fixture.whenStable();

    expect(cells()[4].textContent?.trim()).toBe('X');
    expect(statusMessage()).toBe("Player O's turn");
    expect(page.querySelector('app-move-history tbody')?.textContent).toContain('Row 2, Column 2');
  });

  it('shows a rejected move in a toast and re-syncs the board with the server', async () => {
    // Another tab has already finished this game, so this tab's board is out of date.
    await answerCreateGame();

    cells()[0].click();
    httpTesting.expectOne(`${GAMES_URL}/${newGame.gameId}/moves`).flush(
      {
        title: 'Invalid move',
        status: 400,
        detail: 'The game is already over. Reset the game or start a new one.',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    httpTesting
      .expectOne({ method: 'GET', url: `${GAMES_URL}/${newGame.gameId}` })
      .flush(createGameState({ status: 'Won', winner: 'O' }));
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'The game is already over. Reset the game or start a new one.',
    );
    expect(statusMessage()).toBe('Player O wins!');
  });
});
