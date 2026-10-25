import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CellValue } from '../../models/game.models';

/** One square of the board: a button that is locked once it holds a mark. */
@Component({
  selector: 'app-cell',
  templateUrl: './cell.component.html',
  styleUrl: './cell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellComponent {
  readonly value = input.required<CellValue>();
  readonly row = input.required<number>();
  readonly col = input.required<number>();
  readonly highlighted = input(false);
  readonly disabled = input(false);

  readonly selected = output<void>();

  // A locked cell uses aria-disabled rather than the native `disabled` attribute: a natively
  // disabled button loses keyboard focus and leaves the Tab order, so after every move a keyboard
  // user would be thrown back to the top of the page and could not tab through the marks.
  protected readonly locked = computed(() => this.disabled() || this.value() !== null);

  // Screen readers announce positions 1-based, like the move history.
  protected readonly ariaLabel = computed(() => {
    const label = `Row ${this.row() + 1}, Column ${this.col() + 1}, ${this.value() ?? 'empty'}`;
    return this.highlighted() ? `${label}, winning line` : label;
  });

  protected select(): void {
    if (!this.locked()) {
      this.selected.emit();
    }
  }
}
