import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MoveRecord } from '../../models/game.models';

/** The current game's moves as a table, in the order the backend recorded them. */
@Component({
  selector: 'app-move-history',
  templateUrl: './move-history.component.html',
  styleUrl: './move-history.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveHistoryComponent {
  readonly moves = input.required<MoveRecord[]>();
}
