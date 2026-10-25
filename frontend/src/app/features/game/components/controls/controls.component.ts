import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GAME_MODE_LABELS } from '../../models/game-mode-labels';
import { GameMode } from '../../models/game.models';

/** Mode picker, New Game, Undo and Reset. Emits intents only; the store decides what happens. */
@Component({
  selector: 'app-controls',
  templateUrl: './controls.component.html',
  styleUrl: './controls.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsComponent {
  readonly selectedMode = input.required<GameMode>();
  /** Mode of the game on screen; null until the first game has loaded. */
  readonly activeMode = input.required<GameMode | null>();
  readonly canUndo = input(false);
  readonly canReset = input(false);
  /**
   * A request is running. Only the mode picker is locked: the buttons stay enabled so they keep
   * keyboard focus, and the store ignores clicks until the response arrives.
   */
  readonly busy = input(false);

  readonly modeSelected = output<GameMode>();
  readonly newGame = output<void>();
  readonly undo = output<void>();
  readonly resetGame = output<void>();

  protected readonly modes: GameMode[] = ['TwoPlayer', 'VsComputer'];
  protected readonly modeLabels = GAME_MODE_LABELS;

  // Switching the mode never changes the game in progress; it only takes effect on New Game.
  protected readonly modeChangePending = computed(
    () => this.activeMode() !== null && this.selectedMode() !== this.activeMode(),
  );

  // Undo is locked with aria-disabled, like the board cells: the last undo makes it unavailable,
  // and a natively disabled button would drop the keyboard focus that just pressed it.
  protected requestUndo(): void {
    if (this.canUndo()) {
      this.undo.emit();
    }
  }
}
