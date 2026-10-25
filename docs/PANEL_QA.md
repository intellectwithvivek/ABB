# Design Q&A

Answers to questions reviewers commonly ask, with references to the code.

## Architecture & state

### 1. Why is the backend the single source of truth?

The brief makes the backend own all game state, and keeping every rule in one place means the UI cannot drift from the server or be used to cheat. The rules live in TicTacToe.Core ([`GameEngine`](../backend/TicTacToe.Core/Engine/GameEngine.cs), [`GameSession`](../backend/TicTacToe.Core/Sessions/GameSession.cs)), and every game endpoint returns the full `GameStateResponse`, including `canUndo` and the scoreboard. The Angular [`GameStore`](../frontend/src/app/features/game/state/game.store.ts) keeps that snapshot in a read-only `game` signal and adds only UI state: `selectedMode`, `loading` and `errorMessage`.

### 2. How is the solution structured?

The backend has the three projects the specification names. [`TicTacToe.Core`](../backend/TicTacToe.Core/) is a plain C# library with no ASP.NET dependency: domain types, the engine, the computer opponent, sessions and scoring. [`TicTacToe.Api`](../backend/TicTacToe.Api/) maps HTTP to Core calls and is layered by folder (`Controllers`, `Contracts`, `Mapping`, `Application`, `Infrastructure`, `ErrorHandling`, `Configuration`), and [`TicTacToe.Tests`](../backend/TicTacToe.Tests/) mirrors that structure. The Angular app is organised by feature (`features/game`, `features/docs`, `features/home`) with shared `core` and `shared` folders; [Architecture](ARCHITECTURE.md) has the diagrams.

### 3. Where are games stored, and what happens when the server restarts?

Each game is a `GameSession` held in [`InMemoryGameRepository`](../backend/TicTacToe.Api/Infrastructure/Persistence/InMemoryGameRepository.cs), a `ConcurrentDictionary<Guid, SessionEntry>` registered as a singleton behind [`IGameRepository`](../backend/TicTacToe.Api/Application/IGameRepository.cs); the [`Scoreboard`](../backend/TicTacToe.Core/Scoring/Scoreboard.cs) is a singleton too. Memory is the only storage, as the brief allows, so a restart or redeploy clears every game and the scoreboard. The UI recovers on its own: `GameStore.init` falls back to a new game when the saved id is unknown, and `resync` starts a new game in the same mode when an action gets a 404.

### 4. How is concurrency handled?

`RunLocked` in [`GameService`](../backend/TicTacToe.Api/Application/GameService.cs) locks the game's `SyncRoot`, runs the action and builds the response inside the lock, so requests for one game run one at a time while different games run in parallel. The repository's `ConcurrentDictionary` needs no global lock, and `Scoreboard` guards its counters with its own private lock; locks are always taken game first, then scoreboard, so they cannot deadlock. `SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds`, `Undo_ParallelRequests_RemoveEachPairExactlyOnce` and `GetGame_WhileVsComputerMovesArePlayed_NeverSeesMoveWithoutReply` cover the races. These locks work within one process; several API instances would need a shared store with optimistic concurrency.

## Game logic

### 5. How are wins and draws detected?

[`Board.Lines`](../backend/TicTacToe.Core/Domain/Board.cs) lists the eight winning lines explicitly: three rows, three columns and two diagonals. After every move, undo or reset, the private `GameEngine.EvaluateOutcome` looks for the first line whose three cells hold the same mark and sets `Status`, `Winner` and `WinningCells`; otherwise a full board is a `Draw`. Because the win check comes first, a ninth move that completes a line is a win (`ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`). The outcome is recomputed from the board each time rather than updated step by step, so it can never be stale.

### 6. How does undo restore the previous state?

The engine stores only the board and the move list, and `CurrentPlayer` is derived as `_moves.Count % 2 == 0 ? Player.X : Player.O`. `GameEngine.UndoLastMove` removes the last move, clears its cell and re-evaluates the outcome, so board, turn, status and history are restored together. `GameSession.Undo` adds the product rules: it rejects undo once the game has ended (Option A), and in Vs Computer mode it undoes one more move when the turn would otherwise belong to the computer. A single `if` is enough because the computer replies in the same request, so a Vs Computer game always has an even number of moves between requests.

### 7. How does the computer choose its move?

