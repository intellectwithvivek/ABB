import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ErrorToastComponent } from '../../shared/ui/error-toast/error-toast.component';
import { BoardComponent } from './components/board/board.component';
import { ControlsComponent } from './components/controls/controls.component';
import { MoveHistoryComponent } from './components/move-history/move-history.component';
import { ScoreboardComponent } from './components/scoreboard/scoreboard.component';
import { StatusBarComponent } from './components/status-bar/status-bar.component';
import { GameStore } from './state/game.store';

/** The /play page: binds the store's signals to the components and their events to the store. */
@Component({
  selector: 'app-game-page',
  imports: [
    BoardComponent,
    ControlsComponent,
    ErrorToastComponent,
    MoveHistoryComponent,
    ScoreboardComponent,
    StatusBarComponent,
  ],
  templateUrl: './game-page.component.html',
  styleUrl: './game-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePageComponent implements OnInit {
  // `protected`: used by the template only, not part of the component's public API.
  protected readonly store = inject(GameStore);

  ngOnInit(): void {
    this.store.init();
  }
}
