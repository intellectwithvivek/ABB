# Testing

This document covers how the project is tested, how to run the tests, and what each test file covers. It maps the brief's "Testing Expectations" to test names, lists what is deliberately not covered, and shows how to add tests. Links to test files open them on GitHub.

Related documents: [Architecture](ARCHITECTURE.md) describes the code under test and the [API reference](API.md) holds the contract the HTTP tests pin. [Design decisions](DECISIONS.md) explains the choices behind the rules.

## Strategy

The tests follow the code's layering: **each rule is tested where it lives**. Game rules sit in `TicTacToe.Core`, so most backend tests are fast unit tests that need no web server. The layers above add only what they introduce: locking, mapping, HTTP status codes, JSON shape, CORS, rate limiting and configuration.

```text
                         /\
                        /  \      Scripted browser checks: headless Chrome, used during development
                       /----\     (not part of the repository or CI)
                      /      \
                     /        \   HTTP integration: 22 tests, WebApplicationFactory<Program>
                    /----------\  (real pipeline, in memory)
                   /            \
                  /              \  Service + infrastructure: 12 tests
                 /----------------\ (GameService, repository, cleanup on a fake clock)
                /                  \
               /                    \  Core unit: 49 tests
              /----------------------\ (engine, session, computer player, scoreboard)

   Frontend (separate suite): 142 Vitest tests for components, the store, the API service,
   routing and the docs renderer
```