[`ComputerPlayer.ChooseMove`](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs) is a chain of `??` expressions, one line per rule in the brief's order: complete its own line, block the opponent's line, take the centre, take the first free corner, take the first free cell. The helpers return `Position?` because `Position` is a struct, and `FirstOrDefault` would return (0,0), a real cell, when nothing matched. The opponent is deterministic, so [`ComputerPlayerTests`](../backend/TicTacToe.Tests/Core/Opponents/ComputerPlayerTests.cs) has one test per rule plus `ChooseMove_CanWinAndMustBlock_PrefersWinning`. It never moves after the game ends, because `GameSession.PlayMove` only asks while the game is in progress, and it can be beaten with a fork, which the brief's rules do not defend against.

### 8. How is the scoreboard updated exactly once per game?

`GameSession.RecordResultIfFinished` runs after every applied move, human or computer, and records a win or draw only if the game has ended and the private `_resultRecorded` flag is not yet set. Only `GameSession.Reset` clears the flag, so the next game is counted too (`Reset_ThenNextGameEnds_RecordsNextResultToo`). A finished game already rejects moves and undo, but the explicit flag means the scoreboard rule does not depend on those rules staying in place. The client never reports results; only the server changes the scoreboard.

## API design

### 9. Why does every endpoint return the full game state?

A `GameStateResponse` is a few hundred bytes, so the client simply replaces its snapshot: nothing to merge, no ordering bugs and no rules in the client. One response carries the computer's reply, the winning cells, `canUndo` and the scoreboard, so a single round trip has everything needed to render. Deltas would save bytes that do not matter here and would force the client to rebuild state, which the brief rules out.

### 10. Why does the computer move inside `POST /moves`?

The human's move and the computer's reply are applied in one request under one lock, so no client ever sees a half-finished "computer to move" state. The client can neither forget nor duplicate the computer's turn, and the whole exchange costs one round trip. A separate endpoint would add a state the client must orchestrate and a race between the two calls.

### 11. Which status codes are returned, and what does an error look like?

`POST /api/games` returns 201 Created with a `Location` header (`CreatedAtAction` in [`GamesController`](../backend/TicTacToe.Api/Controllers/GamesController.cs)); the other successful calls return 200. A broken rule or a malformed body is 400, an unknown id is 404 (an id that is not a GUID fails the `{id:guid}` route constraint and is 404 too), an oversized body is 413, a missing JSON content type is 415, a client over the rate limit gets 429, and anything unexpected is a 500 without internal detail. Every error is RFC 7807 `application/problem+json`, and rule violations carry the player-facing message in `detail`. Rule violations use 400 rather than 409 or 422 because the specification asks for 400, and the client treats them all the same way.

### 12. Where does validation happen?

Request shape is validated by `[ApiController]` and System.Text.Json: a missing `required` property, an unknown enum name or a number sent for an enum produces an automatic `ValidationProblemDetails`, and `[EnumDataType]` also rejects a quoted number such as `"7"`. Game rules are validated only in Core: `GameEngine.ApplyMove` checks game over, off board, wrong player and occupied cell, in that order, and throws `GameRuleException` with the message the player sees. A rejected move changes nothing, and the fixed order decides which message appears when several rules are broken (`ApplyMove_SeveralRulesBroken_ReportsFirstRuleInValidationOrder`). [`SubmitMoveRequest`](../backend/TicTacToe.Api/Contracts/Requests/SubmitMoveRequest.cs) deliberately has no `[Range]` on `Row` and `Col`, so the board-size rule has one source of truth and one error message.

### 13. Is reset idempotent, and why are undo and reset POSTs?

Reset is idempotent in effect: however often `POST /api/games/{id}/reset` is called, the game ends with the same id and mode, an empty board, X to move and the scoreboard unchanged, and `POST /api/scoreboard/reset` behaves the same way. Both are POST because they are commands rather than full replacements of a resource, and the brief's API table uses POST. Moves and undo are not idempotent, but a repeated move is rejected (the cell is taken or it is the other player's turn), and the store sends one request at a time. Safe retries over unreliable networks would call for an expected move number or an `Idempotency-Key` header.

## Angular

### 14. How are standalone components and routing used?

There are no NgModules: each component lists what its template uses in its own `imports`, and [`main.ts`](../frontend/src/main.ts) calls `bootstrapApplication` with the providers in [`app.config.ts`](../frontend/src/app/app.config.ts). Every route in [`app.routes.ts`](../frontend/src/app/app.routes.ts) uses `loadComponent`, so each page is a lazy chunk and the `marked` library downloads only when the docs are opened. `withComponentInputBinding()` delivers route parameters as signal inputs (`DocViewerPageComponent.slug`), and `PageTitleStrategy` sets the browser tab titles.

### 15. How is state managed, and why signals rather than NgRx?

