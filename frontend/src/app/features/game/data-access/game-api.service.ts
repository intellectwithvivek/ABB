import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { GameMode, GameState, MoveRequest, Scoreboard } from '../models/game.models';

/** Thin HTTP wrapper around the backend REST API: one method per endpoint, no logic. */
@Injectable({ providedIn: 'root' })
export class GameApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;
  private readonly gamesUrl = `${this.apiBaseUrl}/games`;
  private readonly scoreboardUrl = `${this.apiBaseUrl}/scoreboard`;

  createGame(mode: GameMode): Observable<GameState> {
    return this.http.post<GameState>(this.gamesUrl, { mode });
  }

  getGame(gameId: string): Observable<GameState> {
    return this.http.get<GameState>(`${this.gamesUrl}/${gameId}`);
  }

  submitMove(gameId: string, move: MoveRequest): Observable<GameState> {
    return this.http.post<GameState>(`${this.gamesUrl}/${gameId}/moves`, move);
  }

  undoMove(gameId: string): Observable<GameState> {
    return this.http.post<GameState>(`${this.gamesUrl}/${gameId}/undo`, null);
  }

  resetGame(gameId: string): Observable<GameState> {
    return this.http.post<GameState>(`${this.gamesUrl}/${gameId}/reset`, null);
  }

  resetScoreboard(): Observable<Scoreboard> {
    return this.http.post<Scoreboard>(`${this.scoreboardUrl}/reset`, null);
  }
}
