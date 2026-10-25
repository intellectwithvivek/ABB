import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Scoreboard } from '../../models/game.models';

/** Server-wide totals of completed games, plus the Reset Scoreboard action. */
@Component({
  selector: 'app-scoreboard',
  templateUrl: './scoreboard.component.html',
  styleUrl: './scoreboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreboardComponent {
  /** Null until the first game has loaded, e.g. while the server is unreachable. */
  readonly scoreboard = input.required<Scoreboard | null>();

  readonly resetScoreboard = output<void>();
}