[`GameStore`](../frontend/src/app/features/game/state/game.store.ts) is a root-provided service with private writable signals exposed read-only through `asReadonly()`, plus `computed` values such as `board`, `canPlay` and `canUndo`. Components call intent methods (`play`, `undo`, `resetGame`, `newGame`), and one private `run` helper ignores a call while a request is in flight, sets `loading`, subscribes to the HTTP Observable and stores the result or the error message. For one page and seven endpoints NgRx would be mostly boilerplate; the store reads like React state with `useMemo`, except that signals update only what reads them. RxJS stays where it fits, in the HTTP calls.

### 16. How does change detection work?

The app runs without zone.js, the default in Angular 21, so a view updates when a signal it reads changes, an input changes or a template event fires. Every component also uses `ChangeDetectionStrategy.OnPush` with signal `input()` and `output()`, and presentational components derive values with `computed`, for example `CellComponent.locked`. The only timer, the status bar's "server may be waking up" message after 5 seconds of loading, is an `effect` that cancels itself through `onCleanup`.

### 17. How are errors shown to the player?

Every failed request goes through `toErrorMessage` in [`api-error.ts`](../frontend/src/app/core/http/api-error.ts). It explains status 0 as an unreachable server and a 502, 503 or 504 as a server that is starting up, and otherwise shows the ProblemDetails `detail`, then the first validation error, then the `title`. [`ErrorToastComponent`](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts) shows the message as a non-blocking toast with `role="alert"` that stays until it is dismissed or the next request starts. After a 400 the store reloads the game, so the reason appears next to the server's real board, and after a 404 a new game starts and the toast explains why.

### 18. How does the documentation portal work?

[`copy-docs.mjs`](../frontend/scripts/copy-docs.mjs) copies `README.md` and `docs/` into the build before `npm start` and `npm run build`, so the portal renders exactly the files on GitHub. [`DocsService.getMarkdown`](../frontend/src/app/features/docs/data-access/docs.service.ts) fetches a file as text, and [`renderMarkdown`](../frontend/src/app/features/docs/markdown/markdown-renderer.ts) converts it with `marked`, collects the headings for the "On this page" list and rewrites links through `resolveDocLink`: catalog documents open in the app, source paths open on GitHub, and the Word brief downloads. The HTML is bound with `[innerHTML]`, which Angular sanitizes; sanitizing strips `id` attributes, so `HeadingAnchorsDirective` sets the heading anchors after rendering, and `InAppLinksDirective` routes in-app clicks through the Router. The list of documents is the typed `DOCS_CATALOG` in [`docs.catalog.ts`](../frontend/src/app/features/docs/docs.catalog.ts).

## .NET

### 19. Which DI lifetimes are used, and why?

The game services are registered in `AddGameServices` in [`ServiceCollectionExtensions.cs`](../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs). `InMemoryGameRepository` and `Scoreboard` are singletons because they hold the server's state, which is also why both are thread-safe. `GameService` is scoped because it holds no state and would stay correct if it later depended on a scoped `DbContext`; `TimeProvider.System` is a singleton so tests can substitute a fake clock, and `ExpiredSessionCleanupService` is a hosted service. No singleton depends on a shorter-lived service, which avoids captive dependencies.

### 20. Why controllers rather than minimal APIs?

`[ApiController]` gives an automatic 400 `ValidationProblemDetails` for malformed bodies, attribute routing keeps each resource in one class ([`GamesController`](../backend/TicTacToe.Api/Controllers/GamesController.cs), [`ScoreboardController`](../backend/TicTacToe.Api/Controllers/ScoreboardController.cs)), and `[ProducesResponseType]` documents every status code in Swagger. The specification's layout names controllers, and the style reads like a Spring `@RestController`. Minimal APIs would be equally valid in .NET 8; every action is a one-line call, so switching would be mechanical.

### 21. How do exceptions become HTTP responses?

[`GameExceptionHandler`](../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs) implements .NET 8's `IExceptionHandler`: `ToStatusAndTitle` maps `GameRuleException` to 400 "Invalid move", `GameNotFoundException` to 404 "Game not found", and Kestrel's `BadHttpRequestException` to its own status, such as 413. `TryHandleAsync` writes ProblemDetails through `IProblemDetailsService` with the exception message as `detail`; for anything else it logs the error and returns `false`, so the default handler answers 500 without leaking details. `UseExceptionHandler()` is first in the pipeline, so controllers contain no try/catch. Because .NET 8's exception middleware logs even handled exceptions as unhandled, `AddErrorHandling` filters that log category, and the handler logs only the unexpected ones.

