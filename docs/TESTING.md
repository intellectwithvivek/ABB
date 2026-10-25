# Testing

How the project is tested, how to run the tests, what each suite covers, and how the brief's testing expectations map to named tests.

Related documents: [Architecture](ARCHITECTURE.md) · [API reference](API.md) · [Requirements traceability](TRACEABILITY.md) · [Design decisions](DECISIONS.md)

## Strategy

**Each rule is tested where it lives.** The game rules sit in `TicTacToe.Core`, which has no ASP.NET dependency, so most backend tests are fast unit tests that need no web server. Each layer above adds only what it introduces: locking and mapping in the service, status codes and JSON shape over HTTP, rendering and state handling in the browser.

```text
                    /\          Browser end-to-end: scripted headless Chrome against the real
                   /  \         UI and API, run during development (not in CI)
                  /----\
                 /      \       HTTP integration: 43 tests
                /--------\      WebApplicationFactory<Program>, the real pipeline in memory
               /          \     Service, infrastructure, error handling: 17 tests
              /------------\    GameService, repository, idle-game cleanup, exception handler
             /              \   Core unit: 70 tests
            /----------------\  board, engine, session, computer player, scoreboard

   Frontend (Vitest): 170 tests for components, the store, the API service, routing and the docs portal
```

| Level | Tooling | What it proves |
|---|---|---|
| Core unit | xUnit 2.9, plain `Assert` | Every game rule, with the exact error message and a "nothing changed" check after each rejected action |
| Service, infrastructure, error handling | xUnit with the real `InMemoryGameRepository` and `Scoreboard`, `FakeTimeProvider` | DTO mapping, unknown ids, the per-game lock under parallel requests, idle-game cleanup, and error responses an in-memory server cannot produce (413) |
| HTTP integration | `Microsoft.AspNetCore.Mvc.Testing` (`WebApplicationFactory<Program>`) | Status codes, `Location`, the raw JSON (camelCase, string enums, `null` cells, property order), problem+json bodies, CORS, rate limits, `/health`, Swagger and startup validation |
| Angular unit and component | Vitest 4 + jsdom through `ng test` (`@angular/build:unit-test`) | Rendering and events of each component, store behaviour, the exact HTTP calls (`HttpTestingController`), routing, titles and the Markdown renderer |
| Browser end-to-end | Headless Chrome over the DevTools Protocol, from Node scripts | Real rendering, navigation and game play against the running API (see [Quality checks](#quality-checks)) |

Conventions:

- **Backend test names** follow `Method_Scenario_ExpectedOutcome`, e.g. `ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`. Each case the brief requires has its own test; `[Theory]` with `[InlineData]` is used only to check one behaviour over several inputs (coordinates, rows, columns, invalid values).
- **No mocking library on the backend.** Tests use the real repository and scoreboard; time is the only fake (`FakeTimeProvider`). xUnit creates a new test-class instance per test (like JUnit), so every test starts from fresh state.
- **Frontend tests read as sentences** (`ignores further actions, so a double click sends only one request`) and query the DOM as a user or screen reader would: by role, `aria-label`, `aria-live` or visible text. Only the network is replaced (`HttpTestingController`); the store spec stubs `GameApiService` with `vi.fn()`.

## How to run

Windows PowerShell, from the repository root.

**Backend** (.NET 8 SDK):

```powershell
cd backend
dotnet test                                                      # build and run all 130 tests
dotnet test --filter "FullyQualifiedName~TicTacToe.Tests.Core"   # Core unit tests only (70)
dotnet test --filter "FullyQualifiedName~GameEngineTests"        # one test class
dotnet test --logger "console;verbosity=normal"                  # list every test with its result
```

**Frontend** (Node.js 22 or 24 LTS):

```powershell
cd frontend
npm ci                                       # once: installs the exact locked versions
npm run test:ci                              # one run of all 170 tests
npm test                                     # watch mode
npx ng test --watch=false --include "src/app/features/game/**/*.spec.ts"   # one folder
npm run format:check                         # Prettier check
```

**Continuous integration.** [ci.yml](../.github/workflows/ci.yml) runs on every push and pull request to `main` (Ubuntu): the backend job restores, builds and tests in Release; the frontend job runs `npm ci`, `npm run build`, `npm run test:ci` and `npm run format:check`; after the backend job passes, a Docker job builds the API image from `backend/Dockerfile`. Render deploys a commit only after these checks pass.

**Manual checks.** Run the API (`dotnet run --project backend/TicTacToe.Api`) and use Swagger UI at `http://localhost:5000/swagger`, or send the requests in [TicTacToe.Api.http](../backend/TicTacToe.Api/TicTacToe.Api.http). The [API smoke test](API.md#smoke-test-curl) records a 22-step `curl` session against the running server.

**Troubleshooting on Windows:**

- **`dotnet` not found:** add it to the session's PATH with `$env:PATH = "C:\Program Files\dotnet;" + $env:PATH`.
- **`0x800711C7` ("An Application Control policy has blocked this file"):** Windows Smart App Control occasionally blocks the freshly built, unsigned test assembly. Rebuild and run again. Linux CI runners are not affected.

## Totals

Measured with the commands above on 2026-10-25. The counts are what the runners report, so each `[InlineData]` row and each `it.each` case counts as one test.

| Suite | Files | Tests |
|---|---|---|
| Backend: Core unit (`Core/`) | 7 | 70 |
| Backend: API service, infrastructure and error handling (`Api/Application`, `Api/Infrastructure`, `Api/ErrorHandling`) | 4 | 17 |
| Backend: API HTTP integration (`Api/Integration`) | 4 | 43 |
| **Backend total** (`dotnet test`: Core 70 + API 60) | **15** | **130** |
| **Frontend total** (`npm run test:ci`) | **26 spec files** | **170** |

## What each suite covers

### Backend (`backend/TicTacToe.Tests`)

- **Board and players** (`Core/Domain`): coordinates 0–2 only; placing on an occupied cell throws (an invariant guard) and leaves the board unchanged; the board is full only with the ninth mark; free cells are listed row by row; `Opponent()`.
- **Game engine** (`Core/Engine`): a valid move is placed, recorded and passes the turn. Off-board, occupied-cell and wrong-player moves are rejected with their exact messages, and turn, board, history and status stay unchanged; when several rules are broken, the first in validation order is reported. A move after a win or a draw is rejected. Wins on every row, every column and both diagonals report the right winning cells; a full board with no line is a draw; a ninth move that completes a line is a win; undoing a winning move recalculates the status.
- **Computer player** (`Core/Opponents`): one test per priority rule, "win beats block", and the full-board guard. Each board is chosen so that skipping the rule under test picks a different cell.
- **Game sessions** (`Core/Sessions`): Two Player undo and move numbering; undo rejected with no moves and after a win or a draw (Option A); Reset keeps id, mode and scoreboard; each result is recorded exactly once, including after a rejected move, a rejected undo, a Reset and a mid-game scoreboard reset. Vs Computer: the reply arrives in the same call, never after a rejected move or a finished game; undo removes the human's move and the reply together; one test plays all 489 possible games against the computer.
- **Scoreboard** (`Core/Scoring`): each result raises only its own counter; Reset zeroes everything; 30,000 parallel updates are all counted.
- **Service** (`Api/Application`): mapping to the response DTOs; `GameNotFoundException` for unknown ids; the per-game lock (of 50 parallel moves to one cell exactly one succeeds; of 32 parallel undos on three move pairs exactly three succeed; a reader never sees a human move without the computer's reply).
- **Infrastructure and error handling** (`Api/Infrastructure`, `Api/ErrorHandling`): idle games are removed by cutoff, on a `FakeTimeProvider` timer, and the cleanup survives a failing repository; an oversized body becomes 413 problem+json; a client that does not accept JSON still gets the right status code.
- **HTTP contract** (`Api/Integration`): 201 with `Location` and the full JSON in its fixed property order; one validation error for a missing or unknown `mode`, a missing `col` or an invalid `player`; 415 for a non-JSON body; 400 with `detail` for each broken rule; 404 for an unknown id and for an id that is not a GUID; 500 without exception details; undo and reset in both modes; CORS allowed for `http://localhost:4200` only, and present on error responses; the scoreboard endpoints; 429 with `Retry-After` (and plain text when JSON is not accepted), with `/health` and preflights exempt and a separate create-game limit; Swagger served, free of `text/plain`, and switchable off; startup fails on invalid settings; `/health` returns `Healthy`.

Helpers: [TestBoards](../backend/TicTacToe.Tests/TestSupport/TestBoards.cs) builds and compares a board from three strings such as `"XO."`; [TestGames](../backend/TicTacToe.Tests/TestSupport/TestGames.cs) plays a sequence of cells, each by whoever's turn it is.

### Frontend (`frontend/src/**/*.spec.ts`)

- **Game feature:** the board, cell, controls, status bar, move history and scoreboard components (rendering, accessible names, events, locked cells that keep keyboard focus, live-region announcements); `GameStore` (create or resume a game, moves sent for the backend's `currentPlayer`, re-sync after a rejected move, a new game when the server no longer has the old one, one request at a time, error clearing); `GameApiService` (method, URL and body of every endpoint); and a wiring test of the whole page with the real store, service and components.
- **Core and shared:** `toErrorMessage` (unreachable server, 502/503/504 "starting up", then `detail`, the first validation error, `title`, a generic message); site header and footer; the error toast, which stays until dismissed.
- **App shell and routing:** every route renders its page with the right browser title; the skip link; focus moves to `<main>` after in-app navigation.
- **Documentation portal:** catalog integrity; the Markdown renderer (GitHub-compatible anchors, in-app and GitHub links, images, sanitizer-safe output); link resolution; the in-app link directive; the viewer's loaded, not-found and failed states; table of contents, hub page and sidebar.
- **Home page:** pitch, calls to action, review steps, feature map and key documents.

Fixtures: `TEST_APP_CONFIG` (URLs that differ from every environment file, so code that bypasses the `APP_CONFIG` token fails) and `createGameState(overrides)`.

## Brief's testing expectations mapped to tests

Every case on the brief's list has at least one dedicated Core test, and most are also checked through the service, over HTTP and in the UI.

| Expectation | Backend tests | Frontend tests |
|---|---|---|
| Valid move | `GameEngineTests.ApplyMove_ValidMove_PlacesMarkAndRecordsMove`; `GameServiceTests.SubmitMove_ValidMove_MapsBoardHistoryAndTurn`; `GamesApiTests.SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn` | store: *sends the move for the player whose turn the backend reported and shows the reply*; page: *sends a clicked cell as a move and renders the board and history the backend returns* |
| Invalid move | `GameEngineTests.ApplyMove_OutsideBoard_ThrowsAndKeepsTurn` (4 cases), `ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`, `ApplyMove_WrongPlayer_ThrowsAndKeepsTurn`, `ApplyMove_SeveralRulesBroken_ReportsFirstRuleInValidationOrder`; `GameSessionVsComputerTests.PlayMove_SubmittedAsO_ThrowsAndChangesNothing`; `GamesApiTests.SubmitMove_OccupiedCell_Returns400ProblemWithDetail`, `SubmitMove_OutsideBoard_Returns400ProblemWithDetail`, `SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame` | board: *does not emit when an occupied cell is clicked*; store: *shows why a move was rejected next to the board the server actually has*; page: *shows a rejected move in a toast and re-syncs the board with the server* |
| Turn switching | `GameEngineTests.ApplyMove_ValidMove_PassesTurnToOtherPlayer` (the rejection tests above assert the turn is unchanged); `GamesApiTests.SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn` | status bar: *shows "Player O's turn"* |
| Row win | `GameEngineTests.ApplyMove_CompletesRow_WinsWithRowCells` (rows 0–2); `GamesApiTests.SubmitMove_WinningMove_ReturnsWinnerAndWinningCells` | board: *highlights only the winning cells*; status bar: *shows "Player X wins!"* |
| Column win | `GameEngineTests.ApplyMove_CompletesColumn_WinsWithColumnCells` (columns 0–2) | Same winning-cell rendering |
| Diagonal win | `GameEngineTests.ApplyMove_CompletesMainDiagonal_WinsWithDiagonalCells`, `ApplyMove_CompletesAntiDiagonal_WinsWithDiagonalCells`, `ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw` | Same winning-cell rendering |
| Draw | `GameEngineTests.ApplyMove_FillsBoardWithoutLine_EndsInDraw`; `GameSessionVsComputerTests.PlayMove_HumanFillsLastCell_ComputerDoesNotMove` | status bar: *shows "It's a draw!"* |
| Reset game | `GameSessionTests.Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard`, `Reset_GameInProgress_KeepsIdAndMode`, `Reset_ThenNextGameEnds_RecordsNextResultToo`; `GameServiceTests.Reset_AfterWin_KeepsIdAndModeAndScoreboard`; `GamesApiTests.Reset_AfterMove_Returns200WithEmptyBoardAndSameId` | store: *resetGame sends the game id and shows the fresh board* |
| Undo in two-player mode | `GameSessionTests.Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`, `Undo_NoMoves_ThrowsNothingToUndo`, `Undo_AfterWin_ThrowsBecauseGameEnded`, `Undo_AfterDraw_ThrowsBecauseGameEnded`; `GamesApiTests.Undo_TwoPlayer_Returns200WithLastMoveRemoved`, `Undo_AfterWin_Returns400Problem` | store: *undo sends the game id and shows the restored state*; controls: *disables Undo Last Move when there is nothing to undo* |
| Undo in computer mode | `GameSessionVsComputerTests.Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`, `Undo_AfterTwoRounds_RemovesOnlyLastPair`, `Undo_RepeatedUntilEmpty_RemovesOnePairEachTimeThenThrows`, `Undo_ComputerWon_ThrowsAndKeepsResult`; `GameServiceTests.Undo_ParallelRequests_RemoveEachPairExactlyOnce`; `GamesApiTests.Undo_VsComputer_Returns200WithBothMovesRemoved` | The UI sends the same request in both modes; the pair rule is server-side |
| Scoreboard update | `GameSessionTests.PlayMove_GameWon_RecordsWinExactlyOnce`, `PlayMove_GameDrawn_RecordsDrawExactlyOnce`; all 6 `ScoreboardTests`; `GameServiceTests.GetGame_AfterAnotherGameEnded_ReturnsSharedScoreboard`; `GamesApiTests.GetScoreboard_AfterXWins_ReturnsOneXWin`, `ResetScoreboard_AfterXWins_ReturnsAndKeepsZeroedScoreboard` | scoreboard: *shows X wins, O wins and draws from the backend*; store: *resetScoreboard replaces only the scoreboard part of the snapshot* |
| Computer move selection | All 7 `ComputerPlayerTests`; `GameSessionVsComputerTests.PlayMove_HumanMoves_ComputerRepliesInSameCall`; `GamesApiTests.SubmitMove_VsComputer_Returns200WithComputerReply` | status bar: *shows "Computer wins!"* |
| Move after game completion | `GameEngineTests.ApplyMove_AfterGameWon_ThrowsGameOver`, `ApplyMove_AfterDraw_ThrowsGameOver`; `GameSessionVsComputerTests.PlayMove_HumanCompletesLine_ComputerDoesNotMove`, `PlayMove_EveryPossibleGame_ComputerRepliesOnlyWhileInProgressAndResultIsRecordedOnce`; `GamesApiTests.SubmitMove_AfterWin_Returns400ProblemWithDetail` | board: *disables every cell when the game is over*; store: *blocks playing and undoing once the backend reports the game is over* |

The brief adds that "frontend tests may cover component rendering and API integration points": every game component has its own rendering spec, `game-api.service.spec.ts` pins each endpoint's method, URL and body, and `game-page.component.spec.ts` follows a click to the right endpoint and renders the reply.

## Quality checks

Checks run during development in addition to the suites:

- **Adversarial probes of the rules.** Before the test project existed, a throwaway program exercised Core with about 60 checks (every message and the validation order, every computer priority, pair undo, the record-once guard, parallel scoreboard updates). The expected values in the Core tests (computer choices, winning cells, final boards) were recomputed by an independent re-implementation of the rules. Exhaustive play confirmed that all 489 possible games against the computer end correctly; the human wins 12 of them, because the brief's priority rules have no defence against a fork.
- **API probes.** Temporary probes against the running server confirmed: 500 problem+json without internal details, logged once; 400 `A non-empty request body is required.` for an empty or `null` body; 415 for a missing or `text/plain` content type; exactly one validation error for `{"mode":"Chess"}`, `"row": 1.5` and `"col": null`; 404 for a non-GUID id; `"player": "x"` accepted case-insensitively. Several probes became permanent tests, e.g. `GetGame_IdNotAGuid_Returns404Problem` and `GetGame_UnexpectedServerError_Returns500ProblemWithoutExceptionDetails`.
- **Scripted browser end-to-end runs.** Node scripts drove headless Chrome over the DevTools Protocol against the Angular app and the real API running locally: the home page; Two Player and Vs Computer games played to a result; undo, reset and the scoreboard; resuming after a refresh; the expired-game and network-failure toasts; every document in the portal, including `#fragment` deep links, in-app navigation without a reload and the `.docx` download; the not-found pages; narrow screens; and no console errors. A separate run restarted the API mid-game and confirmed that the next click starts a new game with the "expired" message. Screenshots at 1280, 800 and 500 px checked the layout, and every route was checked at 390 px for sideways scrolling.
- **Frontend mutation checks.** Deliberate bugs were introduced one at a time; each failed exactly the test meant to catch it, and the original line was then restored.

  | Mutation | Test that failed |
  |---|---|
  | `[class.cell--winning]` binding removed from `cell.component.html` | *highlights only the winning cells* |
  | Player hard-coded to `'X'` in `GameStore.play` | *sends the move for the player whose turn the backend reported and shows the reply* |
  | The one-request-at-a-time guard removed from the store | *ignores further actions, so a double click sends only one request* |

- **Mutation-resistant backend tests.** Each `ComputerPlayerTests` board makes a skipped rule pick a different cell; `Reset_GameInProgress_KeepsIdAndMode` and `CreateGame_VsComputer_ReturnsEmptyGameWithXToMove` use Vs Computer because Two Player is the enum's default and would pass even if the mode were lost; `RecordResults_CalledInParallel_CountsEveryCall` fails without the scoreboard's lock.
- **Live deployment.** The published site was checked for deep links, the documentation, and the API and Swagger UI through the Vercel proxy, plus `/health` on the API host.
- **Clean-clone verification (2026-10-25, commit `b599059`).** A fresh `git clone` from GitHub into an empty folder, then only the README commands in Windows PowerShell 5.1 (with `C:\Program Files\dotnet` added to `PATH`, as the README's troubleshooting describes): `dotnet test` passed 130/130; `npm ci` then `npm run test:ci` passed 170/170 in 26 files; `npm run build` finished with no warnings. With the API (`dotnet run --project TicTacToe.Api`, run with `--no-launch-profile` and the profile's URL and environment so no browser window opened) and `npm start` running from the clone, the scripted browser run passed all 24 scenarios.
- **Static gates.** `TreatWarningsAsErrors` fails the backend build on any warning (including xUnit analyzers); `ng build` stays within its bundle and style budgets; Prettier checks formatting; `dotnet list package --vulnerable --include-transitive` reports no vulnerable packages, and `npm audit --omit=dev` reports none in the frontend's runtime dependencies.

## What is not covered, and why

| Gap | Why it is acceptable here | What would close it |
|---|---|---|
| No browser end-to-end suite in the repository or CI | Each layer has its own suite, and real-browser behaviour was verified with the scripted runs above. A Playwright setup adds a browser download and a second runner to a small exercise. | A Playwright suite that starts both servers and plays one game per mode |
| No coverage measurement or threshold | Tests are written per requirement (see the mapping above), not to a percentage. | A coverage collector with a report step in CI; `@vitest/coverage-v8` on the frontend |
| Frontend tests run in jsdom, not a real browser | jsdom covers the DOM, events and Angular rendering; layout and responsive breakpoints were checked with screenshots. | Vitest browser mode or visual comparisons |
| Rate limiting per IP address | The in-memory test server has no remote address, so all test requests share one partition. | A test that sets `RemoteIpAddress` through middleware |
| An HTTP request for a game the cleanup has just removed | Cleanup is tested at repository and timer level; a removed game answers through the same 404 path as `GetGame_UnknownId_Returns404Problem`, and the store's reaction is tested. | An HTTP test with an injected `FakeTimeProvider` |
| 405 bodies and lenient JSON readings (`"row": "1"` read as a number) | `UseStatusCodePages` gives 405 the same problem+json shape as the tested non-GUID 404; Core still validates every value. Both were confirmed by probes. | HTTP tests that pin them, or a strict number-handling setting |
| The API container is built in CI but never started there; the proxy's forwarded headers and the Vercel rewrites are not tested automatically | These are hosting configuration, checked against the live deployment. | A CI smoke test that runs the image and calls `/health` and one game endpoint |
| No automated accessibility audit | The specs assert the names and roles that matter (cell labels, `aria-live`, `role="alert"`, skip link), but no rule engine runs. | axe-core in a browser test |
| No load or performance tests | A single in-memory instance with a short per-game lock. | k6 or NBomber against a deployed instance |

## How to extend

**A new game rule.**

1. Put a Tic Tac Toe rule in `GameEngine`, and a product rule (mode, computer, scoreboard) in `GameSession`.
2. Write the Core test first, beside its neighbours in [GameEngineTests](../backend/TicTacToe.Tests/Core/Engine/GameEngineTests.cs) or [GameSessionTests](../backend/TicTacToe.Tests/Core/Sessions/GameSessionTests.cs). Build the position with `TestGames.Play(...)` or `TestBoards.Parse(...)`; for a rejection, assert the exact `GameRuleException` message and that turn, board, history and status are unchanged.
3. Add an HTTP test in [GamesApiTests](../backend/TicTacToe.Tests/Api/Integration/GamesApiTests.cs) only if the wire format changes; a new `GameRuleException` already becomes 400 problem+json through `GameExceptionHandler`.

**A new endpoint.**

1. Service: a test in [GameServiceTests](../backend/TicTacToe.Tests/Api/Application/GameServiceTests.cs) with the real repository and scoreboard, including `GameNotFoundException` for an unknown id.
2. HTTP: the success status and raw JSON (`GetRawText()` pins names, casing and order), the problem+json errors and the 404. Use `WithWebHostBuilder(b => b.UseSetting(key, value))` to change a setting, as `RateLimitingTests` does.
3. Frontend: a `GameApiService` spec asserting method, URL and body with `HttpTestingController.expectOne(...)` and `verify()`; a store spec with the service stubbed by `vi.fn()`; URLs built from `TEST_APP_CONFIG.apiBaseUrl`.
4. Update [API.md](API.md) and [TicTacToe.Api.http](../backend/TicTacToe.Api/TicTacToe.Api.http).

**A new component.**

1. Create `<name>.component.spec.ts` next to the component and render it with `TestBed.createComponent(...)`; set inputs with `fixture.componentRef.setInput(...)` and `await fixture.whenStable()`.
2. Query what a user perceives (text, role, `aria-label`, disabled state) and check outputs with a `vi.fn()` subscribed to the output.
3. Provide only what the component needs: `provideRouter([])`, `{ provide: APP_CONFIG, useValue: TEST_APP_CONFIG }`, `provideHttpClient()` with `provideHttpClientTesting()`, or `vi.useFakeTimers()`.
4. Run `npm run test:ci` and `npm run format:check`.
