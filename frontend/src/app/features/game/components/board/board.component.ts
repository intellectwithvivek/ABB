import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CellPosition, CellValue } from '../../models/game.models';
import { CellComponent } from '../cell/cell.component';

/** The 3×3 grid. Purely presentational: it renders the board it is given and reports clicks. */
@Component({
  selector: 'app-board',
  imports: [CellComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardComponent {
  readonly board = input.required<CellValue[][]>();
  readonly winningCells = input<CellPosition[]>([]);
  readonly disabled = input(false);

  readonly cellSelected = output<CellPosition>();

  protected isWinningCell(row: number, col: number): boolean {
    return this.winningCells().some((cell) => cell.row === row && cell.col === col);
  }
}
