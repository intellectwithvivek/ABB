import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MoveRecord } from '../../models/game.models';
import { MoveHistoryComponent } from './move-history.component';

describe('MoveHistoryComponent', () => {
  let fixture: ComponentFixture<MoveHistoryComponent>;

  async function renderMoves(moves: MoveRecord[]): Promise<HTMLElement> {
    fixture = TestBed.createComponent(MoveHistoryComponent);
    fixture.componentRef.setInput('moves', moves);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it('shows "No moves yet" and no table before the first move', async () => {
    const element = await renderMoves([]);

    expect(element.textContent).toContain('No moves yet');
    expect(element.querySelector('table')).toBeNull();
  });

  it('lists each move with its number, player and 1-based position', async () => {
    const element = await renderMoves([
      { moveNumber: 1, player: 'X', row: 0, col: 0 },
      { moveNumber: 2, player: 'O', row: 2, col: 1 },
    ]);

    const rows = Array.from(element.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['1', 'X', 'Row 1, Column 1'],
      ['2', 'O', 'Row 3, Column 2'],
    ]);
  });
});
