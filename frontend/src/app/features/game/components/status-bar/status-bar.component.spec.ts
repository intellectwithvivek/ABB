import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameState } from '../../models/game.models';
import { createGameState } from '../../testing/game-state.fixture';
import { StatusBarComponent } from './status-bar.component';

describe('StatusBarComponent', () => {
  let fixture: ComponentFixture<StatusBarComponent>;

  afterEach(() => vi.useRealTimers());

  async function renderStatus(game: GameState | null, loading = false): Promise<HTMLElement> {
    fixture = TestBed.createComponent(StatusBarComponent);
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('loading', loading);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  function statusMessage(element: HTMLElement): string | undefined {
    return element.querySelector('.status-message')?.textContent?.trim();
  }

  /** The text of the polite live region, which is what screen readers announce. */
  function announcement(element: HTMLElement): string | undefined {
    return element.querySelector('[aria-live="polite"]')?.textContent?.trim();
  }

  it.each<[string, GameState]>([
    ["Player O's turn", createGameState({ mode: 'TwoPlayer', currentPlayer: 'O' })],
    ['Your turn (X)', createGameState({ mode: 'VsComputer', currentPlayer: 'X' })],
    ['Player X wins!', createGameState({ mode: 'TwoPlayer', status: 'Won', winner: 'X' })],
    ['You win!', createGameState({ mode: 'VsComputer', status: 'Won', winner: 'X' })],
    ['Computer wins!', createGameState({ mode: 'VsComputer', status: 'Won', winner: 'O' })],
    ["It's a draw!", createGameState({ status: 'Draw' })],
  ])('shows "%s"', async (expected, game) => {
    const element = await renderStatus(game);

    expect(statusMessage(element)).toBe(expected);
  });

  it("shows the active game's mode", async () => {
    const element = await renderStatus(createGameState({ mode: 'VsComputer' }));

    expect(element.querySelector('.mode-badge')?.textContent?.trim()).toBe('Vs Computer');
  });

  describe('screen reader announcement', () => {
    it("announces the human's move and the computer's reply, which the turn text alone never changes for", async () => {
      const element = await renderStatus(
        createGameState({
          mode: 'VsComputer',
          moveHistory: [
            { moveNumber: 1, player: 'X', row: 0, col: 0 },
            { moveNumber: 2, player: 'O', row: 1, col: 1 },
          ],
        }),
      );

      expect(announcement(element)).toBe(
        'X played Row 1, Column 1. O played Row 2, Column 2. Your turn (X)',
      );
    });

    it('announces the last move and the result in Two Player mode', async () => {
      const element = await renderStatus(
        createGameState({
          status: 'Won',
          winner: 'X',
          moveHistory: [{ moveNumber: 5, player: 'X', row: 2, col: 2 }],
        }),
      );

      expect(announcement(element)).toBe('X played Row 3, Column 3. Player X wins!');
    });

    it('announces an empty board after a reset, or an undo of every move', async () => {
      const element = await renderStatus(createGameState());

      expect(announcement(element)).toBe("The board is empty. Player X's turn");
    });
  });

  it('shows a loading message and the working indicator before the first game arrives', async () => {
    const element = await renderStatus(null, true);

    expect(statusMessage(element)).toBe('Loading game…');
    expect(element.textContent).toContain('Working…');
  });

  it('explains a slow first load, when a free API host may be waking up', () => {
    vi.useFakeTimers();
    // detectChanges() renders synchronously; whenStable() would wait on the faked timers.
    fixture = TestBed.createComponent(StatusBarComponent);
    fixture.componentRef.setInput('game', null);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    vi.advanceTimersByTime(4999);
    fixture.detectChanges();
    expect(statusMessage(element)).toBe('Loading game…');

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(statusMessage(element)).toBe(
      'Still loading: the game server may be waking up, which can take up to a minute.',
    );

    fixture.componentRef.setInput('game', createGameState());
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect(statusMessage(element)).toBe("Player X's turn");
  });

  it('asks the player to start a game when no game could be loaded', async () => {
    const element = await renderStatus(null);

    expect(statusMessage(element)).toBe('Press New Game to start');
    expect(element.textContent).not.toContain('Working…');
  });
});