| Level | Tooling | What it proves |
|---|---|---|
| Core unit | xUnit 2.9, plain `Assert` | Every game rule, with exact error messages and "nothing changed" checks after a rejected move |
| Service / infrastructure | xUnit with the real `InMemoryGameRepository` and `Scoreboard`, and `FakeTimeProvider` | Unknown ids, mapping to the response DTOs, the per-game lock under parallel requests, and idle-game cleanup |
| HTTP integration | `Microsoft.AspNetCore.Mvc.Testing` (`WebApplicationFactory<Program>`) | Status codes, `Location`, raw JSON (camelCase, string enums, `null` cells, property order), problem+json bodies, CORS, the 429 response, `/health`, Swagger and startup validation |
| Angular unit / component | Vitest 4 + jsdom through `ng test` (`@angular/build:unit-test`) | Rendering and events of each component, store behaviour, the exact HTTP calls (`HttpTestingController`), routing and titles, and the Markdown renderer |
| Scripted browser checks | Headless Chrome via the DevTools Protocol, from Node scripts | Real rendering and navigation, used during development only (see [Quality checks done](#quality-checks-done)) |

Conventions:

- **Backend names** follow `Method_Scenario_ExpectedOutcome`, e.g. `ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`. Each case the brief requires has its own clearly named test. `[Theory]` is used only for row, column and coordinate variants.
- **No mocking library on the backend.** The tests use the real collaborators (repository, scoreboard). Time is the only fake (`FakeTimeProvider`).
- **xUnit creates a new instance of the test class for every test** (like JUnit). Each test therefore gets a fresh scoreboard, and in the HTTP tests a fresh in-memory app.
- **Frontend tests describe behaviour in sentences**, e.g. `ignores further actions, so a double click sends only one request`. They query the DOM the way a user or a screen reader would: by role, `aria-label`, `aria-live` or visible text. Only the network is replaced (`HttpTestingController`). The store spec is the exception: it stubs `GameApiService` with `vi.fn`.

## How to run

All commands are for Windows PowerShell, run from the repository root.

**Backend** (.NET 8 SDK):

```powershell
cd backend
dotnet test                                                      # build + run all 83 tests
dotnet test --filter "FullyQualifiedName~TicTacToe.Tests.Core"   # Core unit tests only
dotnet test --filter "FullyQualifiedName~GameEngineTests"        # one test class
dotnet test --logger "console;verbosity=normal"                  # list every test name with its result
```

**Frontend** (Node.js 22 or 24 LTS):

```powershell
cd frontend
npm ci                                       # once, installs the exact locked versions
npm run test:ci                              # one run of all 142 tests (ng test --watch=false)
npm test                                     # watch mode: re-runs on every save
npx ng test --watch=false --include "src/app/features/game/**/*.spec.ts"   # one folder
npx ng test --watch=false --filter "GameStore"                             # tests whose name matches
npm run format:check                         # Prettier formatting check
```

**Continuous integration.** [ci.yml](../.github/workflows/ci.yml) runs on every push and pull request to `main`, on Ubuntu:

- **Backend job:** `dotnet restore`, `dotnet build --configuration Release`, `dotnet test --configuration Release`.
- **Frontend job:** `npm ci`, `npm run build`, `npm run test:ci`, `npm run format:check`.
- **Docker job** (after both pass): validates `docker-compose.yml` and builds both images.

**Manual checks.** Run the API with `dotnet run --project backend/TicTacToe.Api` and try every endpoint in Swagger UI at `http://localhost:5000/swagger`. Alternatively, send the requests in [TicTacToe.Api.http](../backend/TicTacToe.Api/TicTacToe.Api.http) from Visual Studio or VS Code. The [API smoke test](API.md#smoke-test-curl) records a 21-step `curl` session against the running server.

**Troubleshooting on Windows:**

- **`dotnet` not found.** If `dotnet` is installed but not recognised, add it to the session's PATH: `$env:PATH = "C:\Program Files\dotnet;" + $env:PATH`.
- **Smart App Control blocks the tests.** On the development machine, Windows Smart App Control sometimes blocked `testhost.exe` from loading the freshly built, unsigned `TicTacToe.Tests.dll` (`0x800711C7`, "An Application Control policy has blocked this file"). Rebuilding and running again worked. Smart App Control exists only on Windows, so Linux CI runners are not affected.

## Current counts

Counted from the test sources (`[Fact]` plus `[InlineData]` rows, and Vitest `it` plus `it.each` rows). These are the totals the runners report.

| Suite | Files | Test methods | Tests reported by the runner |
|---|---|---|---|
| Backend: Core unit | 5 | 42 | 49 |
| Backend: service + infrastructure | 3 | 12 | 12 |
| Backend: HTTP integration | 4 | 21 | 22 |
| **Backend total** (`dotnet test`) | **12** | **75** | **83** |
| **Frontend total** (`ng test`) | **25 spec files** | | **142** |

Frontend tests by area: app shell and routes 9, `core/` 14, `shared/` 4, game feature 60, docs feature 49, home page 6.

## Test inventory

### Backend: TicTacToe.Tests

Helpers in [TestSupport/](../backend/TicTacToe.Tests/TestSupport/):

- [TestBoards](../backend/TicTacToe.Tests/TestSupport/TestBoards.cs) converts between a `Board` and three strings such as `"XO."`, `".X."`, `"..O"`. Tests use it to set up or compare a whole board at a glance. It calls the `internal` `Board.Place` through `InternalsVisibleTo`.
- [TestGames](../backend/TicTacToe.Tests/TestSupport/TestGames.cs) plays a list of cells, each by whoever's turn it is. It also holds two shared sequences: `XWinsOnTopRow` and `FullBoardDraw`.

| File | Level | Tests | What it covers |
|---|---|---|---|
| [Core/Engine/GameEngineTests.cs](../backend/TicTacToe.Tests/Core/Engine/GameEngineTests.cs) | Core | 21 | A valid move is placed and recorded. The turn passes. Off-board (4 coordinates), occupied and wrong-player moves are rejected with the exact message, and the turn, board, history and status are unchanged. A move after a win or a draw gets "game over" (checked first). Wins on each row, each column and both diagonals (one won by O) report the right winning cells. A full board with no line is a draw. A ninth move that completes a line is a win, not a draw. Undoing a winning move recalculates the status. |
| [Core/Opponents/ComputerPlayerTests.cs](../backend/TicTacToe.Tests/Core/Opponents/ComputerPlayerTests.cs) | Core | 6 | One test per priority rule (win, block, centre, first free corner, first free cell), plus "win beats block". Each board is chosen so that the rule under test picks a different cell than the later rules would, so a skipped rule fails its test. |
| [Core/Scoring/ScoreboardTests.cs](../backend/TicTacToe.Tests/Core/Scoring/ScoreboardTests.cs) | Core | 6 | The scoreboard starts at zero, and X wins, O wins and draws each raise only their own counter. Reset zeroes everything. 10,000 parallel rounds of updates count every call, which needs the lock. |
| [Core/Sessions/GameSessionTests.cs](../backend/TicTacToe.Tests/Core/Sessions/GameSessionTests.cs) | Core | 9 | Two Player undo removes one move and gives the turn back. Undo with no moves is rejected. Undo after a win or a draw is rejected (Option A). Reset clears the game, gives the turn to X and keeps the scoreboard; it also keeps the id and the mode. A win and a draw are each recorded exactly once, even after a rejected extra move, a rejected undo and a Reset. Reset re-arms the record-once guard. |
| [Core/Sessions/GameSessionVsComputerTests.cs](../backend/TicTacToe.Tests/Core/Sessions/GameSessionVsComputerTests.cs) | Core | 7 | The computer replies in the same call. A move submitted as O is rejected. The computer does not move after the human wins or fills the last cell. A computer win is recorded as an O win. Undo removes the human's move and the reply together, and after two rounds it removes only the last pair. |
| [Api/Application/GameServiceTests.cs](../backend/TicTacToe.Tests/Api/Application/GameServiceTests.cs) | Service | 10 | Creating a game returns an empty state. `GetGame` returns the created game. Every operation on an unknown id throws `GameNotFoundException`. The board, history, turn, winner, winning cells and scoreboard map correctly. The VsComputer response includes the computer's reply, and VsComputer undo removes both moves. Reset keeps the id, mode and scoreboard. The scoreboard is shared between games. Of 50 parallel moves to the same cell, exactly one succeeds. |
| [Api/Infrastructure/InMemoryGameRepositoryTests.cs](../backend/TicTacToe.Tests/Api/Infrastructure/InMemoryGameRepositoryTests.cs) | Infrastructure | 1 | `RemoveIdleSince` removes only the game not used since the cutoff. Finding a game counts as using it. |
| [Api/Infrastructure/ExpiredSessionCleanupServiceTests.cs](../backend/TicTacToe.Tests/Api/Infrastructure/ExpiredSessionCleanupServiceTests.cs) | Infrastructure | 1 | One timer tick on a `FakeTimeProvider` removes the idle game and keeps the recently used one. Hours pass in milliseconds. |
| [Api/Integration/GamesApiTests.cs](../backend/TicTacToe.Tests/Api/Integration/GamesApiTests.cs) | HTTP | 16 | Create returns 201, a `Location` header and the full JSON in the frozen property order. A valid move returns 200. A winning move returns the winner and winning cells. An occupied cell returns 400 problem+json with its `detail`. A missing `col` gives 400 with a single validation error, and the game is unchanged. `player` sent as `0` or `"Z"` gives a single error for `$.player`. An unknown id returns 404 problem+json. Two Player undo returns 200, and undo after a win returns 400. Reset returns the same id and an empty board. A CORS preflight from `localhost:4200` is allowed, and one from another origin is not. A rejected move still carries the CORS header. The scoreboard endpoints count a win and reset to zero. |
| [Api/Integration/RateLimitingTests.cs](../backend/TicTacToe.Tests/Api/Integration/RateLimitingTests.cs) | HTTP | 2 | With the limit lowered to 3, the 4th request gets 429 problem+json with `Retry-After` and the CORS header. `/health` is not rate limited. |
| [Api/Integration/ConfigurationTests.cs](../backend/TicTacToe.Tests/Api/Integration/ConfigurationTests.cs) | HTTP | 3 | The Swagger document is served by default and returns 404 with `Swagger:Enabled=false`. A zero `Sessions:CleanupInterval` stops startup with a validation error. |
| [Api/Integration/HealthCheckTests.cs](../backend/TicTacToe.Tests/Api/Integration/HealthCheckTests.cs) | HTTP | 1 | `GET /health` returns 200 `Healthy`. |

### Frontend: Vitest specs

Shared fixtures:

- [testing/app-config.fixture.ts](../frontend/src/app/testing/app-config.fixture.ts) provides `TEST_APP_CONFIG`. Its URLs differ from every environment file, so a spec fails if code bypasses the `APP_CONFIG` token.
- [features/game/testing/game-state.fixture.ts](../frontend/src/app/features/game/testing/game-state.fixture.ts) provides `createGameState(overrides)`, a backend snapshot where each test overrides only the fields it cares about.

| File | Tests | What it covers |
|---|---|---|
| [app.component.spec.ts](../frontend/src/app/app.component.spec.ts) | 3 | The routed page renders inside `<main>` between the header and the footer. The skip link is the first focusable element, and it moves focus to `<main>` without navigating. |
| [app.routes.spec.ts](../frontend/src/app/app.routes.spec.ts) | 6 | Each of the 5 URLs (including an unknown one) shows its page with the right browser title, using the real application providers. `:slug` reaches the doc viewer as an input. |
| [core/http/api-error.spec.ts](../frontend/src/app/core/http/api-error.spec.ts) | 7 | Status 0 gives the "cannot reach the server" message (named by origin, or by path when same-origin). The function uses `detail`, then the first validation error, then `title`. Non-ProblemDetails bodies and non-HTTP errors get the generic message. |
| [core/layout/site-header/site-header.component.spec.ts](../frontend/src/app/core/layout/site-header/site-header.component.spec.ts) | 5 | The brand and navigation links work. The API and GitHub links come from the config and open in a new tab. Only the current page's link is active, and Overview is active on `/` only. |
| [core/layout/site-footer/site-footer.component.spec.ts](../frontend/src/app/core/layout/site-footer/site-footer.component.spec.ts) | 2 | The authorship line, and the links to the problem statement, the docs and the repository. |
| [shared/ui/error-toast/error-toast.component.spec.ts](../frontend/src/app/shared/ui/error-toast/error-toast.component.spec.ts) | 4 | Nothing renders without a message. The message shows as `role="alert"`. The close button emits `dismissed`, and so does the 5-second auto-dismiss (tested with fake timers). |
| [features/game/components/board/board.component.spec.ts](../frontend/src/app/features/game/components/board/board.component.spec.ts) | 7 | The board renders 9 cells and shows X and O. It highlights only the winning cells and disables every cell when the game is over. Occupied cells are disabled and empty ones playable. A click emits `cellSelected` with the row and column, and a click on an occupied cell emits nothing. |
| [features/game/components/cell/cell.component.spec.ts](../frontend/src/app/features/game/components/cell/cell.component.spec.ts) | 7 | 1-based `aria-label`s for empty and occupied cells, the CSS class per mark (3 cases), the `selected` event, and the disabled state while the board is disabled. |
| [features/game/components/controls/controls.component.spec.ts](../frontend/src/app/features/game/components/controls/controls.component.spec.ts) | 6 | The Undo, Reset and New Game events fire. Undo is disabled when there is nothing to undo. New Game and the mode picker are disabled while busy. `modeSelected` fires. The "mode applies to the next game" hint is shown and hidden correctly. |
| [features/game/components/move-history/move-history.component.spec.ts](../frontend/src/app/features/game/components/move-history/move-history.component.spec.ts) | 2 | "No moves yet" shows before the first move. Each row shows the number, the player and the 1-based "Row 1, Column 1" position. |
| [features/game/components/scoreboard/scoreboard.component.spec.ts](../frontend/src/app/features/game/components/scoreboard/scoreboard.component.spec.ts) | 4 | The counters come from the backend, with placeholders before the first game. The Reset Scoreboard event fires, and the button is disabled while busy. |
| [features/game/components/status-bar/status-bar.component.spec.ts](../frontend/src/app/features/game/components/status-bar/status-bar.component.spec.ts) | 9 | The six status sentences ("Player O's turn", "Your turn (X)", "Player X wins!", "You win!", "Computer wins!", "It's a draw!"), the mode badge, and the loading and no-game states. |
| [features/game/data-access/game-api.service.spec.ts](../frontend/src/app/features/game/data-access/game-api.service.spec.ts) | 6 | The method, URL and body of every endpoint, checked with `provideHttpClientTesting()` and `HttpTestingController` (the current replacement for `HttpClientTestingModule`). `verify()` runs after each test. |
| [features/game/state/game.store.spec.ts](../frontend/src/app/features/game/state/game.store.spec.ts) | 16 | `init` creates a game, or resumes the saved one and follows its mode, or falls back to a new game when the saved one is gone. An unreachable server is reported. A move is sent for the backend's `currentPlayer`. A rejection keeps the last snapshot and sets the error. The error clears when the next request starts. While a request is in flight, `loading` is set and further actions are ignored (no double submit). The New Game, Undo and Reset requests are covered. Reset Scoreboard patches only the scoreboard. A finished game blocks playing and undo. `dismissError` clears the message. |
| [features/game/game-page.component.spec.ts](../frontend/src/app/features/game/game-page.component.spec.ts) | 3 | A wiring test with the real store, service and components; only the network is faked. A game starts on load and X is to move. A clicked cell is sent as a move and the returned board and history are rendered. A backend error appears in the toast. |
| [features/docs/docs.catalog.spec.ts](../frontend/src/app/features/docs/docs.catalog.spec.ts) | 7 | Slugs and source files are unique. Every category is known and non-empty. The catalog order matches the sidebar. Every source is a repository Markdown file. Only the problem statement offers the Word original. Lookups by slug and path work, and the first and last documents have no previous and next. |
| [features/docs/data-access/docs.service.spec.ts](../frontend/src/app/features/docs/data-access/docs.service.spec.ts) | 3 | Markdown loads from a URL relative to `<base href>`. A missing file is a 404, and a host's `index.html` fallback is also treated as a 404. |
| [features/docs/markdown/markdown-renderer.spec.ts](../frontend/src/app/features/docs/markdown/markdown-renderer.spec.ts) | 15 | GitHub-style heading ids with no `id` attributes in the HTML. The table of contents holds h2/h3 only. Links to catalog docs (same folder, from the README, via `../`, `#anchor`) stay in the app. Other repository files and folders open on GitHub. The Word original downloads. External links open in a new tab, and `mailto:` is left alone. Titles are escaped. Images resolve to the published copy or to GitHub. |
| [features/docs/markdown/doc-link-resolver.spec.ts](../frontend/src/app/features/docs/markdown/doc-link-resolver.spec.ts) | 4 | Relative path resolution: the same folder, the repository root, `./` and `../`, and a leading `/`. |
| [features/docs/markdown/heading-slugger.spec.ts](../frontend/src/app/features/docs/markdown/heading-slugger.spec.ts) | 2 | Anchors match GitHub's, and repeated headings are numbered. |
| [features/docs/markdown/in-app-links.directive.spec.ts](../frontend/src/app/features/docs/markdown/in-app-links.directive.spec.ts) | 3 | In-app links route through the Router without a reload. New-tab and download links, and Ctrl+click, keep their browser behaviour. |
| [features/docs/doc-viewer-page.component.spec.ts](../frontend/src/app/features/docs/doc-viewer-page.component.spec.ts) | 10 | The title shows first and the rendered document when it arrives. The page has its "On this page" list, scrolls to the URL fragment, keeps document links in the app, highlights the open document in the sidebar, and has previous/next and source/original links. It covers the unknown-slug, not-published and failed-load states. |
| [features/docs/docs-hub-page.component.spec.ts](../frontend/src/app/features/docs/docs-hub-page.component.spec.ts) | 2 | One section per category, in order, and a card linking to every document. |
| [features/docs/components/docs-sidebar/docs-sidebar.component.spec.ts](../frontend/src/app/features/docs/components/docs-sidebar/docs-sidebar.component.spec.ts) | 3 | Documents are grouped by category. The list folds open and closed on small screens and folds away after a choice. |
| [features/home/home-page.component.spec.ts](../frontend/src/app/features/home/home-page.component.spec.ts) | 6 | The pitch, the calls to action (in-app, and external from the config), the five review steps, each feature mapped to the brief, and the key-document links. |

## Brief's testing expectations mapped to tests

The brief asks for tests of the core game logic covering 13 cases, and prefers backend unit tests for rules and state transitions. Every case has at least one dedicated Core test. Most cases are also checked through the service or HTTP layer, and where it applies, through the UI.

| Expectation | Backend tests | Frontend tests |
|---|---|---|
| Valid move | `GameEngineTests.ApplyMove_ValidMove_PlacesMarkAndRecordsMove`; `GameServiceTests.SubmitMove_ValidMove_MapsBoardHistoryAndTurn`; `GamesApiTests.SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn` | store: *sends the move for the player whose turn the backend reported and shows the reply*; game page: *sends a clicked cell as a move and renders the board and history the backend returns* |
| Invalid move | `GameEngineTests.ApplyMove_OutsideBoard_ThrowsAndKeepsTurn` (4 cases), `ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`, `ApplyMove_WrongPlayer_ThrowsAndKeepsTurn`; `GameSessionVsComputerTests.PlayMove_SubmittedAsO_ThrowsAndChangesNothing`; `GamesApiTests.SubmitMove_OccupiedCell_Returns400ProblemWithDetail`, `SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame`, `SubmitMove_PlayerNotXOrO_Returns400WithSingleErrorForPlayer` | board: *does not emit when an occupied cell is clicked*; store: *puts a rejected move in errorMessage and keeps the last snapshot*; game page: *shows the error message from the backend in a toast*; `api-error.spec.ts` |
| Turn switching | `GameEngineTests.ApplyMove_ValidMove_PassesTurnToOtherPlayer`; the three rejection tests above assert the turn is unchanged; `GamesApiTests.SubmitMove_ValidMove_...` (`currentPlayer` becomes `"O"`) | status bar: *announces "Player O's turn"* |
| Row win | `GameEngineTests.ApplyMove_CompletesRow_WinsWithRowCells` (rows 0, 1, 2); `GamesApiTests.SubmitMove_WinningMove_ReturnsWinnerAndWinningCells`; `GameServiceTests.SubmitMove_WinningMove_MapsWinnerWinningCellsAndScoreboard` | board: *highlights only the winning cells*; status bar: *announces "Player X wins!"* |
| Column win | `GameEngineTests.ApplyMove_CompletesColumn_WinsWithColumnCells` (columns 0, 1, 2) | Covered by the same winning-cell rendering |
| Diagonal win | `GameEngineTests.ApplyMove_CompletesMainDiagonal_WinsWithDiagonalCells`, `ApplyMove_CompletesAntiDiagonal_WinsWithDiagonalCells` (won by O), `ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`; `GameSessionVsComputerTests.PlayMove_ComputerCompletesLine_RecordsComputerWin` | Covered by the same winning-cell rendering |
| Draw | `GameEngineTests.ApplyMove_FillsBoardWithoutLine_EndsInDraw`; `GameSessionVsComputerTests.PlayMove_HumanFillsLastCell_ComputerDoesNotMove` | status bar: *announces "It's a draw!"* |
| Reset game | `GameSessionTests.Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`, `Reset_GameInProgress_KeepsIdAndMode`, `Reset_ThenNextGameEnds_RecordsNextResultToo`; `GameServiceTests.Reset_AfterWin_KeepsIdAndModeAndScoreboard`; `GamesApiTests.Reset_AfterMove_Returns200WithEmptyBoardAndSameId` | store: *resetGame sends the game id and shows the fresh board*; controls: *emits undo, resetGame and newGame when their buttons are clicked* |
| Undo in two-player mode | `GameSessionTests.Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`, `Undo_NoMoves_ThrowsNothingToUndo`, `Undo_AfterWin_ThrowsBecauseGameEnded`, `Undo_AfterDraw_ThrowsBecauseGameEnded`; `GameEngineTests.UndoLastMove_AfterWinningMove_RecalculatesStatusToInProgress`; `GamesApiTests.Undo_TwoPlayer_Returns200WithLastMoveRemoved`, `Undo_AfterWin_Returns400Problem` | store: *undo sends the game id and shows the restored state*; controls: *disables Undo Last Move when there is nothing to undo*; store: *blocks playing and undoing once the backend reports the game is over* |
| Undo in computer mode | `GameSessionVsComputerTests.Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`, `Undo_AfterTwoRounds_RemovesOnlyLastPair`; `GameServiceTests.Undo_VsComputer_RemovesBothMovesAndReturnsXToMove` | The UI sends the same undo request in both modes; the pair rule is server-side only |
| Scoreboard update | `GameSessionTests.PlayMove_GameWon_RecordsWinExactlyOnce`, `PlayMove_GameDrawn_RecordsDrawExactlyOnce`; all 6 `ScoreboardTests`, including `Reset_AfterResults_ZeroesAllCounters`; `GameServiceTests.GetGame_AfterAnotherGameEnded_ReturnsSharedScoreboard`; `GamesApiTests.GetScoreboard_AfterXWins_ReturnsOneXWin`, `ResetScoreboard_AfterXWins_ReturnsAndKeepsZeroedScoreboard` | `scoreboard.component.spec.ts` (4 tests); store: *resetScoreboard replaces only the scoreboard part of the snapshot* |
| Computer move selection | All 6 `ComputerPlayerTests` (one per priority rule, plus win beats block); `GameSessionVsComputerTests.PlayMove_HumanMoves_ComputerRepliesInSameCall`; `GameServiceTests.SubmitMove_VsComputer_ResponseIncludesComputerReply` | status bar: *"Your turn (X)"*, *"You win!"*, *"Computer wins!"* |
| Move after game completion | `GameEngineTests.ApplyMove_AfterGameWon_ThrowsGameOver`, `ApplyMove_AfterDraw_ThrowsGameOver`; `GameSessionVsComputerTests.PlayMove_HumanCompletesLine_ComputerDoesNotMove`, `PlayMove_HumanFillsLastCell_ComputerDoesNotMove`; `GameSessionTests.PlayMove_GameWon_RecordsWinExactlyOnce` (a rejected extra move does not count again) | board: *disables every cell when the game is over*; store: *blocks playing and undoing once the backend reports the game is over* |

The brief adds that "frontend tests may cover component rendering and API integration points". Rendering is covered by every component spec, starting with `board.component.spec.ts`. The API integration points are covered by `game-api.service.spec.ts` (each endpoint's method, URL and body) and `game-page.component.spec.ts` (a click travels to the right endpoint, and the reply is what gets rendered).

[Requirements traceability](TRACEABILITY.md) maps every other requirement of the brief to code and tests.

## What is not covered, and why

| Gap | Why it is acceptable here | What would close it |
|---|---|---|
| No end-to-end browser tests in the repository or CI | Each layer is covered by its own suite, and real-browser behaviour was checked with scripted headless-Chrome runs during development. A Playwright setup adds a browser download and a second runner to a small exercise. | A Playwright suite that starts both servers and plays one game per mode |
| No coverage measurement or threshold | Coverage was not a goal. The tests are written per requirement (see the table above). `coverlet.collector` is referenced, but no coverage gate is configured, and the frontend has no coverage provider installed. | `dotnet test --collect:"XPlat Code Coverage"` plus a report step; `@vitest/coverage-v8` with `ng test --coverage` |
| Frontend tests run in jsdom, not a real browser | jsdom covers the DOM, events and Angular rendering. Layout, CSS, the responsive breakpoints and the animation were checked visually with screenshots. | Vitest browser mode or Playwright visual comparisons |
| The rate limit is not tested per IP address | The in-memory test server has no remote address, so every test request falls into one partition. The partition key is one line of configuration in `ServiceCollectionExtensions`. | A test with a custom `RemoteIpAddress` set through middleware |
| No test sends a request to a game the cleanup has removed | The cleanup is tested at the repository and timer level. A removed game answers through the same "not found" path that `GetGame_UnknownId_Returns404Problem` covers. | An HTTP test with an injected `FakeTimeProvider` |
| Unexpected exceptions (500), 415 and a non-GUID id have no permanent tests | These are framework behaviours. They were confirmed with temporary probe tests and the smoke test (see below), then the probes were removed so the suite only pins this project's own rules. | Permanent HTTP tests, if the behaviour is ever customised |
| The containers are built but never started in a test, so nginx routing, the forwarded-headers setting and the hosting configurations are unchecked | Docker is not installed on the development machine. CI's Docker job validates `docker-compose.yml` and builds both images, but does not run them. | A `docker compose up` smoke test in CI that calls `/health` and plays one move through nginx |
| No automated accessibility audit | The specs assert the accessible names and roles that matter (cell labels, `aria-live`, `role="alert"`, skip link), but no rule engine runs. | axe-core in a browser test |
| No load or performance tests | A demo with in-memory state on one instance; the per-game lock is short. | k6 or NBomber against a deployed instance |
| Option B (undo after completion adjusts the scoreboard) | Not implemented: the project chose Option A, so there is nothing to test. | — |

## How to extend

### Adding a test for a new game rule

1. **Decide where the rule lives.** A rule of Tic Tac Toe goes in `GameEngine`. A product rule (one that depends on the mode, the computer or the scoreboard) goes in `GameSession`.
2. **Write the Core test first,** next to its neighbours in [GameEngineTests](../backend/TicTacToe.Tests/Core/Engine/GameEngineTests.cs) or [GameSessionTests](../backend/TicTacToe.Tests/Core/Sessions/GameSessionTests.cs):
   - Name it `Method_Scenario_ExpectedOutcome`.
   - Build the position with `TestGames.Play(...)` or `TestBoards.Parse("X..", ".O.", "...")`.
   - For a rejection, assert the exact `GameRuleException` message. Then assert that nothing changed, as `AssertStillOnlyXInCenter` does: same turn, same board, same history, same status.
   - For a computer rule, choose a board where the new rule picks a different cell than every later rule. Otherwise the test passes even when the rule is skipped.
3. **Add an HTTP test only if the rule changes what goes over the wire,** such as a new status code or a new field. Use [GamesApiTests](../backend/TicTacToe.Tests/Api/Integration/GamesApiTests.cs) and assert the raw JSON. A new rejection already becomes 400 problem+json through `GameExceptionHandler`.
4. Run `dotnet test`.

### Adding a test for a new endpoint

1. **Service level:** add a test to [GameServiceTests](../backend/TicTacToe.Tests/Api/Application/GameServiceTests.cs) with the real `InMemoryGameRepository` and `Scoreboard`. Assert the DTO, and assert `GameNotFoundException` for an unknown id.
2. **HTTP level:** add tests to `GamesApiTests`, or to a new class that creates its own `WebApplicationFactory<Program>` and implements `IDisposable`. Cover:
   - the success status and the raw JSON (`GetRawText()` pins names, casing and order);
   - the problem+json error cases;
   - the 404 for an unknown id.

   Use `WithWebHostBuilder(b => b.UseSetting(key, value))` to change a setting, as `RateLimitingTests` and `ConfigurationTests` do.
3. **Frontend:**
   - Add the method to `GameApiService` with a spec that asserts the method, URL and body through `HttpTestingController.expectOne({ method, url })`, flushes a response and calls `verify()` after each test.
   - Add the store action with a spec that stubs the service with `vi.fn()` returning `of(...)` or `throwError(...)`.
   - Build URLs from `TEST_APP_CONFIG.apiBaseUrl`.
4. Update [API.md](API.md) and [TicTacToe.Api.http](../backend/TicTacToe.Api/TicTacToe.Api.http).

### Adding a test for a new component

1. Create `<name>.component.spec.ts` next to the component.
2. Render it with `TestBed.createComponent(...)`. Set its signal inputs with `fixture.componentRef.setInput('name', value)`, exactly as a parent template binds them. Then call `await fixture.whenStable()`.
3. Query what a user perceives: text, `role`, `aria-label`, `disabled`. Prefer these to CSS internals, except for classes that carry meaning such as `cell--winning`.
4. Check outputs by subscribing a spy: `fixture.componentInstance.selected.subscribe(spy)`, then `expect(spy).toHaveBeenCalledExactlyOnceWith(...)`.
5. Provide only what the component needs:
   - `provideRouter([])` for `routerLink`;
   - `{ provide: APP_CONFIG, useValue: TEST_APP_CONFIG }` for configuration;
   - `provideHttpClient()` + `provideHttpClientTesting()` for HTTP;
   - `vi.useFakeTimers()` for timers, as in `error-toast.component.spec.ts`.
6. If the component changes the click → request → render flow of the game page, add a case to the wiring test `game-page.component.spec.ts`.
7. Run `npm run test:ci` and `npm run format:check`.

## Quality checks done

Beyond the suites themselves, these checks were run while the project was built:

**Mutation checks on the frontend.** Four deliberate bugs were introduced in the source, one at a time. The suite was run after each, and then the original line was restored and confirmed. Each bug failed exactly the test meant to catch it:

| Mutation | Test that failed |
|---|---|
| Toast auto-dismiss changed from 5000 ms to 3000 ms ([error-toast.component.ts](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts)) | *dismisses itself after 5 seconds* |
| `[class.cell--winning]` binding removed ([cell.component.html](../frontend/src/app/features/game/components/cell/cell.component.html)) | *highlights only the winning cells* |
| Player hard-coded to `'X'` in `GameStore.play` ([game.store.ts](../frontend/src/app/features/game/state/game.store.ts)) | *sends the move for the player whose turn the backend reported and shows the reply* |
| The "one request at a time" loading guard removed from the store | *ignores further actions, so a double click sends only one request* |

**Mutation-resistant test design on the backend:**

- Each `ComputerPlayerTests` board is chosen so that skipping the rule under test gives a different cell.
- `Reset_GameInProgress_KeepsIdAndMode` and `CreateGame_VsComputer_ReturnsEmptyGameWithXToMove` use VsComputer, because TwoPlayer is the enum's default value and would pass even if the mode were lost.
- `RecordResults_CalledInParallel_CountsEveryCall` fails without the scoreboard lock.

**Adversarial probes on the backend:**

- **Core sandbox.** A throwaway program exercised Core directly with about 60 checks before the test project ran. They covered every message and the validation order, every computer priority including "win beats block", pair undo, the record-once guard, and 30,000 parallel scoreboard updates totalling exactly 10,000 each.
- **Independent expected values.** The expected values in the Core tests were recalculated by an independent JavaScript re-implementation of the rules. That covers the computer's choices, the winning cells, and the final boards of the VsComputer games.
- **API probes.** Temporary probe tests were run and then deleted. They confirmed that:
  - an unexpected exception returns 500 problem+json with no internal details and is logged once;
  - an empty or `null` body returns 400 "A non-empty request body is required.";
  - a missing or `text/plain` content type returns 415;
  - `{"mode":"Chess"}`, `row: 1.5` and `col: null` each produce exactly one validation error;
  - a non-GUID id returns 404;
  - `"player": "x"` is accepted case-insensitively.
- **Smoke test.** A 21-step `curl` session against the running server covered every endpoint, every rule violation, Option A, VsComputer undo, a 404 and the CORS preflight. The output is recorded in [API.md](API.md#smoke-test-curl).

**Scripted browser checks (development only):**

- **Game screens.** Headless-Chrome screenshots at 1280, 800 and 500 px wide covered the game in progress, won (Vs Computer), drawn, and the error toast, against a fake server.
- **Docs portal.** Chrome DevTools Protocol scripts ran against the dev server and against a build served under `/ABB/`. They checked that:
  - a deep link such as `/docs/api#rate-limiting` scrolls to its heading;
  - links inside an article, and sidebar clicks, navigate without a page reload;
  - the table of contents scrolls, including on a repeated click;
  - the Word original downloads under the sub-path base href;
  - a missing document shows the "not published yet" state;
  - no route logs a console error.

**Static gates:**

- `TreatWarningsAsErrors` fails the backend build on any warning, including the xUnit analyzers' warnings.
- `ng build` must stay warning-free within its bundle and style budgets.
- `npm run format:check` (Prettier) keeps the frontend formatting consistent.
- `dotnet list package --vulnerable --include-transitive` reported no vulnerable packages at the end of the Web API phase.
