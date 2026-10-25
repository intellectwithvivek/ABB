# Requirements traceability

This document maps every requirement in the official brief ([PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md)) and in my specification ([SPEC_PROMPT.md](SPEC_PROMPT.md)) to the code that implements it and the tests that prove it. Use it to check one requirement quickly or to find the code behind it.

**How to read the tables**

- **Implementation** names the type and member and links to the file. On GitHub the link opens the source. In the review portal it opens the file on GitHub in a new tab.
- **Tests** are xUnit method names on the backend (`Method_Scenario_ExpectedOutcome`) and Vitest test titles on the frontend. Each one links to its test file. `%s` in a title marks a parameterised test that runs once per case.
- **Status**
  - **Met**: implemented and covered by an automated test.
  - **Met (manual)**: implemented and checked by hand (a smoke test or the browser). These requirements are about running or looking at the app, so they have no automated test.
- How this was checked: each file, member and test named here was read in the code and confirmed with a search. The test suites run with the commands in [How to run tests](../README.md#how-to-run-tests).

**Where things live**

| Layer | Folder | What it holds |
|---|---|---|
| Game rules | [backend/TicTacToe.Core/](../backend/TicTacToe.Core/) | `Board`; `GameEngine` (moves, turns, win and draw, undo); `ComputerPlayer`; `GameSession` (modes, Option A, recording each result once); `Scoreboard` |
| REST API | [backend/TicTacToe.Api/](../backend/TicTacToe.Api/) | Controllers, request and response contracts, `GameService` (one lock per game), in-memory repository, error handling |
| Backend tests | [backend/TicTacToe.Tests/](../backend/TicTacToe.Tests/) | `Core/` unit tests; `Api/` service tests and HTTP tests |
| Angular UI | [frontend/src/app/features/game/](../frontend/src/app/features/game/) | `GameStore` (signals), `GameApiService` (HttpClient), the board, cell, status-bar, controls, move-history and scoreboard components, each with a `.spec.ts` beside it |
| Hosting | [vercel.json][vercel.json], [render.yaml][render.yaml], [backend/Dockerfile][Dockerfile] | The site on Vercel, proxying `/api` and `/swagger` to the API container on Render |

## 1. Acceptance criteria

The brief's list, in its order.

| # | Criterion | Implementation | Tests | Status |
|---|---|---|---|---|
| 1 | The Angular application runs locally | `npm start` in `frontend/` serves the app on `http://localhost:4200`. In [package.json][package.json], `prestart` copies the docs and `start` runs `ng serve`. The API address is set in [environment.ts][environment.ts] | [`$url shows its page titled "$title"`][app.routes.spec] (each route renders its page); manual run | **Met (manual)** |
| 2 | The .NET API runs locally | `dotnet run --project TicTacToe.Api` serves `http://localhost:5000` ([launchSettings.json][launchSettings.json]). [Program.cs][Program.cs] calls `AddTicTacToeApi` / `UseTicTacToeApi` | Every test in [GamesApiTests][GamesApiTests] starts the real app in memory with `WebApplicationFactory<Program>`; [`Health_AppRunning_Returns200Healthy`][HealthCheckTests]; the 22-step curl run in [API.md › Smoke test](API.md#smoke-test-curl) | **Met** |
| 3 | The frontend communicates with the backend through REST APIs | [GameApiService][GameApiService] has one method per endpoint and reads `apiBaseUrl` from the `APP_CONFIG` token ([app-config.ts][app-config.ts]). Locally, CORS allows `http://localhost:4200` ([WebApplicationExtensions.UseTicTacToeApi][WebApplicationExtensions], `Cors:AllowedOrigins` in [appsettings.json][appsettings.json]); the deployed site calls the same-origin `/api`, which [vercel.json][vercel.json] proxies to the API ([environment.production.ts][environment.production.ts]) | [`createGame POSTs the mode to /games and returns the new game state`][game-api.service.spec] and the other endpoint tests in that file; [`sends a clicked cell as a move and renders the board and history the backend returns`][game-page.component.spec]; [`Preflight_FromFrontendOrigin_IsAllowed`][GamesApiTests] | **Met** |
| 4 | A new Tic Tac Toe game can be created | `POST /api/games` → [GamesController.CreateGame][GamesController] → [GameService.CreateGame][GameService] (201 + `Location`). In the UI, New Game in [ControlsComponent][ControlsComponent] → [GameStore.newGame][GameStore]; [GameStore.init][GameStore] creates a game on page load | [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests]; [`CreateGame_VsComputer_ReturnsEmptyGameWithXToMove`][GameServiceTests]; [`newGame creates a game in the selected mode`][game.store.spec]; [`starts a new game on load and shows that it is X to move`][game-page.component.spec] | **Met** |
| 5 | Two Player Mode works correctly | `GameMode.TwoPlayer`: [GameSession.PlayMove][GameSession] applies only the submitted move. The UI sends `player = game.currentPlayer` ([GameStore.play][GameStore]) | All of [GameSessionTests][GameSessionTests]; every HTTP test in [GamesApiTests][GamesApiTests] uses Two Player mode | **Met** |
| 6 | Computer Mode works correctly | [GameSession.PlayMove][GameSession] plays the computer's reply, chosen by [ComputerPlayer.ChooseMove][ComputerPlayer], in the same request | All of [GameSessionVsComputerTests][GameSessionVsComputerTests] and [ComputerPlayerTests][ComputerPlayerTests]; [`SubmitMove_VsComputer_ResponseIncludesComputerReply`][GameServiceTests]. Details in [§2.9](#29-basic-computer-mode) | **Met** |
| 7 | Turns alternate correctly | [GameEngine.CurrentPlayer][GameEngine] is derived from the move count | [`ApplyMove_ValidMove_PassesTurnToOtherPlayer`][GameEngineTests]; [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests]; [`sends a clicked cell as a move and renders the board and history the backend returns`][game-page.component.spec] (shows "Player O's turn") | **Met** |
| 8 | Invalid moves are handled correctly | [GameEngine.ApplyMove][GameEngine] validates every move ([§3.5](#35-move-validation)). [GameExceptionHandler][GameExceptionHandler] returns 400 problem+json, and [ErrorToastComponent][ErrorToastComponent] shows its `detail` | The tests in [§3.5](#35-move-validation); [`shows a rejected move in a toast and re-syncs the board with the server`][game-page.component.spec] | **Met** |
| 9 | Win detection works | [GameEngine.EvaluateOutcome][GameEngine] checks every line in [Board.Lines][Board] | [`ApplyMove_CompletesRow_WinsWithRowCells`][GameEngineTests] (rows 0–2); [`ApplyMove_CompletesColumn_WinsWithColumnCells`][GameEngineTests] (columns 0–2); [`ApplyMove_CompletesMainDiagonal_WinsWithDiagonalCells`][GameEngineTests]; [`ApplyMove_CompletesAntiDiagonal_WinsWithDiagonalCells`][GameEngineTests] | **Met** |
| 10 | Draw detection works | [GameEngine.EvaluateOutcome][GameEngine]: Draw when [Board.IsFull][Board] and no line is complete | [`ApplyMove_FillsBoardWithoutLine_EndsInDraw`][GameEngineTests]; [`ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`][GameEngineTests] | **Met** |
| 11 | Winning cells are highlighted | [GameEngine.WinningCells][GameEngine] → `winningCells`; [BoardComponent.isWinningCell][BoardComponent] → the `cell--winning` class on [CellComponent][CellComponent] | The win tests above check the cells; [`SubmitMove_WinningMove_ReturnsWinnerAndWinningCells`][GamesApiTests]; [`highlights only the winning cells`][board.component.spec] | **Met** |
| 12 | Move history is shown | [GameEngine.Moves][GameEngine] → `moveHistory` ([ResponseMapper][ResponseMapper]); table in [MoveHistoryComponent][MoveHistoryComponent] | [`ApplyMove_ValidMove_PlacesMarkAndRecordsMove`][GameEngineTests]; [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests]; [`lists each move with its number, player and 1-based position`][move-history.component.spec] | **Met** |
| 13 | Undo works according to the selected mode | [GameSession.Undo][GameSession] | [`Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`][GameSessionTests]; [`Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`][GameSessionVsComputerTests]; [`Undo_TwoPlayer_Returns200WithLastMoveRemoved`][GamesApiTests]; [`Undo_VsComputer_RemovesBothMovesAndReturnsXToMove`][GameServiceTests]. Details in [§2.7](#27-undo-last-move) | **Met** |
| 14 | Scoreboard works correctly | [Scoreboard][Scoreboard] (thread-safe singleton) and [GameSession.RecordResultIfFinished][GameSession] | [`PlayMove_GameWon_RecordsWinExactlyOnce`][GameSessionTests]; [`PlayMove_GameDrawn_RecordsDrawExactlyOnce`][GameSessionTests]; [`GetScoreboard_AfterXWins_ReturnsOneXWin`][GamesApiTests]. Details in [§2.8](#28-scoreboard) | **Met** |
| 15 | Reset Game works correctly | [GameSession.Reset][GameSession]; `POST /api/games/{id}/reset` | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests]; [`Reset_AfterMove_Returns200WithEmptyBoardAndSameId`][GamesApiTests]; [`resetGame sends the game id and shows the fresh board`][game.store.spec]. Details in [§2.5](#25-reset-game) | **Met** |
| 16 | Reset Scoreboard works correctly | [ScoreboardController.ResetScoreboard][ScoreboardController] → [Scoreboard.Reset][Scoreboard]; the button in [ScoreboardComponent][ScoreboardComponent] → [GameStore.resetScoreboard][GameStore] | [`Reset_AfterResults_ZeroesAllCounters`][ScoreboardTests]; [`ResetScoreboard_AfterXWins_ReturnsAndKeepsZeroedScoreboard`][GamesApiTests]; [`resetScoreboard replaces only the scoreboard part of the snapshot`][game.store.spec]; [`emits resetScoreboard when Reset Scoreboard is clicked`][scoreboard.component.spec] | **Met** |
| 17 | Basic tests are included | xUnit in [backend/TicTacToe.Tests/](../backend/TicTacToe.Tests/); Vitest `*.spec.ts` files next to the frontend code | See [§6](#6-testing-expectations) | **Met** |
| 18 | README explains how to run and review the solution | [README.md](../README.md): the sections [SPEC_PROMPT.md](SPEC_PROMPT.md) §7 requires, in its order, with PowerShell commands, a quick start and the live URLs | Manual: the README commands were run in the final verification | **Met (manual)** |
| 19 | Candidate can explain the implementation during panel review | Code comments explain *why*; [ARCHITECTURE.md](ARCHITECTURE.md); [API.md](API.md); [DECISIONS.md](DECISIONS.md); [TESTING.md](TESTING.md); [AI_WORKFLOW.md](AI_WORKFLOW.md); the [Design Q&A](PANEL_QA.md); this document | — | **Met (manual)** |

## 2. Functional requirements and must-haves

### 2.1 Game board

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| Standard 3 × 3 board | [Board.Size][Board] = 3 and [Board.AllPositions][Board]; [ResponseMapper.ToRows][ResponseMapper] sends `board[row][col]`; [BoardComponent][BoardComponent] renders 9 [CellComponent][CellComponent]s in a CSS grid | [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests] (empty 3 × 3 `board`); [`renders 9 cells`][board.component.spec] | **Met** |
| Each cell is clickable when it is empty | [CellComponent.locked][CellComponent] (board disabled or cell occupied) sets `aria-disabled` on the `<button>` and makes it ignore clicks. The native `disabled` attribute is not used, so a keyboard user keeps focus on the board. [BoardComponent][BoardComponent] emits `cellSelected` with the row and column | [`disables occupied cells and keeps empty cells playable`][board.component.spec]; [`emits cellSelected with the row and column of a clicked empty cell`][board.component.spec]; [`emits selected when an empty, enabled cell is clicked`][cell.component.spec]; [`locks %s without the native disabled attribute, so it keeps focus`][cell.component.spec] | **Met** |
| A played cell shows X or O | The [Board][Board] indexer → `board` in the JSON; [CellComponent][CellComponent] shows the mark with the `cell--x` / `cell--o` class | [`shows X and O in the cells that hold them`][board.component.spec]; [`styles a %s cell with the %s class`][cell.component.spec]; [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] | **Met** |
| A played cell stays locked for the rest of the game | The backend rejects an occupied cell ([GameEngine.ApplyMove][GameEngine]); [Board.Place][Board] guards the same invariant; in the UI, [CellComponent.locked][CellComponent] | [`ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`][GameEngineTests]; [`SubmitMove_OccupiedCell_Returns400ProblemWithDetail`][GamesApiTests]; [`does not emit when an occupied cell is clicked`][board.component.spec] | **Met** |

### 2.2 Player turns

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| Two players, X and O | [Player][Player] enum `{ X, O }`; the JSON sends `"X"` / `"O"` | Every move test | **Met** |
| The UI clearly shows whose turn it is | [StatusBarComponent.message][StatusBarComponent]: "Player X's turn" (Two Player) or "Your turn (X)" (Vs Computer). The text is large, coloured by player and announced (`aria-live`) | [`shows "%s"`][status-bar.component.spec] (cases "Player O's turn" and "Your turn (X)"); [`starts a new game on load and shows that it is X to move`][game-page.component.spec] | **Met** |
| Turns alternate after every valid move | [GameEngine.CurrentPlayer][GameEngine] `=> Moves.Count % 2 == 0 ? X : O` | [`ApplyMove_ValidMove_PassesTurnToOtherPlayer`][GameEngineTests]; [`SubmitMove_ValidMove_MapsBoardHistoryAndTurn`][GameServiceTests]; [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] | **Met** |
| Invalid moves do not change the turn | [GameEngine.ApplyMove][GameEngine] checks every rule before it changes anything, and the turn is derived from the history | [`ApplyMove_OutsideBoard_ThrowsAndKeepsTurn`][GameEngineTests], [`ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`][GameEngineTests] and [`ApplyMove_WrongPlayer_ThrowsAndKeepsTurn`][GameEngineTests] (each checks that turn, board and history are unchanged); [`PlayMove_SubmittedAsO_ThrowsAndChangesNothing`][GameSessionVsComputerTests]; [`SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame`][GamesApiTests]; [`shows why a move was rejected next to the board the server actually has`][game.store.spec] | **Met** |

### 2.3 Win detection

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| A full row wins | [Board.Lines][Board] (the 3 rows, the 3 columns and the 2 diagonals, written out); [GameEngine.EvaluateOutcome][GameEngine] / `IsCompletedLine` | [`ApplyMove_CompletesRow_WinsWithRowCells`][GameEngineTests] (rows 0, 1, 2) | **Met** |
| A full column wins | Same | [`ApplyMove_CompletesColumn_WinsWithColumnCells`][GameEngineTests] (columns 0, 1, 2) | **Met** |
| A diagonal wins | Same | [`ApplyMove_CompletesMainDiagonal_WinsWithDiagonalCells`][GameEngineTests]; [`ApplyMove_CompletesAntiDiagonal_WinsWithDiagonalCells`][GameEngineTests] (O wins) | **Met** |
| Show the winning player | [GameEngine.Winner][GameEngine] → `winner`; [StatusBarComponent][StatusBarComponent] shows "Player X wins!", or in Vs Computer mode "You win!" / "Computer wins!" | The win tests check `Winner`; [`SubmitMove_WinningMove_ReturnsWinnerAndWinningCells`][GamesApiTests]; [`shows "%s"`][status-bar.component.spec] (cases "Player X wins!", "You win!" and "Computer wins!") | **Met** |
| Highlight the winning cells | [GameEngine.WinningCells][GameEngine] → `winningCells`; [BoardComponent.isWinningCell][BoardComponent]; the `.cell--winning` style in [cell.component.css][cell.component.css] | [`highlights only the winning cells`][board.component.spec]; [`SubmitMove_WinningMove_MapsWinnerWinningCellsAndScoreboard`][GameServiceTests] | **Met** |
| Prevent more moves in the finished game | [GameEngine.ApplyMove][GameEngine] checks "game over" first. In the UI, [GameStore.canPlay][GameStore] is false, so every cell is locked | [`ApplyMove_AfterGameWon_ThrowsGameOver`][GameEngineTests]; [`SubmitMove_AfterWin_Returns400ProblemWithDetail`][GamesApiTests]; [`disables every cell when the game is over`][board.component.spec]; [`blocks playing and undoing once the backend reports the game is over`][game.store.spec] | **Met** |
| Update the scoreboard | [GameSession.RecordResultIfFinished][GameSession] → `IScoreboardService.RecordWin`. The totals are in the same response | [`PlayMove_GameWon_RecordsWinExactlyOnce`][GameSessionTests]; [`PlayMove_ComputerCompletesLine_RecordsComputerWin`][GameSessionVsComputerTests]; [`SubmitMove_WinningMove_MapsWinnerWinningCellsAndScoreboard`][GameServiceTests] | **Met** |

### 2.4 Draw detection

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| 9 cells filled and no winner means a draw | [GameEngine.EvaluateOutcome][GameEngine] checks for a win first, then [Board.IsFull][Board] → Draw, so a ninth move that completes a line is a win | [`ApplyMove_FillsBoardWithoutLine_EndsInDraw`][GameEngineTests]; [`ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`][GameEngineTests] | **Met** |
| Show a draw message | [StatusBarComponent][StatusBarComponent]: "It's a draw!" | [`shows "%s"`][status-bar.component.spec] (case "It's a draw!") | **Met** |
| Prevent more moves in the finished game | Same check as for a win | [`ApplyMove_AfterDraw_ThrowsGameOver`][GameEngineTests] | **Met** |
| Update the scoreboard | [GameSession.RecordResultIfFinished][GameSession] → `RecordDraw` | [`PlayMove_GameDrawn_RecordsDrawExactlyOnce`][GameSessionTests]; [`PlayMove_HumanFillsLastCell_ComputerDoesNotMove`][GameSessionVsComputerTests] | **Met** |

### 2.5 Reset Game

Path: Reset Game in [ControlsComponent][ControlsComponent] → [GameStore.resetGame][GameStore] → `POST /api/games/{id}/reset` → [GameService.Reset][GameService] → [GameSession.Reset][GameSession] → [GameEngine.Reset][GameEngine].

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| Clear the board | `Board.ClearAll` in [GameEngine.Reset][GameEngine] | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests]; [`Reset_AfterMove_Returns200WithEmptyBoardAndSameId`][GamesApiTests] | **Met** |
| Clear the move history | `_moves.Clear()` in [GameEngine.Reset][GameEngine] | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests]; [`Reset_AfterWin_KeepsIdAndModeAndScoreboard`][GameServiceTests] | **Met** |
| Clear the winner or draw status | [GameEngine.Reset][GameEngine] re-evaluates the empty board → InProgress, no winner, no winning cells | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests] | **Met** |
| Set the current player back to X | Derived: zero moves means X | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests] (after X's fifth move it would be O's turn); [`Reset_AfterMove_Returns200WithEmptyBoardAndSameId`][GamesApiTests] | **Met** |
| Start a fresh game session | The game starts over under the **same** id and mode (SPEC_PROMPT: one game session = one game id). [GameSession.Reset][GameSession] also re-arms the "result recorded" guard, so the next result counts. New Game creates a new id | [`Reset_GameInProgress_KeepsIdAndMode`][GameSessionTests]; [`Reset_ThenNextGameEnds_RecordsNextResultToo`][GameSessionTests]; [`Reset_AfterWin_KeepsIdAndModeAndScoreboard`][GameServiceTests] | **Met** (interpretation, see [§5.3](#53-decisions-taken-in-the-specification)) |
| Keep the scoreboard unchanged | [GameSession.Reset][GameSession] never touches `IScoreboardService` | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests]; [`PlayMove_GameWon_RecordsWinExactlyOnce`][GameSessionTests]; [`Reset_AfterWin_KeepsIdAndModeAndScoreboard`][GameServiceTests] | **Met** |
| UI wiring | [ControlsComponent][ControlsComponent], [GameStore.resetGame][GameStore], [GameApiService.resetGame][GameApiService] | [`emits undo, resetGame and newGame when their buttons are clicked`][controls.component.spec]; [`resetGame sends the game id and shows the fresh board`][game.store.spec]; [`resetGame POSTs to /games/{id}/reset without a body`][game-api.service.spec] | **Met** |

### 2.6 Move history

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| Show the move history of the current game | [MoveHistoryComponent][MoveHistoryComponent] renders [GameStore.moves][GameStore] (the snapshot's `moveHistory`); "No moves yet" when empty | [`shows "No moves yet" and no table before the first move`][move-history.component.spec]; [`lists each move with its number, player and 1-based position`][move-history.component.spec] | **Met** |
| Each move shows its number, player and cell position | [Move][Move]`(MoveNumber, Player, Position)` → `MoveDto { moveNumber, player, row, col }` ([ResponseMapper][ResponseMapper]); columns "Move", "Player", "Position" | [`ApplyMove_ValidMove_PlacesMarkAndRecordsMove`][GameEngineTests]; [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] | **Met** |
| Position written as in the example ("Row 1, Column 1") | The API is 0-based; the template adds 1: `Row {{ move.row + 1 }}, Column {{ move.col + 1 }}` | [`lists each move with its number, player and 1-based position`][move-history.component.spec]; [`sends a clicked cell as a move and renders the board and history the backend returns`][game-page.component.spec] ("Row 2, Column 2") | **Met** |
| Updates after every valid move | Every game endpoint returns the full state, including `moveHistory`; [GameStore][GameStore] shows each new snapshot | [`SubmitMove_VsComputer_ResponseIncludesComputerReply`][GameServiceTests] (both moves in one response); [`sends a clicked cell as a move and renders the board and history the backend returns`][game-page.component.spec] | **Met** |

### 2.7 Undo Last Move

Path: Undo Last Move in [ControlsComponent][ControlsComponent] → [GameStore.undo][GameStore] → `POST /api/games/{id}/undo` → [GameService.Undo][GameService] → [GameSession.Undo][GameSession] → [GameEngine.UndoLastMove][GameEngine].

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| An Undo Last Move option | The button in [ControlsComponent][ControlsComponent]; [GameApiService.undoMove][GameApiService] | [`emits undo, resetGame and newGame when their buttons are clicked`][controls.component.spec]; [`undo sends the game id and shows the restored state`][game.store.spec]; [`undoMove POSTs to /games/{id}/undo without a body`][game-api.service.spec] | **Met** |
| Remove the latest move, or the latest pair, depending on the mode | [GameSession.Undo][GameSession]: one `UndoLastMove`, plus a second one in Vs Computer mode when it would otherwise be the computer's turn | See the two examples below | **Met** |
| Restore the board | [GameEngine.UndoLastMove][GameEngine] clears the undone move's cell | [`Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`][GameSessionTests]; [`Undo_VsComputer_RemovesBothMovesAndReturnsXToMove`][GameServiceTests] | **Met** |
| Restore the correct turn | [GameEngine.CurrentPlayer][GameEngine] is derived from the move count, so it can never be stale | [`Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`][GameSessionTests] (O); [`Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`][GameSessionVsComputerTests] (X) | **Met** |
| Recalculate the win or draw status | [GameEngine.UndoLastMove][GameEngine] calls `EvaluateOutcome` | [`UndoLastMove_AfterWinningMove_RecalculatesStatusToInProgress`][GameEngineTests]. This test is at engine level because under Option A the session rejects undo once the game has ended | **Met** |
| Keep the move history accurate | The last [Move][Move] is removed; the next move is numbered `Moves.Count + 1` | [`Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`][GameSessionTests]; [`PlayMove_AfterUndo_ContinuesMoveNumbering`][GameSessionTests]; [`Undo_AfterTwoRounds_RemovesOnlyLastPair`][GameSessionVsComputerTests]; [`Undo_TwoPlayer_Returns200WithLastMoveRemoved`][GamesApiTests] | **Met** |
| Disabled when there are no moves to undo | [GameSession.CanUndo][GameSession] → `canUndo`; the button binds `[disabled]="!canUndo()"`; the backend also rejects it with "There are no moves to undo." | [`Undo_NoMoves_ThrowsNothingToUndo`][GameSessionTests]; [`Undo_NoMoves_Returns400ProblemWithDetail`][GamesApiTests]; [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests] (`canUndo: false`); [`disables Undo Last Move when there is nothing to undo`][controls.component.spec] | **Met** |
| **Two Player example:** X plays, O plays, Undo → O's move is removed and it is O's turn again | [GameSession.Undo][GameSession] (one move) | [`Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`][GameSessionTests] (exactly this sequence); [`Undo_TwoPlayer_Returns200WithLastMoveRemoved`][GamesApiTests] (over HTTP) | **Met** |
| **Computer example:** X plays, the computer plays O, Undo → both moves are removed and it is X's turn again | [GameSession.Undo][GameSession] (the pair) | [`Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`][GameSessionVsComputerTests] (exactly this sequence); [`Undo_AfterTwoRounds_RemovesOnlyLastPair`][GameSessionVsComputerTests]; [`Undo_VsComputer_RemovesBothMovesAndReturnsXToMove`][GameServiceTests]; [`Undo_VsComputer_Returns200WithBothMovesRemoved`][GamesApiTests] (over HTTP) | **Met** |

### 2.8 Scoreboard

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| A session-level scoreboard | One [Scoreboard][Scoreboard] per server process, registered as a singleton in [ServiceCollectionExtensions.AddGameServices][ServiceCollectionExtensions] and shared by every game | [`GetGame_AfterAnotherGameEnded_ReturnsSharedScoreboard`][GameServiceTests] | **Met** ("session" = the server's lifetime, see [§5.3](#53-decisions-taken-in-the-specification)) |
| Track X wins, O wins and draws | `ScoreSnapshot(XWins, OWins, Draws)` → `{ xWins, oWins, draws }`; [ScoreboardComponent][ScoreboardComponent] | [`RecordWin_PlayerX_IncrementsOnlyXWins`][ScoreboardTests]; [`RecordWin_PlayerO_IncrementsOnlyOWins`][ScoreboardTests]; [`RecordDraw_Once_IncrementsOnlyDraws`][ScoreboardTests]; [`shows X wins, O wins and draws from the backend`][scoreboard.component.spec] | **Met** |
| Updates when a game is completed | [GameSession.RecordResultIfFinished][GameSession] runs after every applied move, the human's and the computer's | [`PlayMove_GameWon_RecordsWinExactlyOnce`][GameSessionTests]; [`PlayMove_GameDrawn_RecordsDrawExactlyOnce`][GameSessionTests]; [`PlayMove_ComputerCompletesLine_RecordsComputerWin`][GameSessionVsComputerTests]; [`GetScoreboard_AfterXWins_ReturnsOneXWin`][GamesApiTests] | **Met** |
| Updates only once per completed game | The `_resultRecorded` guard in [GameSession][GameSession]; a finished game also rejects moves and undo | [`PlayMove_GameWon_RecordsWinExactlyOnce`][GameSessionTests] and [`PlayMove_GameDrawn_RecordsDrawExactlyOnce`][GameSessionTests] (another move, an undo and a reset add nothing); [`PlayMove_ScoreboardResetMidGame_RecordsResultOnce`][GameSessionTests]; [`PlayMove_EveryPossibleGame_ComputerRepliesOnlyWhileInProgressAndResultIsRecordedOnce`][GameSessionVsComputerTests] (all 489 games against the computer) | **Met** |
| Reset Game leaves it unchanged | See [§2.5](#25-reset-game) | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests] | **Met** |
| A separate Reset Scoreboard option | `POST /api/scoreboard/reset` ([ScoreboardController.ResetScoreboard][ScoreboardController]); its own button in [ScoreboardComponent][ScoreboardComponent], apart from Reset Game | [`Reset_AfterResults_ZeroesAllCounters`][ScoreboardTests]; [`ResetScoreboard_AfterXWins_ReturnsAndKeepsZeroedScoreboard`][GamesApiTests]; [`emits resetScoreboard when Reset Scoreboard is clicked`][scoreboard.component.spec]; [`resetScoreboard POSTs to /scoreboard/reset and returns the zeroed scoreboard`][game-api.service.spec] | **Met** |
| Served by the backend | `GET /api/scoreboard` ([ScoreboardController.GetScoreboard][ScoreboardController]) and `scoreboard` in every game state | [`GetScoreboard_AfterXWins_ReturnsOneXWin`][GamesApiTests]; [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests] | **Met** |
| Correct under parallel games (SPEC_PROMPT) | One private lock guards the three counters in [Scoreboard][Scoreboard] | [`RecordResults_CalledInParallel_CountsEveryCall`][ScoreboardTests] | **Met** |

### 2.9 Basic computer mode

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| Two modes: Two Player and Play Against Computer | [GameMode][GameMode] `{ TwoPlayer, VsComputer }`, chosen in [CreateGameRequest][CreateGameRequest]; the mode picker in [ControlsComponent][ControlsComponent] | [`CreateGame_VsComputer_ReturnsEmptyGameWithXToMove`][GameServiceTests]; [`emits modeSelected when a mode is picked`][controls.component.spec]; [`newGame creates a game in the selected mode`][game.store.spec] | **Met** |
| In Two Player mode, users control both X and O | [GameSession.PlayMove][GameSession] applies only the submitted move | [`Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`][GameSessionTests]; [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] | **Met** |
| The human is X and the computer is O | `Computer = Player.O` in [GameSession][GameSession]; X always starts, so a request sent as O is a wrong-player move | [`PlayMove_HumanMoves_ComputerRepliesInSameCall`][GameSessionVsComputerTests]; [`PlayMove_SubmittedAsO_ThrowsAndChangesNothing`][GameSessionVsComputerTests] | **Met** |
| The computer moves automatically after the human's move | [GameSession.PlayMove][GameSession] plays the reply in the same call, so the response already contains it | [`PlayMove_HumanMoves_ComputerRepliesInSameCall`][GameSessionVsComputerTests]; [`SubmitMove_VsComputer_ResponseIncludesComputerReply`][GameServiceTests] | **Met** |
| The computer makes only valid moves | [ComputerPlayer.ChooseMove][ComputerPlayer] picks only empty cells, and its move still goes through all of [GameEngine.ApplyMove][GameEngine]'s checks | Every [ComputerPlayerTests][ComputerPlayerTests] case; [`PlayMove_HumanFillsLastCell_ComputerDoesNotMove`][GameSessionVsComputerTests] (a whole game against the computer); [`PlayMove_EveryPossibleGame_ComputerRepliesOnlyWhileInProgressAndResultIsRecordedOnce`][GameSessionVsComputerTests] (every possible game) | **Met** |
| The computer does not move after the game has ended | [GameSession.PlayMove][GameSession] lets the computer move only while the status is InProgress | [`PlayMove_HumanCompletesLine_ComputerDoesNotMove`][GameSessionVsComputerTests]; [`PlayMove_HumanFillsLastCell_ComputerDoesNotMove`][GameSessionVsComputerTests]; [`PlayMove_EveryPossibleGame_ComputerRepliesOnlyWhileInProgressAndResultIsRecordedOnce`][GameSessionVsComputerTests] | **Met** |

The computer plays the first rule that applies ([ComputerPlayer.ChooseMove][ComputerPlayer]). The rules use no randomness. Each test board is chosen so that a later rule would pick a different cell, so a test fails if its rule is skipped.

| Priority (brief) | Implementation | Tests | Status |
|---|---|---|---|
| 1. If O can win, play the winning move | `FindLineCompletingMove(board, computer)`: a line with two of the computer's marks and one empty cell | [`ChooseMove_ComputerCanCompleteLine_PlaysWinningCell`][ComputerPlayerTests]; [`ChooseMove_CanWinAndMustBlock_PrefersWinning`][ComputerPlayerTests]; [`PlayMove_ComputerCompletesLine_RecordsComputerWin`][GameSessionVsComputerTests] | **Met** |
| 2. If X can win next, block X | `FindLineCompletingMove(board, computer.Opponent())` | [`ChooseMove_OpponentThreatensLine_BlocksThreat`][ComputerPlayerTests] | **Met** |
| 3. Take the center if it is free | `FindFirstEmpty(board, [Center])` | [`ChooseMove_CenterFree_TakesCenter`][ComputerPlayerTests] | **Met** |
| 4. Take a corner if one is free | `FindFirstEmpty(board, Corners)`, in the order (0,0), (0,2), (2,0), (2,2) | [`ChooseMove_CenterTaken_TakesFirstFreeCorner`][ComputerPlayerTests] | **Met** |
| 5. Take any free cell | `FindFirstEmpty(board, Board.AllPositions)`, row by row | [`ChooseMove_CenterAndCornersTaken_TakesFirstFreeCell`][ComputerPlayerTests] | **Met** |

## 3. Backend requirements

### 3.1 REST endpoints

The brief's suggested API, used exactly as written. The full contract is in [API.md](API.md#endpoints). Swagger UI at `/swagger` documents it from the controllers' `[ProducesResponseType]` attributes, and [TicTacToe.Api.http][TicTacToe.Api.http] has a sample request for every endpoint.

| Method and path | Controller action → service | Success | Errors | Tests |
|---|---|---|---|---|
| `POST /api/games` | [GamesController.CreateGame][GamesController] → [GameService.CreateGame][GameService] | 201 + `Location` | 400 | [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests] |
| `GET /api/games/{id}` | [GamesController.GetGame][GamesController] → [GameService.GetGame][GameService] | 200 | 404 | [`GetGame_CreatedGame_ReturnsSameGame`][GameServiceTests]; [`GetGame_UnknownId_Returns404Problem`][GamesApiTests] |
| `POST /api/games/{id}/moves` | [GamesController.SubmitMove][GamesController] → [GameService.SubmitMove][GameService] | 200 | 400, 404 | [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests]; [`SubmitMove_OccupiedCell_Returns400ProblemWithDetail`][GamesApiTests] |
| `POST /api/games/{id}/undo` | [GamesController.Undo][GamesController] → [GameService.Undo][GameService] | 200 | 400, 404 | [`Undo_TwoPlayer_Returns200WithLastMoveRemoved`][GamesApiTests]; [`Undo_AfterWin_Returns400Problem`][GamesApiTests] |
| `POST /api/games/{id}/reset` | [GamesController.Reset][GamesController] → [GameService.Reset][GameService] | 200 | 404 | [`Reset_AfterMove_Returns200WithEmptyBoardAndSameId`][GamesApiTests] |
| `GET /api/scoreboard` | [ScoreboardController.GetScoreboard][ScoreboardController] | 200 | — | [`GetScoreboard_AfterXWins_ReturnsOneXWin`][GamesApiTests] |
| `POST /api/scoreboard/reset` | [ScoreboardController.ResetScoreboard][ScoreboardController] | 200 | — | [`ResetScoreboard_AfterXWins_ReturnsAndKeepsZeroedScoreboard`][GamesApiTests] |

An unknown id gives 404 for every game endpoint: [`GameOperations_UnknownId_ThrowGameNotFound`][GameServiceTests]. The Swagger document is tested by [`SwaggerDocument_DefaultSettings_IsServed`][ConfigurationTests].

### 3.2 The backend owns the state

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| The backend owns the game session state, move history, game status and scoreboard | Games are [GameSession][GameSession] objects (each wraps a [GameEngine][GameEngine]) kept in [InMemoryGameRepository][InMemoryGameRepository]; the [Scoreboard][Scoreboard] is a singleton. The frontend only renders responses ([§5.1](#51-backend-state-ownership)) | [GameServiceTests][GameServiceTests] (real repository and scoreboard, no mocks) | **Met** |
| In-memory storage | [InMemoryGameRepository][InMemoryGameRepository] (`ConcurrentDictionary<Guid, …>`) behind [IGameRepository][IGameRepository]; the scoreboard behind [IScoreboardService][IScoreboardService], so a shared store can replace either for multi-instance hosting. Games idle for 2 hours are removed ([API.md › Idle games](API.md#idle-games)) | [`RemoveIdleSince_GamesUsedBeforeAndAfterCutoff_RemovesOnlyTheIdleOne`][InMemoryGameRepositoryTests] | **Met** |
| Concurrent requests for one game are safe (SPEC_PROMPT: lock per session) | [GameService.RunLocked][GameService] locks `GameSession.SyncRoot` and builds the response inside the lock | [`SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds`][GameServiceTests]; [`Undo_ParallelRequests_RemoveEachPairExactlyOnce`][GameServiceTests]; [`GetGame_WhileVsComputerMovesArePlayed_NeverSeesMoveWithoutReply`][GameServiceTests] | **Met** |

### 3.3 Game state response

Built by [ResponseMapper.ToGameState][ResponseMapper] into [GameStateResponse][GameStateResponse]. The constructor's parameter order fixes the JSON property order. Enums are sent as strings (`JsonStringEnumConverter` in [ServiceCollectionExtensions][ServiceCollectionExtensions]).

| Brief field | JSON property | Source | Tests |
|---|---|---|---|
| Game ID | `gameId` | `GameSession.Id` | [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests] (all property names, in order) |
| Board state | `board` (`board[row][col]`, `"X"`, `"O"` or `null`) | `ResponseMapper.ToRows(session.Board)` | Same test (empty board); [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] |
| Current player | `currentPlayer` | `GameSession.CurrentPlayer` | [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] |
| Game mode | `mode` | `GameSession.Mode` | [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests]; [`CreateGame_VsComputer_ReturnsEmptyGameWithXToMove`][GameServiceTests] |
| Game status (`InProgress`, `Won`, `Draw`) | `status` | `GameSession.Status` | [`SubmitMove_WinningMove_ReturnsWinnerAndWinningCells`][GamesApiTests] |
| Winner, if any | `winner` | `GameSession.Winner` | Same test; `null` on create |
| Winning cells, if any | `winningCells` (`[{ row, col }]`) | `GameSession.WinningCells` | [`SubmitMove_WinningMove_ReturnsWinnerAndWinningCells`][GamesApiTests] |
| Move history | `moveHistory` (`[{ moveNumber, player, row, col }]`) | `GameSession.Moves` | [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] |
| Scoreboard, or a way to retrieve it | `scoreboard` (`{ xWins, oWins, draws }`), and also `GET /api/scoreboard` | `ResponseMapper.ToScoreboard` | [`CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState`][GamesApiTests]; [`GetScoreboard_AfterXWins_ReturnsOneXWin`][GamesApiTests] |
| *(added)* whether undo is allowed | `canUndo` | `GameSession.CanUndo` | `false` on create, `true` after a move, `false` after a win, in the tests above |

### 3.4 Move request

| Brief field | Where it is sent | Implementation | Tests |
|---|---|---|---|
| Game ID | In the route: `POST /api/games/{id:guid}/moves` | [GamesController.SubmitMove][GamesController] | [`GameOperations_UnknownId_ThrowGameNotFound`][GameServiceTests] |
| Player | Body `player`: `"X"` or `"O"`, required; JSON numbers, and quoted numbers that name no player, are rejected | [SubmitMoveRequest][SubmitMoveRequest] (`required`, `[EnumDataType]`) | [`SubmitMove_PlayerNotXOrO_Returns400WithSingleErrorForPlayer`][GamesApiTests]; [`SubmitMove_PlayerAsNumericString_Returns400AndKeepsGame`][GamesApiTests] |
| Row and column | Body `row` and `col`, 0-based, required | [SubmitMoveRequest][SubmitMoveRequest] (`required`; the range is checked in Core, not with `[Range]`) | [`SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame`][GamesApiTests] |

### 3.5 Move validation

[GameEngine.ApplyMove][GameEngine] checks the rules in this order and reports the first one that fails as a `GameRuleException`. [GameExceptionHandler][GameExceptionHandler] turns it into **400** problem+json with the message as `detail`. A rejected move changes nothing.

| Rule (brief) | Check | `detail` | Core tests | HTTP tests | Status |
|---|---|---|---|---|---|
| Move after the game has ended | `IsOver` | `The game is already over. Reset the game or start a new one.` | [`ApplyMove_AfterGameWon_ThrowsGameOver`][GameEngineTests]; [`ApplyMove_AfterDraw_ThrowsGameOver`][GameEngineTests] | [`SubmitMove_AfterWin_Returns400ProblemWithDetail`][GamesApiTests]; smoke test step 13 in [API.md](API.md#smoke-test-curl) | **Met** |
| Move outside the board | `Board.IsOnBoard` | `Row and column must be between 0 and 2 (got row 3, col 0).` | [`ApplyMove_OutsideBoard_ThrowsAndKeepsTurn`][GameEngineTests] (row or col of -1 or 3); [`IsOnBoard_Position_TrueOnlyForRowsAndColumnsZeroToTwo`][BoardTests] | [`SubmitMove_OutsideBoard_Returns400ProblemWithDetail`][GamesApiTests]; smoke test step 7 | **Met** |
| Move by the wrong player | `player != CurrentPlayer` | `It is O's turn, not X's.` | [`ApplyMove_WrongPlayer_ThrowsAndKeepsTurn`][GameEngineTests]; [`PlayMove_SubmittedAsO_ThrowsAndChangesNothing`][GameSessionVsComputerTests] | [`SubmitMove_RejectedMoveFromFrontendOrigin_ErrorCarriesCorsHeader`][GamesApiTests] (O sent on X's turn) | **Met** |
| Move on an occupied cell | `_board[position] is Player` | `Cell (row 0, col 0) is already taken by X.` | [`ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`][GameEngineTests] | [`SubmitMove_OccupiedCell_Returns400ProblemWithDetail`][GamesApiTests] | **Met** |
| *(added)* Malformed body | `[ApiController]`, `required` properties, string-only enums and `[EnumDataType]` | ASP.NET Core's `ValidationProblemDetails`, with one `errors` entry | — | [`SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame`][GamesApiTests]; [`SubmitMove_PlayerNotXOrO_Returns400WithSingleErrorForPlayer`][GamesApiTests]; [`CreateGame_MissingOrUnknownMode_Returns400WithSingleErrorAndStoresNoGame`][GamesApiTests]; [`CreateGame_TextPlainBody_Returns415Problem`][GamesApiTests] (415) | **Met** |
| *(added)* Unknown game id | [GameService.RunLocked][GameService] → `GameNotFoundException` → **404** | `Game '…' was not found.` | [`GameOperations_UnknownId_ThrowGameNotFound`][GameServiceTests] | [`GetGame_UnknownId_Returns404Problem`][GamesApiTests]; [`GetGame_IdNotAGuid_Returns404Problem`][GamesApiTests] | **Met** |

## 4. Frontend requirements

The page is [GamePageComponent][GamePageComponent]. It passes [GameStore][GameStore]'s signals to the components and sends their events back to the store. Every action goes through [GameApiService][GameApiService] to the backend.

| UI element (brief) | Component | Tests | Status |
|---|---|---|---|
| Game board | [BoardComponent][BoardComponent] and [CellComponent][CellComponent] | [`renders 9 cells`][board.component.spec] and the other tests in [board.component.spec][board.component.spec] and [cell.component.spec][cell.component.spec] | **Met** |
| Current player | [StatusBarComponent][StatusBarComponent] | [`shows "%s"`][status-bar.component.spec] | **Met** |
| Selected game mode | The mode picker in [ControlsComponent][ControlsComponent] (it shows "Mode applies when you start a new game." while the pick differs from the game on screen) and the mode badge in [StatusBarComponent][StatusBarComponent] | [`emits modeSelected when a mode is picked`][controls.component.spec]; [`explains that a newly picked mode applies only to the next game`][controls.component.spec]; [`shows no hint while the picked mode matches the game on screen`][controls.component.spec]; [`shows the active game's mode`][status-bar.component.spec] | **Met** |
| Winner or draw message | [StatusBarComponent][StatusBarComponent] | [`shows "%s"`][status-bar.component.spec] | **Met** |
| Highlighted winning cells | [BoardComponent.isWinningCell][BoardComponent] → [CellComponent][CellComponent] `highlighted` → `.cell--winning` | [`highlights only the winning cells`][board.component.spec] | **Met** |
| Move history | [MoveHistoryComponent][MoveHistoryComponent] | [`lists each move with its number, player and 1-based position`][move-history.component.spec]; [`shows "No moves yet" and no table before the first move`][move-history.component.spec] | **Met** |
| Scoreboard | [ScoreboardComponent][ScoreboardComponent] | [`shows X wins, O wins and draws from the backend`][scoreboard.component.spec]; [`shows placeholders until the first game has loaded`][scoreboard.component.spec] | **Met** |
| Reset Game button | [ControlsComponent][ControlsComponent] | [`emits undo, resetGame and newGame when their buttons are clicked`][controls.component.spec] | **Met** |
| Undo Last Move button | [ControlsComponent][ControlsComponent], disabled unless the backend's `canUndo` is true | [`disables Undo Last Move when there is nothing to undo`][controls.component.spec] | **Met** |
| Reset Scoreboard button | [ScoreboardComponent][ScoreboardComponent], disabled until a scoreboard has loaded | [`emits resetScoreboard when Reset Scoreboard is clicked`][scoreboard.component.spec]; [`disables Reset Scoreboard while no scoreboard has loaded, e.g. with the server down`][scoreboard.component.spec] | **Met** |
| *(SPEC_PROMPT)* New Game control | [ControlsComponent][ControlsComponent] → [GameStore.newGame][GameStore] | [`emits undo, resetGame and newGame when their buttons are clicked`][controls.component.spec]; [`locks only the mode picker while a request is running, so New Game keeps focus`][controls.component.spec]; [`newGame creates a game in the selected mode`][game.store.spec] | **Met** |
| *(SPEC_PROMPT)* API errors in a small non-blocking toast | [ErrorToastComponent][ErrorToastComponent] (`role="alert"`; it stays until the player closes it or the next request clears it); [toErrorMessage][api-error.ts] picks `detail`, then the first validation error, then `title`, and explains an unreachable or starting-up server (status 0, 502, 503, 504) in plain words | [`shows the message as an alert`][error-toast.component.spec]; [`stays on screen until it is dismissed, however long it takes to read`][error-toast.component.spec]; every test in [api-error.spec][api-error.spec]; [`shows a rejected move in a toast and re-syncs the board with the server`][game-page.component.spec] | **Met** |
| *(SPEC_PROMPT)* Loading state | [GameStore.loading][GameStore]: while a request runs, the store ignores further actions and "Working…" shows in [StatusBarComponent][StatusBarComponent]. The buttons stay enabled so they keep keyboard focus; only the mode picker is locked | [`sets loading but leaves the actions available, so the focused control keeps focus`][game.store.spec]; [`ignores further actions, so a double click sends only one request`][game.store.spec]; [`shows a loading message and the working indicator before the first game arrives`][status-bar.component.spec] | **Met** |
| Call the backend for game actions and render the latest state it returns | [GameStore][GameStore]: `runGameRequest` → `showGame` stores each snapshot as it is; nothing is computed locally | [`sends the move for the player whose turn the backend reported and shows the reply`][game.store.spec]; the wiring tests in [game-page.component.spec][game-page.component.spec] (real store, service and components; only the network is replaced) | **Met** |
| A clean, usable interface | Design tokens in [styles.css][styles.css]; hover, disabled and focus states in [cell.component.css][cell.component.css] | — | **Met (manual)** |
| Responsive enough for a laptop browser | Two columns, which stack below 760 px ([game-page.component.css][game-page.component.css]) | — | **Met (manual)** |

## 5. Clarifications

### 5.1 Backend state ownership

Clarification 1 of the brief.

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| The backend is the source of truth for the game state | Every game endpoint returns the full `GameState`. [GameStore.game][GameStore] is read-only for components and is only replaced by a server response. After a rejected action the store reloads the game, so the screen shows the server's board, not a stale copy | [`sends the move for the player whose turn the backend reported and shows the reply`][game.store.spec]; [`shows why a move was rejected next to the board the server actually has`][game.store.spec] | **Met** |
| Game rules and move validation are on the backend | All rules are in `TicTacToe.Core`, which has no ASP.NET references. The UI sends `player: game.currentPlayer` and the backend decides | The tests in [§3.5](#35-move-validation) | **Met** |
| Status, move history and scoreboard match the backend response | All three are rendered from the snapshot. `canUndo` is computed on the server ([GameSession.CanUndo][GameSession]). Reset Scoreboard replaces only the scoreboard, with the server's reply | [`resetScoreboard replaces only the scoreboard part of the snapshot`][game.store.spec]; [`blocks playing and undoing once the backend reports the game is over`][game.store.spec] | **Met** |
| The frontend holds UI state only (SPEC_PROMPT) | [GameStore][GameStore] keeps `selectedMode`, `loading` and `errorMessage`, plus the game id in `sessionStorage` so that a refresh reopens the same game | [`restores the saved game after a page refresh and follows its mode`][game.store.spec]; [`falls back to a new game when the saved game no longer exists on the server`][game.store.spec]; [`%s starts a new game in the same mode and says why`][game.store.spec] (the game expired during play) | **Met** |

Two display-only conveniences repeat a backend rule. [CellComponent][CellComponent] locks occupied cells, and [StatusBarComponent][StatusBarComponent] knows the human is X so it can say "You win!". The backend still validates every move.

### 5.2 Scoreboard and undo: Option A

Clarification 2 of the brief. The chosen approach is **Option A: Undo is disabled after the game is completed.**

| Requirement | Implementation | Tests | Status |
|---|---|---|---|
| Once a game is won or drawn, Undo is disabled | [GameSession.Undo][GameSession] throws "Undo is not available after the game has ended. Reset the game to play again." [GameSession.CanUndo][GameSession] is false, so the button is disabled | [`Undo_AfterWin_ThrowsBecauseGameEnded`][GameSessionTests]; [`Undo_AfterDraw_ThrowsBecauseGameEnded`][GameSessionTests]; [`Undo_AfterWin_Returns400Problem`][GamesApiTests]; [`SubmitMove_WinningMove_ReturnsWinnerAndWinningCells`][GamesApiTests] (`canUndo: false`); [`blocks playing and undoing once the backend reports the game is over`][game.store.spec] | **Met** |
| The scoreboard stays final for that game | Option A, plus the `_resultRecorded` guard in [GameSession][GameSession] | [`PlayMove_GameWon_RecordsWinExactlyOnce`][GameSessionTests]; [`PlayMove_GameDrawn_RecordsDrawExactlyOnce`][GameSessionTests] | **Met** |
| The choice is stated in the README | [README › Clarifications and assumptions](../README.md#clarifications-and-assumptions) states Option A first. It is also stated in [API.md › Undo](API.md#undo), [DECISIONS.md › D10](DECISIONS.md#d10-option-a-undo-is-disabled-once-a-game-is-won-or-drawn) and [SPEC_PROMPT.md](SPEC_PROMPT.md) | — | **Met (manual)** |

### 5.3 Decisions taken in the specification

[SPEC_PROMPT.md](SPEC_PROMPT.md) settles the points the brief leaves open:

| Decision | Implementation | Tests | Status |
|---|---|---|---|
| The computer's move happens inside the same `POST /moves` request | [GameSession.PlayMove][GameSession] | [`SubmitMove_VsComputer_ResponseIncludesComputerReply`][GameServiceTests] | **Met** |
| If the human's move ends the game, the computer does not move | [GameSession.PlayMove][GameSession] | [`PlayMove_HumanCompletesLine_ComputerDoesNotMove`][GameSessionVsComputerTests]; [`PlayMove_HumanFillsLastCell_ComputerDoesNotMove`][GameSessionVsComputerTests] | **Met** |
| In Vs Computer mode, Undo after the human's first move (history: X, then O) removes both | [GameSession.Undo][GameSession] | [`Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`][GameSessionVsComputerTests] | **Met** |
| One game session = one game id; Reset keeps the id and mode | [GameSession.Reset][GameSession] | [`Reset_GameInProgress_KeepsIdAndMode`][GameSessionTests]; [`Reset_AfterWin_KeepsIdAndModeAndScoreboard`][GameServiceTests]; [`Reset_AfterMove_Returns200WithEmptyBoardAndSameId`][GamesApiTests] | **Met** |
| The scoreboard is global for the server process ("session-level" = the server's lifetime) | Singleton [Scoreboard][Scoreboard] | [`GetGame_AfterAnotherGameEnded_ReturnsSharedScoreboard`][GameServiceTests] | **Met**. Every browser that uses the same server shares these totals |
| A rejected move returns 400 with a clear message in the body | [GameExceptionHandler][GameExceptionHandler] | [`SubmitMove_OccupiedCell_Returns400ProblemWithDetail`][GamesApiTests] | **Met** |

## 6. Testing expectations

Backend game rules are unit-tested in `Core/` without HTTP, as the brief prefers. The `Api/` tests cover the service layer and the HTTP contract. On the frontend, the component specs cover rendering, [game-api.service.spec][game-api.service.spec] covers the API calls with `HttpTestingController`, and [game-page.component.spec][game-page.component.spec] checks the wiring from a click to the request and back.

| Brief minimum | Backend tests | Frontend tests |
|---|---|---|
| Valid move | [`ApplyMove_ValidMove_PlacesMarkAndRecordsMove`][GameEngineTests]; [`SubmitMove_ValidMove_MapsBoardHistoryAndTurn`][GameServiceTests]; [`SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn`][GamesApiTests] | [`submitMove POSTs the move to /games/{id}/moves and returns the updated game state`][game-api.service.spec]; [`sends a clicked cell as a move and renders the board and history the backend returns`][game-page.component.spec] |
| Invalid move | [`ApplyMove_OutsideBoard_ThrowsAndKeepsTurn`][GameEngineTests]; [`ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`][GameEngineTests]; [`ApplyMove_WrongPlayer_ThrowsAndKeepsTurn`][GameEngineTests]; [`PlayMove_SubmittedAsO_ThrowsAndChangesNothing`][GameSessionVsComputerTests]; [`SubmitMove_OccupiedCell_Returns400ProblemWithDetail`][GamesApiTests]; [`SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame`][GamesApiTests]; [`SubmitMove_PlayerNotXOrO_Returns400WithSingleErrorForPlayer`][GamesApiTests] | [`shows why a move was rejected next to the board the server actually has`][game.store.spec]; [`shows a rejected move in a toast and re-syncs the board with the server`][game-page.component.spec]; [`does not emit when an occupied cell is clicked`][board.component.spec] |
| Turn switching | [`ApplyMove_ValidMove_PassesTurnToOtherPlayer`][GameEngineTests] | [`shows "%s"`][status-bar.component.spec] |
| Row win | [`ApplyMove_CompletesRow_WinsWithRowCells`][GameEngineTests] | — |
| Column win | [`ApplyMove_CompletesColumn_WinsWithColumnCells`][GameEngineTests] | — |
| Diagonal win | [`ApplyMove_CompletesMainDiagonal_WinsWithDiagonalCells`][GameEngineTests]; [`ApplyMove_CompletesAntiDiagonal_WinsWithDiagonalCells`][GameEngineTests]; [`ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`][GameEngineTests] | [`highlights only the winning cells`][board.component.spec] |
| Draw | [`ApplyMove_FillsBoardWithoutLine_EndsInDraw`][GameEngineTests] | [`shows "%s"`][status-bar.component.spec] (case "It's a draw!") |
| Reset game | [`Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`][GameSessionTests]; [`Reset_GameInProgress_KeepsIdAndMode`][GameSessionTests]; [`Reset_ThenNextGameEnds_RecordsNextResultToo`][GameSessionTests]; [`Reset_AfterWin_KeepsIdAndModeAndScoreboard`][GameServiceTests]; [`Reset_AfterMove_Returns200WithEmptyBoardAndSameId`][GamesApiTests] | [`resetGame sends the game id and shows the fresh board`][game.store.spec]; [`resetGame POSTs to /games/{id}/reset without a body`][game-api.service.spec] |
| Undo in two-player mode | [`Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`][GameSessionTests]; [`Undo_NoMoves_ThrowsNothingToUndo`][GameSessionTests]; [`Undo_TwoPlayer_Returns200WithLastMoveRemoved`][GamesApiTests]; [`Undo_NoMoves_Returns400ProblemWithDetail`][GamesApiTests] | [`undo sends the game id and shows the restored state`][game.store.spec]; [`disables Undo Last Move when there is nothing to undo`][controls.component.spec] |
| Undo in computer mode | [`Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`][GameSessionVsComputerTests]; [`Undo_AfterTwoRounds_RemovesOnlyLastPair`][GameSessionVsComputerTests]; [`Undo_VsComputer_RemovesBothMovesAndReturnsXToMove`][GameServiceTests]; [`Undo_VsComputer_Returns200WithBothMovesRemoved`][GamesApiTests] | — (the frontend has no mode-specific undo logic) |
| Scoreboard update | [`PlayMove_GameWon_RecordsWinExactlyOnce`][GameSessionTests]; [`PlayMove_GameDrawn_RecordsDrawExactlyOnce`][GameSessionTests]; [`PlayMove_ComputerCompletesLine_RecordsComputerWin`][GameSessionVsComputerTests]; every test in [ScoreboardTests][ScoreboardTests]; [`SubmitMove_WinningMove_MapsWinnerWinningCellsAndScoreboard`][GameServiceTests]; [`GetGame_AfterAnotherGameEnded_ReturnsSharedScoreboard`][GameServiceTests]; [`GetScoreboard_AfterXWins_ReturnsOneXWin`][GamesApiTests]; [`ResetScoreboard_AfterXWins_ReturnsAndKeepsZeroedScoreboard`][GamesApiTests] | [`shows X wins, O wins and draws from the backend`][scoreboard.component.spec]; [`resetScoreboard replaces only the scoreboard part of the snapshot`][game.store.spec] |
| Computer move selection | Every test in [ComputerPlayerTests][ComputerPlayerTests] (one per priority rule, plus "win beats block" and the full-board guard); [`PlayMove_HumanMoves_ComputerRepliesInSameCall`][GameSessionVsComputerTests]; [`SubmitMove_VsComputer_ResponseIncludesComputerReply`][GameServiceTests]; [`SubmitMove_VsComputer_Returns200WithComputerReply`][GamesApiTests] | — |
| Move after game completion | [`ApplyMove_AfterGameWon_ThrowsGameOver`][GameEngineTests]; [`ApplyMove_AfterDraw_ThrowsGameOver`][GameEngineTests]; [`PlayMove_HumanCompletesLine_ComputerDoesNotMove`][GameSessionVsComputerTests]; [`PlayMove_HumanFillsLastCell_ComputerDoesNotMove`][GameSessionVsComputerTests]; [`SubmitMove_AfterWin_Returns400ProblemWithDetail`][GamesApiTests] | [`disables every cell when the game is over`][board.component.spec]; [`blocks playing and undoing once the backend reports the game is over`][game.store.spec] |

**SPEC_PROMPT's extra test list.** Each case has its own named test above:

- a move outside the board, with -1 or 3 for the row or the column
- both diagonals
- undo rejected when there are no moves, after a win and after a draw
- the scoreboard counts a game exactly once and not again after Reset Game
- Reset Scoreboard zeroes every counter
- one computer test per priority rule, and "the computer does not move after the game is over"

On the frontend, the required board tests are all there: 9 cells, X and O shown, winning cells highlighted, cells locked after the game ends. So are the `GameApiService` tests for creating a game and submitting a move. They use `provideHttpClientTesting()`, the current replacement for the deprecated `HttpClientTestingModule`.

**Beyond the brief.** These tests cover the HTTP contract (property order, string enums, 201 with `Location`, problem+json for 400, 404, 415, 429 and 500), CORS, locking per game, rate limiting, `/health`, startup validation of the settings and the removal of idle games. One test plays every possible game against the computer. [TESTING.md](TESTING.md) gives the totals and what each suite covers.

**Not covered by an automated test.** None of these is required by the brief.

- An end-to-end game in a real browser against the real API. It was verified with scripted headless-Chrome runs during development, which are not part of the repository or CI.
- A request for a game that the idle cleanup has just removed. It takes the same "not found" path as [`GetGame_UnknownId_Returns404Problem`][GamesApiTests], and the frontend's reaction is covered by [`%s starts a new game in the same mode and says why`][game.store.spec].

## 7. README and submission expectations

Status on 2026-10-25, checked against the final code: every README section the brief and the specification ask for is written, in the order [SPEC_PROMPT.md](SPEC_PROMPT.md) §7 gives, and every document listed here exists and is rendered by the review portal.

| README expectation (brief) | Where | Status |
|---|---|---|
| Project overview | [README › Project overview](../README.md#project-overview) | **Met** |
| Tech stack | [README › Tech stack](../README.md#tech-stack) | **Met** |
| Features implemented | [README › Features implemented](../README.md#features-implemented); this document is the detailed version | **Met** |
| How to run the backend locally | [README › How to run the backend locally](../README.md#how-to-run-the-backend-locally), with PowerShell commands and troubleshooting | **Met** |
| How to run the frontend locally | [README › How to run the frontend locally](../README.md#how-to-run-the-frontend-locally) | **Met** |
| API endpoint summary | [README › API endpoint summary](../README.md#api-endpoint-summary) → [API.md](API.md) | **Met** |
| How to run tests | [README › How to run tests](../README.md#how-to-run-tests), with the expected counts | **Met** |
| AI tools and prompt summary | [README › AI tools and prompt summary](../README.md#ai-tools-and-prompt-summary) → [AI_WORKFLOW.md](AI_WORKFLOW.md) and [SPEC_PROMPT.md](SPEC_PROMPT.md) | **Met** |
| Design decisions | [README › Design decisions](../README.md#design-decisions) → [DECISIONS.md](DECISIONS.md) (D1–D30) | **Met** |
| Clarifications and assumptions (Option A) | [README › Clarifications and assumptions](../README.md#clarifications-and-assumptions) | **Met** |
| Known limitations | [README › Known limitations](../README.md#known-limitations) | **Met** |
| Future improvements | [README › Future improvements](../README.md#future-improvements) | **Met** |

| Submission requirement (brief) | Where | Status |
|---|---|---|
| Angular frontend source code | [frontend/](../frontend/) | **Met** |
| .NET backend source code | [backend/](../backend/) | **Met** |
| README.md | [README.md](../README.md) | **Met** |
| Setup and run instructions | [README](../README.md#how-to-run-the-backend-locally), with a quick start at the top | **Met** |
| Test instructions | [README › How to run tests](../README.md#how-to-run-tests); [TESTING.md](TESTING.md) | **Met** |
| Prompt summary or AI workflow notes | [AI_WORKFLOW.md](AI_WORKFLOW.md), [SPEC_PROMPT.md](SPEC_PROMPT.md) | **Met** |
| API documentation or endpoint summary | [API.md](API.md), Swagger UI at `/swagger`, [TicTacToe.Api.http][TicTacToe.Api.http] | **Met** |
| Known assumptions and limitations | [README › Clarifications and assumptions](../README.md#clarifications-and-assumptions) and [Known limitations](../README.md#known-limitations); [API.md](API.md) states the storage and idle-game limits | **Met** |

| AI-assisted development (brief: be ready to explain…) | Where | Status |
|---|---|---|
| How the requirement became a specification | [SPEC_PROMPT.md](SPEC_PROMPT.md) (verbatim) and [AI_WORKFLOW.md](AI_WORKFLOW.md) | **Met** |
| Which prompts were used | [AI_WORKFLOW.md](AI_WORKFLOW.md), in order, each with its purpose | **Met** |
| What the AI generated, what was changed by hand, what was reviewed carefully | [AI_WORKFLOW.md](AI_WORKFLOW.md); the AI-assisted development section of the [Design Q&A](PANEL_QA.md) | **Met** |
| Assumptions and trade-offs | [DECISIONS.md](DECISIONS.md); the assumptions and trade-offs sections of [AI_WORKFLOW.md](AI_WORKFLOW.md) | **Met** |

## 8. Open items

None for the brief. Items that remain by design (no persistence, one shared scoreboard, a computer that a fork can beat, no end-to-end tests in CI) are listed in [README › Known limitations](../README.md#known-limitations).

<!-- Link targets (reference-style links keep the tables readable; paths are relative to docs/) -->

[Board]: ../backend/TicTacToe.Core/Domain/Board.cs
[Player]: ../backend/TicTacToe.Core/Domain/Player.cs
[GameMode]: ../backend/TicTacToe.Core/Domain/GameMode.cs
[Move]: ../backend/TicTacToe.Core/Domain/Move.cs
[GameEngine]: ../backend/TicTacToe.Core/Engine/GameEngine.cs
[ComputerPlayer]: ../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs
[GameSession]: ../backend/TicTacToe.Core/Sessions/GameSession.cs
[Scoreboard]: ../backend/TicTacToe.Core/Scoring/Scoreboard.cs
[Program.cs]: ../backend/TicTacToe.Api/Program.cs
[launchSettings.json]: ../backend/TicTacToe.Api/Properties/launchSettings.json
[appsettings.json]: ../backend/TicTacToe.Api/appsettings.json
[TicTacToe.Api.http]: ../backend/TicTacToe.Api/TicTacToe.Api.http
[GamesController]: ../backend/TicTacToe.Api/Controllers/GamesController.cs
[ScoreboardController]: ../backend/TicTacToe.Api/Controllers/ScoreboardController.cs
[CreateGameRequest]: ../backend/TicTacToe.Api/Contracts/Requests/CreateGameRequest.cs
[SubmitMoveRequest]: ../backend/TicTacToe.Api/Contracts/Requests/SubmitMoveRequest.cs
[GameStateResponse]: ../backend/TicTacToe.Api/Contracts/Responses/GameStateResponse.cs
[ResponseMapper]: ../backend/TicTacToe.Api/Mapping/ResponseMapper.cs
[GameService]: ../backend/TicTacToe.Api/Application/GameService.cs
[IGameRepository]: ../backend/TicTacToe.Api/Application/IGameRepository.cs
[IScoreboardService]: ../backend/TicTacToe.Core/Scoring/IScoreboardService.cs
[InMemoryGameRepository]: ../backend/TicTacToe.Api/Infrastructure/Persistence/InMemoryGameRepository.cs
[GameExceptionHandler]: ../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs
[ServiceCollectionExtensions]: ../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs
[WebApplicationExtensions]: ../backend/TicTacToe.Api/Extensions/WebApplicationExtensions.cs

[BoardTests]: ../backend/TicTacToe.Tests/Core/Domain/BoardTests.cs
[GameEngineTests]: ../backend/TicTacToe.Tests/Core/Engine/GameEngineTests.cs
[ComputerPlayerTests]: ../backend/TicTacToe.Tests/Core/Opponents/ComputerPlayerTests.cs
[GameSessionTests]: ../backend/TicTacToe.Tests/Core/Sessions/GameSessionTests.cs
[GameSessionVsComputerTests]: ../backend/TicTacToe.Tests/Core/Sessions/GameSessionVsComputerTests.cs
[ScoreboardTests]: ../backend/TicTacToe.Tests/Core/Scoring/ScoreboardTests.cs
[GameServiceTests]: ../backend/TicTacToe.Tests/Api/Application/GameServiceTests.cs
[InMemoryGameRepositoryTests]: ../backend/TicTacToe.Tests/Api/Infrastructure/InMemoryGameRepositoryTests.cs
[GamesApiTests]: ../backend/TicTacToe.Tests/Api/Integration/GamesApiTests.cs
[HealthCheckTests]: ../backend/TicTacToe.Tests/Api/Integration/HealthCheckTests.cs
[ConfigurationTests]: ../backend/TicTacToe.Tests/Api/Integration/ConfigurationTests.cs

[vercel.json]: ../vercel.json
[render.yaml]: ../render.yaml
[Dockerfile]: ../backend/Dockerfile

[package.json]: ../frontend/package.json
[environment.ts]: ../frontend/src/environments/environment.ts
[environment.production.ts]: ../frontend/src/environments/environment.production.ts
[styles.css]: ../frontend/src/styles.css
[app-config.ts]: ../frontend/src/app/core/config/app-config.ts
[api-error.ts]: ../frontend/src/app/core/http/api-error.ts
[GamePageComponent]: ../frontend/src/app/features/game/game-page.component.html
[game-page.component.css]: ../frontend/src/app/features/game/game-page.component.css
[GameStore]: ../frontend/src/app/features/game/state/game.store.ts
[GameApiService]: ../frontend/src/app/features/game/data-access/game-api.service.ts
[BoardComponent]: ../frontend/src/app/features/game/components/board/board.component.ts
[CellComponent]: ../frontend/src/app/features/game/components/cell/cell.component.ts
[cell.component.css]: ../frontend/src/app/features/game/components/cell/cell.component.css
[StatusBarComponent]: ../frontend/src/app/features/game/components/status-bar/status-bar.component.ts
[ControlsComponent]: ../frontend/src/app/features/game/components/controls/controls.component.ts
[MoveHistoryComponent]: ../frontend/src/app/features/game/components/move-history/move-history.component.html
[ScoreboardComponent]: ../frontend/src/app/features/game/components/scoreboard/scoreboard.component.ts
[ErrorToastComponent]: ../frontend/src/app/shared/ui/error-toast/error-toast.component.ts

[app.routes.spec]: ../frontend/src/app/app.routes.spec.ts
[api-error.spec]: ../frontend/src/app/core/http/api-error.spec.ts
[game-page.component.spec]: ../frontend/src/app/features/game/game-page.component.spec.ts
[game.store.spec]: ../frontend/src/app/features/game/state/game.store.spec.ts
[game-api.service.spec]: ../frontend/src/app/features/game/data-access/game-api.service.spec.ts
[board.component.spec]: ../frontend/src/app/features/game/components/board/board.component.spec.ts
[cell.component.spec]: ../frontend/src/app/features/game/components/cell/cell.component.spec.ts
[status-bar.component.spec]: ../frontend/src/app/features/game/components/status-bar/status-bar.component.spec.ts
[controls.component.spec]: ../frontend/src/app/features/game/components/controls/controls.component.spec.ts
[move-history.component.spec]: ../frontend/src/app/features/game/components/move-history/move-history.component.spec.ts
[scoreboard.component.spec]: ../frontend/src/app/features/game/components/scoreboard/scoreboard.component.spec.ts
[error-toast.component.spec]: ../frontend/src/app/shared/ui/error-toast/error-toast.component.spec.ts
