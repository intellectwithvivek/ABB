import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CellPosition, CellValue } from '../../models/game.models';
import { BoardComponent } from './board.component';

const EMPTY_BOARD: CellValue[][] = [
  [null, null, null],
  [null, null, null],
  [null, null, null],
];

/** X has completed the top row. */
const X_WINS_TOP_ROW: CellValue[][] = [
  ['X', 'X', 'X'],
  ['O', 'O', null],
  [null, null, null],
];

const TOP_ROW: CellPosition[] = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
];

/** The optional inputs; the defaults describe a game in progress. */
interface BoardOptions {
  winningCells?: CellPosition[];
  disabled?: boolean;
}

describe('BoardComponent', () => {
  let fixture: ComponentFixture<BoardComponent>;

  async function renderBoard(
    board: CellValue[][],
    { winningCells = [], disabled = false }: BoardOptions = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(BoardComponent);
    // Signal inputs are set through componentRef, exactly as a parent template would bind them.
    fixture.componentRef.setInput('board', board);
    fixture.componentRef.setInput('winningCells', winningCells);
    fixture.componentRef.setInput('disabled', disabled);
    await fixture.whenStable();
  }

  /** The 9 cell buttons in row-major order, so cell (row, col) is at index row * 3 + col. */
  function cells(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button.cell'));
  }

  /** Cells are locked with aria-disabled (not `disabled`) so they keep keyboard focus. */
  function isLocked(cell: HTMLButtonElement): boolean {
    return cell.getAttribute('aria-disabled') === 'true';
  }

  it('renders 9 cells', async () => {
    await renderBoard(EMPTY_BOARD);

    expect(cells()).toHaveLength(9);
  });

  it('shows X and O in the cells that hold them', async () => {
    await renderBoard([
      ['X', null, null],
      [null, 'O', null],
      [null, null, null],
    ]);

    const marks = cells().map((cell) => cell.textContent?.trim());
    expect(marks).toEqual(['X', '', '', '', 'O', '', '', '', '']);
  });

  it('highlights only the winning cells', async () => {
    await renderBoard(X_WINS_TOP_ROW, { winningCells: TOP_ROW, disabled: true });

    const highlighted = cells().map((cell) => cell.classList.contains('cell--winning'));
    expect(highlighted).toEqual([true, true, true, false, false, false, false, false, false]);
  });

  it('disables every cell when the game is over', async () => {
    await renderBoard(X_WINS_TOP_ROW, { winningCells: TOP_ROW, disabled: true });

    expect(cells().every(isLocked)).toBe(true);
  });

  it('disables occupied cells and keeps empty cells playable', async () => {
    await renderBoard([
      ['X', null, null],
      [null, 'O', null],
      [null, null, null],
    ]);

    const locked = cells().map(isLocked);
    expect(locked).toEqual([true, false, false, false, true, false, false, false, false]);
  });

  it('emits cellSelected with the row and column of a clicked empty cell', async () => {
    await renderBoard(EMPTY_BOARD);
    const cellSelected = vi.fn();
    fixture.componentInstance.cellSelected.subscribe(cellSelected);

    cells()[5].click();

    expect(cellSelected).toHaveBeenCalledExactlyOnceWith({ row: 1, col: 2 });
  });

  it('does not emit when an occupied cell is clicked', async () => {
    await renderBoard([
      ['X', null, null],
      [null, null, null],
      [null, null, null],
    ]);
    const cellSelected = vi.fn();
    fixture.componentInstance.cellSelected.subscribe(cellSelected);

    cells()[0].click();

    expect(cellSelected).not.toHaveBeenCalled();
  });
});
