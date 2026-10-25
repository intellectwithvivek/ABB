import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Scoreboard } from '../../models/game.models';
import { ScoreboardComponent } from './scoreboard.component';

describe('ScoreboardComponent', () => {
  let fixture: ComponentFixture<ScoreboardComponent>;

  async function renderScoreboard(scoreboard: Scoreboard | null): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ScoreboardComponent);
    fixture.componentRef.setInput('scoreboard', scoreboard);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  /** Reads the <dl> as label → value pairs, e.g. { 'X wins': '2' }. */
  function scores(element: HTMLElement): Record<string, string | undefined> {
    return Object.fromEntries(
      Array.from(element.querySelectorAll('dt')).map((term) => [
        term.textContent?.trim(),
        term.nextElementSibling?.textContent?.trim(),
      ]),
    );
  }

  it('shows X wins, O wins and draws from the backend', async () => {
    const element = await renderScoreboard({ xWins: 2, oWins: 1, draws: 3 });

    expect(scores(element)).toEqual({ 'X wins': '2', 'O wins': '1', Draws: '3' });
  });

  it('shows placeholders until the first game has loaded', async () => {
    const element = await renderScoreboard(null);

    expect(scores(element)).toEqual({ 'X wins': '–', 'O wins': '–', Draws: '–' });
  });

  it('emits resetScoreboard when Reset Scoreboard is clicked', async () => {
    const element = await renderScoreboard({ xWins: 2, oWins: 1, draws: 3 });
    const resetScoreboard = vi.fn();
    fixture.componentInstance.resetScoreboard.subscribe(resetScoreboard);

    element.querySelector('button')?.click();

    expect(resetScoreboard).toHaveBeenCalledOnce();
  });

  it('disables Reset Scoreboard while no scoreboard has loaded, e.g. with the server down', async () => {
    const element = await renderScoreboard(null);

    expect(element.querySelector('button')?.disabled).toBe(true);
  });
});