### 22. How are DTOs mapped, and what does `required` do on the requests?

Requests and responses are C# records in `Contracts/`, mapped by hand in [`ResponseMapper`](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs) (`ToGameState`, `ToScoreboard`), so the JSON contract stays stable when Core types change and every mapping is checked by the compiler. `public required int Col { get; init; }` makes System.Text.Json reject a body without that property, which `[ApiController]` turns into a 400; without `required`, a missing `col` would silently become column 0. `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes` keeps a malformed body to one clear error (`SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame`).

### 23. How is configuration handled?

Each settings section has a typed class in [`Configuration/`](../backend/TicTacToe.Api/Configuration/) (`FrontendCorsOptions`, `GameSessionOptions`, `RateLimitingOptions`, `ApiDocumentationOptions`), bound by `AddValidatedOptions<TOptions>` with `ValidateDataAnnotations()` and `ValidateOnStart()`. A bad value therefore stops the app at startup with a message naming the setting (`Startup_ZeroCleanupInterval_FailsWithValidationError`), and `FrontendCorsOptions` also rejects an origin with a path or a trailing slash (`Startup_CorsOriginNotSchemeAndHost_FailsWithValidationError`). Code reads the values through `IOptions<T>`, and any value can be overridden by an environment variable such as `Swagger__Enabled=false`.

## Testing

### 24. What do the tests cover?

The backend has 130 xUnit tests, 70 for the Core and 60 for the API, with one clearly named test per case the brief requires. [`GameEngineTests`](../backend/TicTacToe.Tests/Core/Engine/GameEngineTests.cs), [`GameSessionTests`](../backend/TicTacToe.Tests/Core/Sessions/GameSessionTests.cs), [`GameSessionVsComputerTests`](../backend/TicTacToe.Tests/Core/Sessions/GameSessionVsComputerTests.cs) and `ComputerPlayerTests` cover moves, every win line, draws, undo in both modes, Option A, reset, the record-once rule and each computer priority, and one test plays all 489 possible games against the computer. The API tests cover mapping, concurrency, the JSON contract, problem+json errors, CORS, rate limiting, configuration, the health check and idle-game cleanup on a fake clock. The frontend has 170 Vitest tests in 26 files covering every game component, `GameStore`, `GameApiService`, error mapping, routing and the docs portal; [Testing](TESTING.md) maps each requirement to its tests.

### 25. How do the API integration tests work?

`Program.cs` ends with `public partial class Program;`, so tests can use `WebApplicationFactory<Program>` to start the real app on an in-memory server, with routing, JSON options, validation, the exception handler, CORS and the rate limiter. xUnit creates a new class instance per test, so each test gets a fresh factory with an empty game store and a zeroed scoreboard, and `WithWebHostBuilder(builder => builder.UseSetting(...))` overrides settings for a single test. The tests assert raw JSON, including property order, string enums and `null` cells, so they see exactly what the browser sees; it is the .NET counterpart of `@SpringBootTest` with MockMvc.

### 26. What is not covered, and how would the tests be extended?

No automated test plays a game in a real browser against the real API: the frontend specs run in jsdom with a faked HTTP layer, and the browser checks were scripted runs outside CI. There is no load testing and no automated accessibility audit. A new rule gets a Core test built with `TestGames.Play` and `TestBoards.Parse` from [`TestSupport/`](../backend/TicTacToe.Tests/TestSupport/), a new endpoint gets a test in `GamesApiTests`, and a new component gets a `*.spec.ts` next to it; names follow `Method_Scenario_ExpectedOutcome`. Playwright end-to-end tests in CI would be the first addition.

## Deployment & operations

### 27. How is the application deployed?

The portal is live at <https://tictactoe-abb.vercel.app>: Vercel builds the Angular app as configured in [`vercel.json`](../vercel.json) and rewrites `/api/*` and `/swagger*` to the API on Render. The API runs on Render's free plan as a Docker web service built from [`backend/Dockerfile`](../backend/Dockerfile) through [`render.yaml`](../render.yaml), with `/health` as its health check, and Render deploys a commit only after CI passes. The production build uses `apiBaseUrl: '/api'` ([`environment.production.ts`](../frontend/src/environments/environment.production.ts)), so the browser stays on one origin and production needs no CORS. The Dockerfile builds with the .NET SDK image and runs on the smaller ASP.NET runtime image as a non-root user, listening on the port Render provides.

### 28. Why is the API on Render rather than Vercel, and why no Redis?

