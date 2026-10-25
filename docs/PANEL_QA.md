# Panel Q&A

These are the questions the review panel is likely to ask, each with a short answer based on this codebase. Every link points to a real file, and every name in `code` is a real class, method or test.

Jump to: [60-second walkthrough](#60-second-walkthrough) · [If they ask you to change something live](#if-they-ask-you-to-change-something-live)

Related documents: [Problem statement](PROBLEM_STATEMENT.md) · [Specification prompt](SPEC_PROMPT.md) · [API reference](API.md) · [Design decisions](DECISIONS.md) · [AI workflow](AI_WORKFLOW.md) · [Testing](TESTING.md) · [Deployment](DEPLOYMENT.md)

---

## Architecture & state ownership

### 1. Why is the backend the single source of truth, and what does the frontend keep?

The brief says the backend owns the game. Keeping every rule in one place also means the UI cannot drift from the server, and a modified client cannot cheat. All rules live in TicTacToe.Core ([`GameEngine`](../backend/TicTacToe.Core/Engine/GameEngine.cs), [`GameSession`](../backend/TicTacToe.Core/Sessions/GameSession.cs)). The API only maps HTTP to Core calls, and every game endpoint returns the full `GameStateResponse`.

The Angular [`GameStore`](../frontend/src/app/features/game/state/game.store.ts) holds that last snapshot in a read-only `game` signal and never edits it. The only client-side state is UI state: `selectedMode`, `loading` and `errorMessage`, plus the game id in `sessionStorage` so that a page refresh resumes the game. Even flags such as `canUndo` come from the server.

### 2. How are game sessions stored, and what happens when the server restarts?

Each game is a `GameSession` object stored in [`InMemoryGameRepository`](../backend/TicTacToe.Api/Infrastructure/Persistence/InMemoryGameRepository.cs). That class is a `ConcurrentDictionary<Guid, SessionEntry>`, registered as a singleton behind the [`IGameRepository`](../backend/TicTacToe.Api/Application/IGameRepository.cs) interface. The scoreboard is a singleton [`Scoreboard`](../backend/TicTacToe.Core/Scoring/Scoreboard.cs). `SessionEntry` also records a `LastUsed` time, which is how idle games get removed (see question 30).

Memory is the only storage, so a restart (or a Render free-tier spin-down) loses every game and the scoreboard. The brief allows in-memory storage, and this limitation is documented. The UI recovers on its own:

- On page load, `GameStore.init()` tries `getGame` with the saved id. If that fails for any reason, it calls `createGame`.
- If the game disappears in the middle of play, the next request shows the 404 toast "Game '…' was not found.", and New Game starts over.

### 3. How do you handle concurrency?

Concurrency is handled in three places:

- **Repository:** the `ConcurrentDictionary` makes adding and finding games thread-safe without a global lock.
- **One game:** `GameService.RunLocked` in [`GameService.cs`](../backend/TicTacToe.Api/Application/GameService.cs) locks that game's `GameSession.SyncRoot`, runs the action and builds the response inside the lock. Two requests for the same game (a double click, for example) run one after the other, while requests for different games run in parallel. `GetGame` takes the lock too, so it never sees the human's move without the computer's reply.
- **Scoreboard:** `Scoreboard` guards its three counters with a private lock. Locks are always taken in the order game, then scoreboard, never the reverse, so they cannot deadlock.

`SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds` sends 50 parallel moves to one cell and asserts that exactly one is accepted. The frontend also ignores clicks while a request is in flight. These locks only work inside one process, so running several API instances would need a shared store with optimistic concurrency.

## Game logic

### 4. How does win detection work?

[`Board.Lines`](../backend/TicTacToe.Core/Domain/Board.cs) lists the 8 winning lines (3 rows, 3 columns, 2 diagonals) written out in full, so they can be checked by eye. After every change (move, undo or reset), the private `GameEngine.EvaluateOutcome()` looks for the first line whose three cells hold the same mark (`IsCompletedLine`):

- If it finds one, it sets `Status = Won`, plus `Winner` and `WinningCells`.
- If not, a full board is a `Draw` and anything else is `InProgress`.

Wins are checked before draws, so a ninth move that completes a line counts as a win (`ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`). The outcome is recomputed from the board each time rather than updated step by step, so it can never be out of date.

### 5. How does undo restore the previous state, including the computer's move?

The engine stores only the board and the move list; everything else is derived from them. `CurrentPlayer` is `_moves.Count % 2 == 0 ? Player.X : Player.O`. `GameEngine.UndoLastMove()` removes the last `Move`, clears its cell and runs `EvaluateOutcome()` again, so the board, turn, status and history are restored together.

The undo rules for each mode live in `GameSession.Undo()`:

- Undo is rejected once the game is won or drawn (Option A).
- In VsComputer mode, if the turn now belongs to the computer, it undoes one more move. So if X plays, O replies and the player presses Undo, both moves are removed and it is X's turn.

A single `if` is enough for that second undo. The computer always replies in the same request, so between requests a VsComputer game always has an even number of moves. Covered by `Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn`, `Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn` and `Undo_AfterTwoRounds_RemovesOnlyLastPair`.

### 6. How does the computer choose its move?

[`ComputerPlayer.ChooseMove`](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs) is a chain of `??` expressions, one line per rule, in the brief's order:

1. Complete its own line (`FindLineCompletingMove(board, computer)`).
2. Block the opponent's line (`FindLineCompletingMove(board, computer.Opponent())`).
3. Take the centre.
4. Take the first free corner, in the order (0,0), (0,2), (2,0), (2,2).
5. Take the first free cell, row by row.

The helpers return `Position?` on purpose. `Position` is a struct, so `FirstOrDefault` would return (0,0), a real cell, when nothing matched.

The computer is deterministic, so `ComputerPlayerTests` has one test per rule. `GameSession.PlayMove` only calls it while the game is `InProgress`, so it never moves after the game has ended. It can be beaten, because the brief's rules include no defence against a fork (a move that creates two threats at once). For example, X wins by playing (0,0), (2,2), (2,0) and then (1,0). That is why minimax is on the "more time" list.

### 7. How do you make sure the scoreboard is updated exactly once per game?

`GameSession.RecordResultIfFinished()` runs after every move that is applied, the human's and the computer's. It records a win or a draw only if the game has finished and the private `_resultRecorded` flag is not set yet. Only `GameSession.Reset()` clears that flag.

The structure already prevents a finished game from changing: the engine rejects moves after the end, and Option A rejects undo. The explicit flag means the scoreboard rule does not depend on those two rules staying in place. The client never reports results; only the server changes the scoreboard.

Tests:
- `PlayMove_GameWon_RecordsWinExactlyOnce` and `PlayMove_GameDrawn_RecordsDrawExactlyOnce` check the score after a rejected extra move, a rejected undo and a reset.
- `Reset_ThenNextGameEnds_RecordsNextResultToo` checks that the game after a reset is counted too.

## API design

### 8. Why does every endpoint return the full game state instead of only what changed?

A `GameStateResponse` is a few hundred bytes. Sending all of it lets the frontend simply replace its snapshot: nothing to merge, no ordering bugs and no game rules in the client. One response carries the computer's reply, the winning cells, `canUndo` and the scoreboard, so a single round trip has everything needed to render. Sending only the changes would save bytes that do not matter here, and the client would have to rebuild the state itself, which the brief says the frontend must not do.

### 9. Which status codes do you return, and what does an error look like?

`POST /api/games` returns **201 Created** with a `Location` header (`CreatedAtAction(nameof(GetGame), …)` in [`GamesController`](../backend/TicTacToe.Api/Controllers/GamesController.cs)). The other successful calls return **200** with the body. Errors:

| Status | When |
|---|---|
| 400 | A game rule is broken, or the request body is malformed |
| 404 | No game has that id. An id that is not a GUID also gets 404, because it does not match the `{id:guid}` route constraint. |
| 415 | The request has no JSON content type |
| 429 | The client is over the rate limit |
| 500 | Anything unexpected; the response contains no internal details |

Every error is RFC 7807 `application/problem+json`, with `title`, `status` and a `detail` the player can read, such as "Cell (row 0, col 0) is already taken by X." The full table is in [API reference: Errors](API.md#errors). I used 400 rather than 409 or 422 for rule violations because the brief asks for 400, and the client handles all of them the same way.

### 10. Where does validation happen?

Validation happens in two layers, each with one job:

- **Request shape:** `[ApiController]` and System.Text.Json reject a body that is missing a `required` property, uses an unknown enum name, or sends a number for an enum (`JsonStringEnumConverter(allowIntegerValues: false)`). The response is an automatic `ValidationProblemDetails`.
- **Game rules:** `GameEngine.ApplyMove` checks, in this order, game over, off the board, wrong player and occupied cell. It throws `GameRuleException` with the message the player sees, and a rejected move changes nothing.

[`SubmitMoveRequest`](../backend/TicTacToe.Api/Contracts/Requests/SubmitMoveRequest.cs) deliberately has no `[Range]` on `Row`/`Col`. The board-size rule lives in Core, so there is one source of truth and one error message.

### 11. Is reset idempotent? Why are undo and reset POSTs?

Reset is idempotent in its effect. However many times you call `POST /api/games/{id}/reset`, the game ends up with the same id and mode, an empty board, X to move and the scoreboard unchanged. `POST /api/scoreboard/reset` is idempotent in the same way.

Both are POSTs because they are commands on a resource. PUT would mean the client sends a full replacement, which it does not. The brief's API table uses POST too.

Undo and moves are not idempotent, but they are still safe to repeat:
- A repeated move is rejected, because the cell is taken or it is the other player's turn.
- The store sends one request at a time, so a double click cannot send two undos.

To make retries safe over unreliable networks, I would add an expected move number or an `Idempotency-Key` header.

### 12. Why is `canUndo` part of the response?

Whether undo is allowed depends on product rules: Option A (no undo after a win or draw), at least one move, and pairing the moves in VsComputer mode. Those rules belong to the server. `GameSession.CanUndo` computes the flag (`Status == GameStatus.InProgress && Moves.Count > 0`), and [`ResponseMapper`](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs) copies it into the response. The Undo button follows `GameStore.canUndo`, which is `game.canUndo && !loading`. If we switched to Option B, only the backend would change.

## Angular

### 13. What do standalone components mean here, and how are pages loaded?

There are no NgModules. Each component lists what its template uses in its own `imports` array. Standalone has been the default since Angular 19, so `standalone: true` is not written out.

- **Startup:** [`main.ts`](../frontend/src/main.ts) calls `bootstrapApplication(AppComponent, appConfig)`. [`app.config.ts`](../frontend/src/app/app.config.ts) registers providers through functions: `provideRouter`, `provideHttpClient` and the `APP_CONFIG` value.
- **Lazy loading:** in [`app.routes.ts`](../frontend/src/app/app.routes.ts), every page uses `loadComponent`, so each page is a separate chunk loaded on demand. The `marked` Markdown library is only downloaded when someone opens the docs.
- **Route parameters:** `withComponentInputBinding()` delivers the `:slug` parameter as a signal input (`DocViewerPageComponent.slug`).
- **Titles:** `PageTitleStrategy` sets browser tab titles such as "Play · Tic Tac Toe".

### 14. How is state managed, and why a signals store rather than NgRx?

[`GameStore`](../frontend/src/app/features/game/state/game.store.ts) is a service provided at the root. It holds private writable signals (`gameState`, `selectedModeState`, `loadingState`, `errorMessageState`) and exposes them read-only with `asReadonly()`. It also exposes `computed` values such as `board`, `canPlay`, `canUndo` and `canReset`.

Components call methods that describe what the user wants: `play`, `undo`, `resetGame`, `newGame` and so on. One private `run()` helper sets `loading`, clears the error, subscribes to the HTTP Observable, and then stores either the result or the error message.

For one page and seven endpoints, NgRx would be mostly boilerplate. The store is close to a React context with `useState` and `useMemo`, except that signals update only what read them. RxJS stays where it fits, in the HTTP calls, and signals hold what the templates render.

### 15. Why is HttpClient wrapped in a service, and where does the API URL come from?

[`GameApiService`](../frontend/src/app/features/game/data-access/game-api.service.ts) is a thin wrapper with no logic: one method per endpoint, each returning a typed Observable. Components and the store never build URLs.

The base URL comes from the `APP_CONFIG` injection token ([`app-config.ts`](../frontend/src/app/core/config/app-config.ts)). `app.config.ts` provides it once, from the environment file that `angular.json` swaps in for each build:

| Build | API base URL |
|---|---|
| Local development | `http://localhost:5000/api` |
| Behind a same-origin proxy | `/api` |
| GitHub Pages | The Render URL |

Injecting a token instead of importing `environment` lets tests supply their own values (`TEST_APP_CONFIG`). It also makes `app.config.ts` the only file that knows which build is running. `game-api.service.spec.ts` checks every URL and request body with `provideHttpClientTesting()` and `HttpTestingController`.

### 16. How does change detection work?

The app runs without zone.js ("zoneless"), which is the default in Angular 21; there is no zone.js in `package.json`. Angular therefore does not patch timers and network calls to guess when something changed. It updates a view when a signal that view reads changes, when an input changes, or when a template event fires.

Every component also uses `ChangeDetectionStrategy.OnPush` with signal `input()`/`output()`, so Angular only checks components whose data actually changed. Presentational components derive their values with `computed`, for example `CellComponent.locked` and `ariaLabel`. The only side effect, the toast's auto-dismiss timer, is an `effect` that cancels its timer through `onCleanup`.

### 17. How are errors shown to the player?

Every failed request goes through `toErrorMessage()` in [`api-error.ts`](../frontend/src/app/core/http/api-error.ts):

- Status 0 (server down, wrong port, or a CORS refusal) becomes "Cannot reach the game server at … Is the backend running?"
- Otherwise it shows the ProblemDetails `detail`, then the first validation error, then the `title`.

The message is stored in `GameStore.errorMessage`. [`ErrorToastComponent`](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts) shows it as a small toast with `role="alert"` that does not block the page; the player can close it, and it closes itself after 5 seconds.

The last valid snapshot stays on screen, so a rejected move changes nothing in the UI, just as it changed nothing on the server. The UI also prevents most mistakes up front: occupied cells and a finished board are disabled. The server still checks every move.

### 18. How does the documentation portal work?

The portal renders the same files reviewers read on GitHub:

1. **Copy:** [`copy-docs.mjs`](../frontend/scripts/copy-docs.mjs) copies `README.md` and `docs/` into `public/content/` before `npm start` and `npm run build`. A copy step is needed because the Angular builder refuses asset folders outside the workspace.
2. **Fetch:** [`DocsService.getMarkdown`](../frontend/src/app/features/docs/data-access/docs.service.ts) fetches a file as text from a relative URL, so it also works under the `/ABB/` base path on GitHub Pages.
3. **Render:** [`renderMarkdown`](../frontend/src/app/features/docs/markdown/markdown-renderer.ts) converts it with `marked`, builds the "On this page" list, and rewrites links with `resolveDocLink`. Links to other documents in the catalog become in-app routes, source paths open on GitHub, and the original Word brief downloads.
4. **Display:** the HTML is inserted with `[innerHTML]`, which Angular sanitises. Sanitising removes `id` attributes, so `HeadingAnchorsDirective` sets the heading anchors after rendering. `InAppLinksDirective` sends in-app link clicks through the Router instead of reloading the page.

The list of documents is the typed `DOCS_CATALOG` in [`docs.catalog.ts`](../frontend/src/app/features/docs/docs.catalog.ts).

## .NET

### 19. Which DI lifetimes do you use, and why?

All registrations are in `AddGameServices` in [`ServiceCollectionExtensions.cs`](../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs):

| Service | Lifetime | Why |
|---|---|---|
| `IGameRepository` → `InMemoryGameRepository`, `IScoreboardService` → `Scoreboard` | Singleton | They hold the server's state, so every request must share one instance. That is also why both are thread-safe. |
| `GameService` | Scoped (one per request) | It holds no state of its own, and scoped stays correct if it later depends on a scoped `DbContext`. |
| `TimeProvider.System` | Singleton | Injected so tests can replace it with a fake clock. |
| `ExpiredSessionCleanupService` | Hosted service | Started and stopped with the app. |

The rule I follow is that a singleton never depends on something with a shorter lifetime; that mistake is called a captive dependency. In Spring terms: singleton beans for the stores, request scope for the service.

### 20. Why controllers rather than minimal APIs?

- `[ApiController]` returns an automatic 400 `ValidationProblemDetails` for malformed bodies.
- Attribute routing keeps each resource in one class ([`GamesController`](../backend/TicTacToe.Api/Controllers/GamesController.cs), [`ScoreboardController`](../backend/TicTacToe.Api/Controllers/ScoreboardController.cs)).
- `[ProducesResponseType]` documents every status code in Swagger.
- A controller reads like a Spring `@RestController`, which makes it easy to review.

Minimal APIs would be slightly shorter and are equally valid in .NET 8; with seven endpoints the difference is small. Each action is a one-line call to `GameService`, so switching would be mechanical.

### 21. How are domain objects mapped to DTOs?

Requests and responses are C# records in `Contracts/Requests` and `Contracts/Responses`. [`ResponseMapper`](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs) maps them by hand with `ToGameState(GameSession, ScoreSnapshot)` and `ToScoreboard(ScoreSnapshot)`. Small helpers turn the board into `board[row][col]`, `Position` into `CellDto`, and `Move` into `MoveDto`.

Keeping DTOs separate means the frozen JSON contract does not change when Core types change. I chose explicit mapping over AutoMapper because it is about forty lines, checked by the compiler, and easy to debug. The order of the record's constructor parameters is the order of the JSON properties, and `GamesApiTests` asserts that order.

### 22. How do exceptions become HTTP responses?

[`GameExceptionHandler`](../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs) implements .NET 8's `IExceptionHandler`. Its `TryHandleAsync` maps:

- `GameRuleException` to 400 "Invalid move"
- `GameNotFoundException` to 404 "Game not found"

It writes RFC 7807 ProblemDetails through `IProblemDetailsService`, with the exception message as `detail`. For any other exception it returns `false`, so the default handler answers 500 with no internal details, and the handler logs it as a real error.

`UseExceptionHandler()` is the first middleware, so controllers contain no try/catch. One .NET 8 detail: the exception middleware logs even handled exceptions as "unhandled". `AddErrorHandling` therefore filters out that log category, and the handler logs only the exceptions it did not expect.

### 23. How is configuration handled?

Each settings section has a typed class in [`Configuration/`](../backend/TicTacToe.Api/Configuration/): `FrontendCorsOptions`, `GameSessionOptions`, `RateLimitingOptions` and `ApiDocumentationOptions`. `AddValidatedOptions<T>()` binds each class with `Bind`, `ValidateDataAnnotations()` and `ValidateOnStart()`.

Data annotations such as `[MinLength(1)]` and `[Range]` mean a bad value stops the app at startup with a message naming the setting, instead of failing at the first request (`Startup_ZeroCleanupInterval_FailsWithValidationError`). Code reads the settings by injecting `IOptions<T>`. An environment variable such as `Cors__AllowedOrigins__0` can override any value; that is how the Render deployment sets its allowed origin.

### 24. What does the `required` keyword on the request records do?

`public required int Col { get; init; }` uses C# 11 required members. In .NET 8, System.Text.Json rejects a body without that property, and `[ApiController]` turns the failure into a 400 `ValidationProblemDetails`. Without `required`:

- A missing `"col"` would silently become 0 and place a mark in column 0.
- A missing `"mode"` would silently become `TwoPlayer`.

`init` keeps the records immutable after deserialisation. I also set `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes`, so a malformed body produces one clear error instead of an extra, vague "The request field is required." (`SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame`).

## Testing

### 25. What do the tests cover?

**Backend (xUnit, plain `Assert`).** There is one named test per required case, in folders that mirror the code:

- [`GameEngineTests`](../backend/TicTacToe.Tests/Core/Engine/GameEngineTests.cs): valid and invalid moves, turn switching, every row, column and both diagonals, draw, a ninth move that wins, and a move after the end.
- [`GameSessionTests`](../backend/TicTacToe.Tests/Core/Sessions/GameSessionTests.cs) and [`GameSessionVsComputerTests`](../backend/TicTacToe.Tests/Core/Sessions/GameSessionVsComputerTests.cs): undo in each mode, Option A, reset, the scoreboard counting once, and the computer replying in the same call but not after the end.
- [`ComputerPlayerTests`](../backend/TicTacToe.Tests/Core/Opponents/ComputerPlayerTests.cs): one test per priority rule, plus a test that winning beats blocking.
- `ScoreboardTests`: the counters, including parallel updates.

**API.** `GameServiceTests` covers mapping, unknown ids and the concurrency test. HTTP-level tests cover the JSON contract, problem+json errors, CORS, the health check, rate limiting, configuration and idle-game cleanup.

**Frontend (Vitest).** There are specs for every component, `GameStore`, `GameApiService`, `toErrorMessage`, and the docs rendering and link rewriting. [Testing](TESTING.md) maps each requirement to its tests.

### 26. What is not covered, and how would you extend the tests?

What is not covered:
- **End-to-end tests in a real browser.** The frontend tests render components in jsdom and fake the HTTP layer, so no automated test plays a game against the real API.
- **Load testing** and an **automated accessibility audit**.
- **Local Docker builds.** Only CI builds the Docker images.

How to extend:
- A new game rule gets a Core test that uses the helpers in [`TestSupport/`](../backend/TicTacToe.Tests/TestSupport/): `TestGames.Play` and `TestBoards.Parse("XO.", ".X.", "..O")`.
- A new endpoint gets a test in `GamesApiTests`.
- A new component gets a `*.spec.ts` file next to it.

Test names follow `Method_Scenario_ExpectedOutcome`. Playwright end-to-end tests in CI are the first thing I would add.

### 27. How do the API integration tests work?

`Program.cs` ends with `public partial class Program;`, so the test project can use `WebApplicationFactory<Program>`. The factory starts the real app on an in-memory test server, with no network port, including routing, JSON options, validation, the exception handler, CORS and the rate limiter.

xUnit creates a new test-class instance for each test, so each test gets its own factory and fresh singletons: an empty game store and a zeroed scoreboard. `WithWebHostBuilder(builder => builder.UseSetting(...))` overrides configuration for a test:
- `RateLimitingTests` lowers the limit to 3 requests.
- `ConfigurationTests` turns Swagger off or sets an invalid cleanup interval.

The tests assert raw JSON (`GamesApiTests` checks property order, string enums and `null` cells), so they see exactly what the browser sees. It is the .NET counterpart of `@SpringBootTest` with MockMvc.

## Deployment & operations

### 28. How is it deployed?

GitHub Pages can only host static files, so the deployment is split in two:

- **Frontend: GitHub Pages.** The `github-pages` build configuration in `angular.json` swaps in [`environment.github-pages.ts`](../frontend/src/environments/environment.github-pages.ts), which holds the Render API URL, and sets `baseHref` to `/ABB/`. [`deploy-pages.yml`](../.github/workflows/deploy-pages.yml) builds and publishes it.
- **API: Render's free tier.** It runs as a Docker web service built from [`backend/Dockerfile`](../backend/Dockerfile) and deployed automatically from this repository through [`render.yaml`](../render.yaml).

The Dockerfile has two stages: the .NET SDK builds the app, and the smaller ASP.NET runtime image runs it. It runs as the non-root `$APP_UID` user, listens on the port Render sets in `PORT`, and enables forwarded headers so the API sees the real client IP behind Render's proxy.

For same-origin hosting there is also [`docker-compose.yml`](../docker-compose.yml) with nginx forwarding `/api` to the API ([`nginx.conf`](../frontend/nginx.conf)), plus configs for Vercel and DigitalOcean. Those builds use `apiBaseUrl: '/api'` and need no CORS.

Render's free tier sleeps after about 15 minutes without traffic. The first request after that is slow and the in-memory games are gone, so the UI simply starts a new game.

### 29. How do the health check and rate limiting work?

**Health check.** `MapHealthChecks("/health")` answers `Healthy`, and Render calls it to check that the app is alive. It is excluded from rate limiting (`DisableRateLimiting()`), so a busy client can never make the platform think the app is down.

**Rate limiting.** ASP.NET Core's built-in rate limiter is used, with no extra package. `AddRateLimiting` gives each client IP its own fixed window: 300 requests per 60 seconds by default, read from `RateLimitingOptions`. `RateLimitRejectionHandler.WriteProblemAsync` returns 429 as problem+json with a `Retry-After` header.

In [`WebApplicationExtensions.UseTicTacToeApi`](../backend/TicTacToe.Api/Extensions/WebApplicationExtensions.cs), CORS runs before the limiter, so a 429 still carries the CORS header and the frontend can show its message. `RateLimitingTests` covers both behaviours.

### 30. How do idle games expire?

Games live in memory, so without cleanup a public demo would keep every game ever started. [`ExpiredSessionCleanupService`](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs) is a `BackgroundService` that waits on a `PeriodicTimer`. Every `Sessions:CleanupInterval` (10 minutes) it calls `IGameRepository.RemoveIdleSince(now - IdleTimeout)`, where `IdleTimeout` is 2 hours.

`InMemoryGameRepository` stores a `LastUsed` time for each game, and every `Find` refreshes it. Removal calls `TryRemove` on the exact key/value pair it checked, so a game used in the meantime is kept.

Both the timer and the repository take an injected `TimeProvider`, so `ExpiredSessionCleanupServiceTests` moves a `FakeTimeProvider` forward instead of waiting. A request for an expired game gets a 404.

### 31. Why is CORS needed, and how is it configured?

The frontend (`localhost:4200` or `intellectwithvivek.github.io`) and the API (`localhost:5000` or `onrender.com`) are on different origins. The browser therefore lets the page read API responses only if the API answers the preflight `OPTIONS` request and names the page's origin in `Access-Control-Allow-Origin`.

`UseTicTacToeApi` applies a policy built from `FrontendCorsOptions.AllowedOrigins`. It is an explicit allow-list that must have at least one entry, each origin is scheme plus host with no path, and it never uses `AllowAnyOrigin`. Locally the list is `http://localhost:4200` from `appsettings.json`; on Render, `Cors__AllowedOrigins__0` sets the GitHub Pages origin.

Tests check that the dev origin is allowed, that another origin is not, and that even a 400 error carries the header. Same-origin deployments behind nginx or Vercel need no CORS at all.

## AI usage

### 32. How did you turn the brief into a specification, and what prompts did you use?

I rewrote the brief as one detailed specification for the AI tool, recorded word for word in [SPEC_PROMPT.md](SPEC_PROMPT.md). It fixes the stack, the exact endpoints and the response shape, and it settles every open question up front:

- Option A for undo.
- The computer's move happens inside `POST /moves`.
- Reset keeps the game id and mode.
- One scoreboard for the whole server.
- The human is always X.

It also lists one test per required case, eight build phases with a commit after each, the documents to write, and a quality bar: no warnings, small files, and comments only to explain why.

Follow-up prompts asked for an enterprise folder structure, a review portal where every document can be read, deployment to free hosting (GitHub Pages specifically), and commits under my own name.

I used Claude Code. It wrote a design contract (exact types, error messages and a frozen JSON contract), handed focused tasks to sub-agents, and then ran review agents. The prompt log, in order, is in [AI workflow](AI_WORKFLOW.md).

### 33. What did the AI generate, and what did you review or change?

The AI wrote nearly all of the code, tests and docs, within the contract I specified. I reviewed most carefully the places where a subtle bug would break a requirement:

- the rule order and the `Position?` trap in `ComputerPlayer`
- the paired undo in `GameSession.Undo`
- the `_resultRecorded` guard
- `GameService.RunLocked` building the response inside the lock
- the `required` request properties
- the allowed CORS origins
- the error path in `GameExceptionHandler`

The review led to concrete changes:
- .NET 8's misleading "unhandled exception" log entry is now filtered out for expected 400 and 404 errors.
- MVC's duplicate validation error is suppressed.
- The frontend stays on Angular 21, because Angular 22 needs a newer Node.js ([Design decisions](DECISIONS.md) D2).
- Vulnerable test packages from the project template were upgraded (D5).

The tests pin every behaviour the brief asks for, so any change that breaks one fails the build.

### 34. What assumptions and trade-offs did you make?

**Assumptions:**
- X always starts, and in computer mode the human is X.
- The scoreboard is shared by every game for as long as the server runs.
- A "session" is one game id, and Reset keeps it.
- The API counts rows and columns from 0; the UI shows them from 1.
- A mode change takes effect when the player presses New Game.
- If one move completes two lines, the first line in `Board.Lines` order is highlighted.

**Trade-offs:**

| Chosen | Instead of | Why |
|---|---|---|
| In-memory storage | SQLite | The brief allows it, and `IGameRepository` leaves the door open. |
| Option A | Option B | Simpler, and a recorded result never has to be reversed. |
| Computer's move inside `POST /moves` | A separate endpoint | The move pair is atomic, takes one round trip, and the client never sees a "computer's turn" state. |
| Full-state responses | Responses with only the changes | No game logic in the client. |
| Controllers | Minimal APIs | See question 20. |
| A signals store | NgRx | Less boilerplate for one page. |
| Hand-written mapping | AutoMapper | Explicit and checked by the compiler. |

[Design decisions](DECISIONS.md) records each decision with its alternative.

## What would you do with more time?

### 35. What would you do with more time?

- **Persistence:** implement `IGameRepository` and `IScoreboardService` with EF Core on SQLite, then Postgres. All state is derived from the move list, so a stored game is just its mode and its moves. A row-version column would replace the in-process lock with optimistic concurrency and allow several API instances.
- **Authentication and multiplayer:** add sign-in (ASP.NET Core Identity or an external JWT provider) so each seat belongs to a user and the server no longer trusts the `player` field. Add a SignalR hub that sends each new `GameStateResponse` to everyone in that game, so two players can play from two machines.
- **Minimax AI:** add a "Hard" level that uses minimax with alpha-beta pruning (the 3×3 game tree is tiny), and keep the rule-based `ComputerPlayer` as "Easy".
- **Playwright end-to-end tests in CI:** start the API and the built UI in [`ci.yml`](../.github/workflows/ci.yml) and play real games in a browser: a win, a draw, undo in each mode, and the error toast.
- **Observability:** OpenTelemetry traces and metrics (games created, rule violations, 429s), structured JSON logs, and separate liveness and readiness checks.
- **Docker image publishing:** build the images once in CI, push them to GitHub Container Registry tagged with the commit, and have Render deploy that exact image, so what was tested is what runs.

---

## 60-second walkthrough

About 180 words, which takes roughly a minute to say.

> "This is Tic Tac Toe with an Angular 21 frontend and a .NET 8 API, and the backend owns everything.
>
> The rules live in a plain C# library, TicTacToe.Core. `GameEngine` is the rules of the game; `GameSession` adds the product's rules: the modes, the computer opponent, Option A undo, and counting each result exactly once. The turn and the status are recomputed from the moves, so undo can never leave stale state.
>
> The API is thin. `GameService` locks the game, runs one action and returns the full state, so the frontend never works out a rule, not even whether Undo is enabled. In computer mode, the computer's reply comes back in the same response as my move.
>
> The Angular app uses standalone components, a small signals store and zoneless OnPush change detection, and errors show as a toast.
>
> Every requirement has a named xUnit test, plus HTTP-level tests and Vitest specs. The site is also a review portal with every document and Swagger, deployed to GitHub Pages and Render.
>
> I wrote the specification, built the app with Claude Code, and I'm happy to walk through any file."

## If they ask you to change something live

After any change, run `dotnet test backend/TicTacToe.sln` and `npm run test:ci --prefix frontend`. The failing tests show exactly which behaviour moved.

### Switch to Option B (undo after the game has ended)

- **[`GameSession.Undo()`](../backend/TicTacToe.Core/Sessions/GameSession.cs):** remove the `Status != GameStatus.InProgress` guard. If `_resultRecorded` is set, reverse the result before undoing: when `Winner` is a player, call `_scoreboard.RevokeWin(winner)`; otherwise call `_scoreboard.RevokeDraw()`. Use if/else, because a C# ternary cannot call `void` methods. Then set `_resultRecorded = false`.
- **`CanUndo`:** change it to `Moves.Count > 0`.
- **[`IScoreboardService`](../backend/TicTacToe.Core/Scoring/IScoreboardService.cs) and [`Scoreboard`](../backend/TicTacToe.Core/Scoring/Scoreboard.cs):** add `RevokeWin(Player)` and `RevokeDraw()`. Each decrements its counter under `_lock` and never goes below zero, because the scoreboard may have been reset in between.
- **No change needed for VsComputer pairs.** After a computer win, undo removes O's winning move and X's move. After a human win, it removes only X's move, and it is X's turn again.
- **Tests:** change `Undo_AfterWin_ThrowsBecauseGameEnded`, `Undo_AfterDraw_ThrowsBecauseGameEnded` and `GamesApiTests.Undo_AfterWin_Returns400Problem` to expect success and a lower score.
- **Frontend:** nothing to change, because the button follows `canUndo`.

### Add a difficulty level

- **Core:** add `Domain/Difficulty.cs` with `Easy` and `Hard`. Add a minimax opponent in `Opponents/` and keep `ComputerPlayer` as `Easy`. `GameSession` takes a `Difficulty` in its constructor, and `PlayMove` picks the matching opponent. Minimax tries moves on a copy of the board, so `Board` needs an internal `Clone()`.
- **API:** add an optional `Difficulty` to [`CreateGameRequest`](../backend/TicTacToe.Api/Contracts/Requests/CreateGameRequest.cs). Do not mark it `required`, and default it to `Easy`, so existing clients keep working. Pass it through `GamesController.CreateGame` and `GameService.CreateGame`. Add `Difficulty` as the last property of [`GameStateResponse`](../backend/TicTacToe.Api/Contracts/Responses/GameStateResponse.cs) and set it in `ResponseMapper.ToGameState`. This only adds to the contract, so also update `GameStatePropertyNames` in `GamesApiTests` and the [API reference](API.md).
- **Frontend:** add the `Difficulty` type and `GameState.difficulty` in [`game.models.ts`](../frontend/src/app/features/game/models/game.models.ts), and a difficulty parameter to `GameApiService.createGame`. In `GameStore`, add a `selectedDifficulty` signal and a `selectDifficulty()` method, and use the value in `newGame()` and `init()`. In [`ControlsComponent`](../frontend/src/app/features/game/components/controls/controls.component.ts), add a second group of radio buttons with an input and an output.

### Change the computer's priority order

- **One method:** [`ComputerPlayer.ChooseMove`](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs). Each line of the `??` chain is one rule, so reordering the lines reorders the priorities (for example, corner before centre). The `Corners` field sets the order in which corners are tried.
- **Tests:** `ComputerPlayerTests` pins each rule. `GameSessionVsComputerTests.PlayMove_HumanMoves_ComputerRepliesInSameCall` and `GameServiceTests.SubmitMove_VsComputer_ResponseIncludesComputerReply` expect O to answer X's (0,0) with the centre. Update those tests and the "Computer mode" section of the [API reference](API.md#computer-mode).

### Add an endpoint (for example `DELETE /api/games/{id}` to abandon a game)

- **Repository:** add `bool Remove(Guid id)` to [`IGameRepository`](../backend/TicTacToe.Api/Application/IGameRepository.cs). In `InMemoryGameRepository`, implement it as `_sessions.TryRemove(id, out _)`.
- **Service:** add `GameService.DeleteGame(Guid id)`, which throws `GameNotFoundException` when nothing was removed.
- **Controller:** in `GamesController`, add an action with `[HttpDelete("{id:guid}")]`, `[ProducesResponseType(StatusCodes.Status204NoContent)]` and `[ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]` that returns `NoContent()`. `GameExceptionHandler` produces the 404 with no extra code, Swagger picks up the action automatically, and the CORS policy already allows any method.
- **Test and docs:** add a `GamesApiTests` test (204, then GET returns 404), add a request to [`TicTacToe.Api.http`](../backend/TicTacToe.Api/TicTacToe.Api.http) and a section to the [API reference](API.md). If the UI needs it, add `GameApiService.deleteGame(id)`.