Vercel's container runtime scales to zero after 5 idle minutes and may run several instances, which in-memory state cannot survive: games would vanish, or a request could reach an instance that never saw the game. Render runs one long-lived container, which matches the in-memory design the brief accepts. A Redis or SQL store behind `IGameRepository` and `IScoreboardService` would allow multi-instance or serverless hosting; it was considered and declined to keep the solution lean and within the brief. The cost is that Render's free instance sleeps after 15 idle minutes, the first request then takes about a minute, and a restart clears games and the scoreboard.

### 29. How do the health check, rate limiting and request limits work?

`MapHealthChecks("/health")` answers `Healthy` for Render's health check and is exempt from rate limiting, so a busy client cannot make the platform think the app is down. `AddRateLimiting` uses ASP.NET Core's built-in limiter with a fixed window per client IP: 300 requests per 60 seconds, of which at most 30 may create games, and `RateLimitRejectionHandler.WriteProblemAsync` returns a 429 problem+json with `Retry-After`. Request bodies are capped at 4 KB, and an oversized body gets a 413. Behind the Vercel proxy the API sees Vercel's address, so visitors who arrive through the same Vercel address share one rate-limit bucket.

### 30. How do idle games expire?

[`ExpiredSessionCleanupService`](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs) is a `BackgroundService` that waits on a `PeriodicTimer` and every 10 minutes calls `IGameRepository.RemoveIdleSince` for games unused for 2 hours (`GameSessionOptions`). `InMemoryGameRepository.Find` refreshes each game's `LastUsed`, and removal calls `TryRemove` on the exact key-value pair it checked, so a game used in the meantime is kept. A failed cleanup is logged and retried at the next tick, because an exception escaping a `BackgroundService` stops the app in .NET 8. Both the timer and the repository take an injected `TimeProvider`, so the tests advance a `FakeTimeProvider` instead of waiting.

### 31. Why is CORS configured when production is same-origin?

Local development still needs it: the Angular dev server on `http://localhost:4200` calls the API on `http://localhost:5000`, a different origin. `UseTicTacToeApi` in [`WebApplicationExtensions.cs`](../backend/TicTacToe.Api/Extensions/WebApplicationExtensions.cs) applies an explicit allow-list from `FrontendCorsOptions.AllowedOrigins`, never `AllowAnyOrigin`, and runs CORS before the rate limiter so a 429 still carries the header the browser needs. Tests check that the dev origin is allowed, that another origin is not, and that even a 400 carries the header.

## AI-assisted development

### 32. How was AI used to build the solution?

The brief was first rewritten as an executable specification, recorded verbatim in [SPEC_PROMPT.md](SPEC_PROMPT.md), that fixed the stack, the exact endpoints, the state shape, the open clarifications (Option A, the computer moving inside `POST /moves`, Reset keeping the id), the required tests and a quality bar. Claude Code (model Claude Opus 5.5) turned it into a written design contract and split the build into focused tasks: the Core, the tests, the API, the UI, the portal, deployment and the documentation. Follow-up prompts covered the layered structure, the review portal, hosting, applying review findings, a manual acceptance test and a final cleanup. The full prompt log, in order, is in [AI workflow](AI_WORKFLOW.md).

### 33. How was the AI's output verified?

Each task was built against the written contract with every deviation reported, and independent AI reviews, separate from the code's author, checked requirements traceability, the game logic, and backend and frontend quality before fixes were applied. Build gates (warnings as errors, a warning-free Angular build, Prettier), the test suites, a `curl` smoke test, mutation checks on the frontend tests and scripted headless-Chrome runs backed this up. The closest human review went to the computer's priority order, pair undo, the record-once guard, the per-game lock and the error mapping, and a manual acceptance test found a layout bug in the docs table of contents that was then fixed. Every commit is made under the candidate's own identity, and AI use is disclosed in [AI workflow](AI_WORKFLOW.md).

## Next steps

### 34. What would come next with more time?

Persistence comes first: an EF Core (SQLite, then PostgreSQL) or Redis implementation of `IGameRepository` and `IScoreboardService` that stores each game as its mode and move list and replaces the in-process lock with optimistic concurrency, so the API can run as several instances. Next would be Playwright end-to-end tests in [CI](../.github/workflows/ci.yml) that play real games against the real API. On the product side: a minimax "Hard" difficulty beside the rule-based opponent, Option B as a setting, and sign-in plus a SignalR hub for two-device play. Operationally: a Docker Compose file for a one-command local run, OpenTelemetry traces and metrics, structured logs, and separate liveness and readiness checks.
