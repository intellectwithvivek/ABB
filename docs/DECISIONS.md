# Design decisions

The decisions that shaped this project. Each entry gives the context, the choice made, the reasoning and the main alternative that was turned down. [Architecture](ARCHITECTURE.md) shows how the parts fit together; links to source files open the code on GitHub.

## Scope & environment

### D1. Keep the specified project layout and structure the code inside it
- **Context:** The [specification](SPEC_PROMPT.md) fixes `backend/TicTacToe.Api`, `backend/TicTacToe.Core`, `backend/TicTacToe.Tests` and `frontend/`.
- **Decision:** Keep exactly those projects and organise each one by folder, with namespaces following folders. Core: `Domain/`, `Engine/`, `Opponents/`, `Sessions/`, `Scoring/`. API: `Controllers/`, `Contracts/`, `Mapping/`, `Application/`, `Infrastructure/`, `ErrorHandling/`, `Configuration/`, `Extensions/`. Frontend: `core/`, `shared/`, `features/`. The API references Core; Core references nothing.
- **Why:** Reviewers find the specified layout immediately, every folder answers "where does this go?", and the rules compile without ASP.NET.
- **Alternative:** Separate `Domain`, `Application` and `Infrastructure` projects. That is textbook clean architecture, but it departs from the specification and adds projects with a handful of files each.

### D2. Angular 21.2 rather than Angular 22
- **Context:** Angular 22's CLI requires Node.js 24.15 or later (or 22.22.3 on the Node 22 line); the development machine runs Node.js 24.14.0.
- **Decision:** Use Angular 21.2, a supported LTS release.
- **Why:** It has everything the brief needs (standalone components, signals, zoneless change detection, Vitest) and also runs on the Node 22 used in CI.
- **Alternative:** Upgrade Node.js first. Nothing in the brief needs Angular 22, and after a Node upgrade `ng update @angular/core@22 @angular/cli@22` moves the project.

### D3. A repository-local `nuget.config`
- **Context:** `dotnet restore` failed on the development machine, which had no NuGet package source configured.
- **Decision:** [`backend/nuget.config`](../backend/nuget.config) clears inherited sources and adds only nuget.org.
- **Why:** Restore behaves the same on every machine, in CI and in the Docker build, without touching user-level settings.
- **Alternative:** Fixing the machine's global configuration, which helps one machine and is invisible to reviewers.

### D4. Reproducible, warning-free backend builds
- **Context:** The quality bar is zero build warnings, and three projects must share one SDK line and one set of package versions.
- **Decision:** [`global.json`](../backend/global.json) selects SDK 8.0.100 with `rollForward: latestFeature`. [`Directory.Build.props`](../backend/Directory.Build.props) enables `Nullable`, `ImplicitUsings` and `TreatWarningsAsErrors` for every project; only NuGet's vulnerability-audit warnings (NU1901–NU1904) stay warnings, so a new advisory is reported without breaking unrelated builds. [`Directory.Packages.props`](../backend/Directory.Packages.props) holds every package version (Central Package Management). The test packages are newer than the `dotnet new xunit` template versions, whose transitive dependencies carried known advisories.
- **Why:** A new warning fails the build, a .NET 9 or 10 SDK is never picked by accident, versions cannot drift between projects, and `dotnet list package --vulnerable --include-transitive` is clean.
- **Alternative:** Settings and versions in each `.csproj` (the template default), which drift apart as projects are added.

## Domain & rules

### D5. `GameEngine` holds the rules; `GameSession` holds the product policy
- **Context:** The brief mixes the rules of Tic Tac Toe (turns, wins, draws) with product choices (modes, a computer opponent, an undo policy, scoring).
- **Decision:** [`GameEngine`](../backend/TicTacToe.Core/Engine/GameEngine.cs) validates and applies moves, detects wins and draws, and undoes moves; it knows nothing about modes or scores. [`GameSession`](../backend/TicTacToe.Core/Sessions/GameSession.cs) owns the mode, the computer's reply, the Option A undo policy, pair undo and recording results.
- **Why:** Each class has one reason to change and is tested on its own. For example, `GameEngine.UndoLastMove` can undo a winning move (a rule), while `GameSession.Undo` refuses it (a policy).
- **Alternative:** One `Game` class: smaller at first, but rule bugs and policy bugs become entangled.

### D6. The current player is derived and the outcome is recalculated after every change
- **Context:** Moves, undo, reset and rejected moves must never leave stale state behind.
- **Decision:** `CurrentPlayer => Moves.Count % 2 == 0 ? X : O`. The private `EvaluateOutcome()` runs after every move, undo and reset, and checks the eight lines in `Board.Lines` before checking for a full board.
- **Why:** There is no turn or status field to forget, undo restores the correct state by construction, and a ninth move that completes a line is a win, not a draw (`ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`).
- **Alternative:** Stored turn and status fields updated on each change, which every code path, undo included, must keep in sync by hand.

### D7. Broken rules throw one exception type, checked in a fixed order
- **Context:** A move must be rejected when the game is over, the cell is off the board, it is the other player's turn, or the cell is taken.
- **Decision:** `GameEngine.ApplyMove` checks in exactly that order and throws [`GameRuleException`](../backend/TicTacToe.Core/Engine/GameRuleException.cs) with a sentence written for the player (`Cell (row 0, col 0) is already taken by X.`). A rejected move changes nothing.
- **Why:** Each request gets one predictable message, which reaches the UI unchanged; the exception maps to HTTP 400 in one place (D16).
- **Alternative:** A result object such as `MoveResult.Invalid(reason)`. It is equally valid, but every caller must check it and translate it to HTTP.

### D8. A deterministic computer opponent that follows the brief's priority list
- **Context:** The brief specifies the order: win, block, take the centre, take a corner, take any free cell.
- **Decision:** [`ComputerPlayer.ChooseMove`](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs) is a `??` chain in exactly that order, scanning lines, corners and cells in a fixed order. Its helpers return `Position?`, because `FirstOrDefault` on a struct would return the real cell (0,0) when nothing matches.
- **Why:** The same board always gives the same move, so each rule has its own test and every reply is predictable. The brief's list has no defence against a fork, so the computer can be beaten; `PlayMove_HumanCompletesLine_ComputerDoesNotMove` plays such a game.
- **Alternative:** Random tie-breaks (flaky tests) or minimax (unbeatable, but no longer the brief's rules). Minimax is listed as a future improvement.

### D9. The computer replies inside `POST /moves`, and undo removes both moves
- **Context:** In VsComputer mode the computer must reply automatically and never after the game has ended. The brief says one undo removes the human's move and the computer's reply.
- **Decision:** `GameSession.PlayMove` applies the human's move and, while a VsComputer game is still in progress, the computer's reply in the same call. `GameSession.Undo` undoes one move, then one more if it is now the computer's turn.
- **Why:** One round trip, no "waiting for the computer" state on the server, and no orchestration in the client. Between requests it is always X's turn, so a move sent as O fails the ordinary turn check.
- **Alternative:** A separate `POST /computer-move` called by the frontend, which adds a request, a client-side rule and a race between the two calls.

### D10. Option A: undo is disabled once a game is won or drawn
- **Context:** The brief asks for Option A (no undo after the game ends) or Option B (undo after the end, with the scoreboard adjusted).
- **Decision:** Option A. For a finished game `GameSession.Undo` throws "Undo is not available after the game has ended. Reset the game to play again." and `canUndo` is `false`.
- **Why:** A result is final once it is on the scoreboard, so the scoreboard is never decremented and "counted exactly once" (D11) stays simple.
- **Alternative:** Option B. The session would have to remember and reverse what it recorded, which becomes ambiguous if the scoreboard is reset in between.

### D11. An explicit guard records each result exactly once
- **Context:** The scoreboard must change once per finished game, and never again after a rejected move, a rejected undo or a reset.
- **Decision:** `GameSession` keeps a private `_resultRecorded` flag. `RecordResultIfFinished()` records only when the game is finished and the flag is not set; `Reset()` clears it.
- **Why:** A finished game already rejects moves and undo, but the rule is stated in code instead of relying on that, so a later change (Option B, for example) cannot silently break it. It is the one stored flag in a game, because recording is a side effect on a shared object.
- **Alternative:** Relying only on the structural guarantee: correct today, fragile under change.

### D12. Reset keeps the game id and mode; the scoreboard is server-wide
- **Context:** Reset Game "starts a fresh game session" and keeps the scoreboard, which the brief calls "session-level".
- **Decision:** `POST /api/games/{id}/reset` clears the board, history and result and gives the turn to X, keeping the id and mode. New Game (`POST /api/games`) creates a new game and is how the mode changes. One `Scoreboard` instance is shared by every game for the lifetime of the API process.
- **Why:** A stable id keeps the client simple, because the saved id stays valid. A server-wide scoreboard is "served by the backend" without inventing user accounts; on the public demo every visitor shares it, which the README lists as a known limitation.
- **Alternative:** A new id on every reset (the client tracks a moving id for no benefit), or one scoreboard per browser (an identity concept the brief does not have).

## API

### D13. MVC controllers with `[ApiController]`
- **Context:** .NET 8 offers both MVC controllers and minimal APIs.
- **Decision:** [`GamesController`](../backend/TicTacToe.Api/Controllers/GamesController.cs) and [`ScoreboardController`](../backend/TicTacToe.Api/Controllers/ScoreboardController.cs), with thin actions that delegate to the application layer. Routes use `{id:guid}`, `[ProducesResponseType]` documents every status code for Swagger, and `POST /api/games` returns `201 Created` with a `Location` header.
- **Why:** Controllers read like Spring `@RestController` classes, `[ApiController]` answers malformed bodies with an automatic 400, and an id that is not a GUID never reaches an action.
- **Alternative:** Minimal APIs: shorter for seven endpoints, but validation and response documentation are wired by hand.

### D14. Every game endpoint returns the full state, including `canUndo`
- **Context:** The backend is the single source of truth, and the frontend must not re-implement rules.
- **Decision:** Every game endpoint returns the complete [`GameStateResponse`](../backend/TicTacToe.Api/Contracts/Responses/GameStateResponse.cs): board, current player, status, winner, winning cells, move history, `canUndo` and scoreboard. Responses are immutable records filled by [`ResponseMapper`](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs); `canUndo` comes from `GameSession.CanUndo` (in progress and at least one move).
- **Why:** The client renders exactly what it receives, so client and server cannot disagree. Separate DTOs keep the JSON contract stable when Core changes and keep serialization out of Core.
- **Alternative:** Returning only changes (the client merges state and recomputes rules), or serializing `GameSession` directly (the contract becomes the domain model).

### D15. A strict request contract: string enums, `required` members, no `[Range]`
- **Context:** A missing field must not silently default (a missing `"col"` would become column 0), and enums must match the TypeScript string unions.
- **Decision:** Request DTOs are records with `required` `init` properties. `JsonStringEnumConverter(allowIntegerValues: false)` makes enums travel as names, `[EnumDataType]` rejects a quoted number that names no value, and `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes` keeps one error per malformed body. `Row` and `Col` deliberately have no `[Range]`.
- **Why:** A malformed body gets an automatic 400 that names the field, the JSON reads on its own, and the board-range rule lives only in Core with one message (D7).
- **Alternative:** Numeric enums (unreadable, and fragile if the order changes), or `[Range(0, 2)]`, which duplicates the rule in a second layer with a second message.

### D16. Exceptions become ProblemDetails through `IExceptionHandler`
- **Context:** Broken rules must return 400 and unknown ids 404, each with a clear message, without `try`/`catch` in the controllers.
- **Decision:** [`GameExceptionHandler`](../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs) implements .NET 8's `IExceptionHandler`: `GameRuleException` becomes 400 "Invalid move", `GameNotFoundException` 404 "Game not found", and Kestrel's `BadHttpRequestException` keeps its own status (413 for an oversized body). Each is written as RFC 7807 `application/problem+json` with the message as `detail`. Any other exception is logged and becomes the framework's 500 without internals. `UseStatusCodePages()` (404, 405) and the rate limiter's rejection handler (429) produce the same shape.
- **Why:** Mapping happens in the framework's single place for it, actions describe only the success path, and the frontend needs one parser. The exception middleware's own log entry is filtered, so expected 400s and 404s do not look like crashes.
- **Alternative:** `try`/`catch` in every action (repetitive) or custom middleware (reimplements what .NET 8 provides).

### D17. Typed settings validated at startup; CORS only for local development
- **Context:** The API has settings for CORS, Swagger, rate limits and idle-game expiry.
- **Decision:** Each section binds to a class in [`Configuration/`](../backend/TicTacToe.Api/Configuration/) with `ValidateDataAnnotations().ValidateOnStart()`. `Cors:AllowedOrigins` lists only `http://localhost:4200`, because the deployed site proxies `/api` on its own origin (D28). Swagger is on by default (`Swagger:Enabled`), so the deployed API documents itself.
- **Why:** A bad value, such as a zero cleanup interval or an origin with a path, stops startup with a message that names the setting, and no origin is opened that does not need to be.
- **Alternative:** Reading `IConfiguration["…"]` strings where needed (untyped, fails late), or `AllowAnyOrigin()` (too open for a public API).

## State & concurrency

### D18. In-memory storage behind `IGameRepository` and `IScoreboardService`
- **Context:** The brief accepts in-memory storage, and the demo runs one API instance.
- **Decision:** [`InMemoryGameRepository`](../backend/TicTacToe.Api/Infrastructure/Persistence/InMemoryGameRepository.cs) (a `ConcurrentDictionary`) implements [`IGameRepository`](../backend/TicTacToe.Api/Application/IGameRepository.cs), a port owned by the application layer; [`Scoreboard`](../backend/TicTacToe.Core/Scoring/Scoreboard.cs) implements `IScoreboardService`. Both are singletons, and the stateless `GameService` is scoped. The API therefore runs on Render as one long-running container, not on Vercel, whose server runtime scales to zero when idle and can run several instances at once.
- **Why:** Nothing in the brief needs a database. The two interfaces are the seam where Redis or SQL would replace memory for multi-instance or serverless hosting ([Architecture › Scaling path](ARCHITECTURE.md#scaling-path)).
- **Alternative:** SQLite with EF Core, or Redis, from the start: migrations or an external service for a requirement the brief does not have.

### D19. A lock per game, with the response mapped inside the lock
- **Context:** Requests run in parallel. A double click can send two moves for the same game, and `GameSession` is not thread-safe.
- **Decision:** [`GameService.RunLocked`](../backend/TicTacToe.Api/Application/GameService.cs) finds the session, takes `lock (session.SyncRoot)`, runs the action and maps the response before releasing the lock; reads take the lock too. `Scoreboard` guards its counters with its own private lock and returns an immutable `ScoreSnapshot`.
- **Why:** Requests for one game run one at a time while different games run in parallel, each response is a consistent snapshot, and a read never sees the human's move without the computer's reply. Proven by `SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds`, `Undo_ParallelRequests_RemoveEachPairExactlyOnce` and `GetGame_WhileVsComputerMovesArePlayed_NeverSeesMoveWithoutReply`.
- **Alternative:** One global lock (serializes the whole server), or locking inside `GameSession` (mixes threading into otherwise pure domain code).

### D20. Hardening for a public demo
- **Context:** The API is public, has no authentication and keeps its state in memory.
- **Decision:** `GET /health` for the platform's health check, exempt from rate limiting. ASP.NET Core's built-in rate limiter with a fixed window per client IP (300 requests per 60 seconds) and a stricter `create-game` policy (30 per 60 seconds), answering 429 problem+json with `Retry-After`. [`ExpiredSessionCleanupService`](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs) checks every 10 minutes, on an injected `TimeProvider`, and removes games idle for more than 2 hours. Kestrel's request-body limit is lowered from 30 MB to 4 KB.
- **Why:** Memory stays bounded, one client cannot exhaust the server, a flood cannot make the platform restart a healthy app, and no extra package is needed. Requests through the Vercel proxy reach the API from Vercel's addresses, so site visitors can share a rate-limit bucket; normal play stays far below the limits.
- **Alternative:** No limits (easy to abuse), or third-party packages for what .NET 8 already provides.

## Frontend

### D21. Standalone, zoneless Angular with presentational OnPush components
- **Context:** Angular 21 defaults to standalone components and zoneless change detection.
- **Decision:** No NgModules and no zone.js. Components use `inject()`, signal `input()` and `output()`, `computed()`, the `@if`/`@for` control flow and `OnPush`. [`GamePageComponent`](../frontend/src/app/features/game/game-page.component.ts) is the only component that injects the store; the board, cell, controls, status bar, history, scoreboard and toast render inputs and emit outputs.
- **Why:** Current, idiomatic Angular with little boilerplate. Data flow is explicit and maps closely to React props and state, and presentational components are tested without services.
- **Alternative:** NgModules, `@Input()` decorators and zone.js (legacy style), or NgRx (heavy for one screen of state).

### D22. The backend is the single source of truth; the store holds a snapshot plus UI state
- **Context:** The UI needs loading, error and selected-mode state, but no game rule may live in TypeScript.
- **Decision:** [`GameStore`](../frontend/src/app/features/game/state/game.store.ts) keeps the last `GameState` the API returned and never edits it; Reset Scoreboard only swaps in the scoreboard the server returns. Besides that snapshot it holds only `selectedMode`, `loading` and `errorMessage`; derived values such as `canUndo` are `computed()`. A private `run()` ignores actions while a request is in flight, so controls stay enabled and keep keyboard focus. A 400 on a game action reloads the game, a 404 starts a new game in the same mode, and the game id in `sessionStorage` lets a refresh resume the game.
- **Why:** Client and server cannot disagree, a double click sends one request (the server lock in D19 is the real guarantee), and a stale tab or an expired game recovers by itself.
- **Alternative:** Components calling `HttpClient` directly (scattered state and error handling), or computing turn and undo availability in the client (a second copy of the rules).

### D23. Deployment settings through the `APP_CONFIG` injection token
- **Context:** The API URL is `http://localhost:5000/api` in development and `/api` on the deployed site.
- **Decision:** [`APP_CONFIG`](../frontend/src/app/core/config/app-config.ts) (`apiBaseUrl`, `swaggerUrl`, `repositoryUrl`) is provided in `app.config.ts`, the only file that imports `environment.ts`; `angular.json` replaces that file with `environment.production.ts` in production builds. Services inject the token.
- **Why:** No URL is hard-coded in a service, and specs provide their own `TEST_APP_CONFIG`.
- **Alternative:** Importing `environment` in every service (harder to test), or fetching a runtime `config.json` (an extra request and loading state for no gain).

### D24. Errors reach the player as one sentence in a non-blocking toast
- **Context:** Rule violations, validation errors, a sleeping server and network failures all need a readable message that does not block the board.
- **Decision:** [`toErrorMessage`](../frontend/src/app/core/http/api-error.ts) uses the ProblemDetails `detail`, then the first validation error, then the `title`. 502, 503 and 504 become "The game server is starting up or temporarily unavailable. Please try again in a moment."; status 0 names the server only for an absolute (local) URL. [`ErrorToastComponent`](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts) uses `role="alert"` and stays until it is dismissed or the next request starts.
- **Why:** The server's own sentence reaches the player unchanged, a cold start explains itself, and a toast without a timer cannot disappear before it has been read.
- **Alternative:** `alert()` dialogs (blocking), or an auto-dismissing toast (can vanish before a slow reader finishes).

### D25. The portal renders the repository's own Markdown
- **Context:** Reviewers should be able to play, read every document and reach the source from one link, without a second copy of the docs.
- **Decision:** [`copy-docs.mjs`](../frontend/scripts/copy-docs.mjs) runs before `npm start` and `npm run build` and publishes `README.md` and `docs/` under `content/`. [`docs.catalog.ts`](../frontend/src/app/features/docs/docs.catalog.ts) lists the documents, and [`renderMarkdown`](../frontend/src/app/features/docs/markdown/markdown-renderer.ts) uses `marked` with GitHub-compatible heading anchors, sending links to other catalog documents to the app and other repository paths to GitHub. Angular's sanitizer cleans the HTML, and lazy routes load `marked` only with the docs pages.
- **Why:** The file on GitHub is the file the portal shows, and the same relative links work in both places.
- **Alternative:** A separate documentation site (a second build that drifts), or fetching raw files from GitHub at runtime (shows `main`, not the deployed version).

## Testing

### D26. Tests at every layer, named after the behaviour they prove
- **Context:** The brief lists minimum test cases, and reviewers will look for each one.
- **Decision:** Backend: xUnit with plain `Assert` for Core unit tests (boards built with `TestBoards.Parse("XO.", …)`), `GameService` tests including parallel requests, and HTTP tests that run the real pipeline in memory with `WebApplicationFactory<Program>`; `FakeTimeProvider` drives idle expiry. Frontend: Vitest, Angular 21's default runner, for components, the store, the API service, error mapping and the docs renderer. Backend tests are named `Method_Scenario_ExpectedOutcome`.
- **Why:** Each requirement maps to a test that can be found by name, and the HTTP tests cover JSON options, error handling, CORS, rate limits and health checks without opening a port or sleeping.
- **Alternative:** Calling controllers directly (skips everything that makes an API correct on the wire), mocking libraries (unnecessary when real objects are cheap), or Karma and Jasmine (deprecated).

### D27. `provideHttpClientTesting()` instead of `HttpClientTestingModule`
- **Context:** The specification asked for `HttpClientTestingModule`, which current Angular marks deprecated.
- **Decision:** Use `provideHttpClient()`, `provideHttpClientTesting()` and `HttpTestingController` ([`game-api.service.spec.ts`](../frontend/src/app/features/game/data-access/game-api.service.spec.ts)).
- **Why:** It is the supported replacement, with the same controller and assertions, and it fits a provider-based codebase that has no NgModules.
- **Alternative:** Following the specification literally, which works but brings a deprecated NgModule into the tests.

## Delivery & documentation

### D28. Vercel serves the site and proxies the API; Render runs the API container
- **Context:** The project should be reviewable online, and the in-memory API needs a single long-running process (D18).
- **Decision:** Vercel builds `frontend/` from [`vercel.json`](../vercel.json), serves it at <https://tictactoe-abb.vercel.app>, rewrites `/api/*` and `/swagger*` to the API and falls back to `index.html` for deep links. Render builds [`backend/Dockerfile`](../backend/Dockerfile) (multi-stage, non-root, listens on `$PORT`) from [`render.yaml`](../render.yaml) and serves <https://tictactoe-abb-api.onrender.com>, checks `/health`, and deploys only after CI passes and only when `backend/**` changes.
- **Why:** The browser stays on one origin, so production needs no CORS, and editing documentation never restarts the API and clears its games. The trade-off is the free Render plan: the API sleeps after 15 idle minutes, and the next request takes about a minute, which the UI explains.
- **Alternative:** A static host calling the API cross-origin (CORS for every host), or the API on Vercel, where in-memory state does not survive scale-to-zero or several instances (D18).

### D29. CI checks every change, and Dependabot keeps dependencies current
- **Context:** Every change should be verified the same way on a clean machine.
- **Decision:** [`ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request to `main`: the backend is restored, built and tested in Release with the SDK from `global.json`; the frontend runs `npm ci`, the build, `npm run test:ci` and `npm run format:check` on Node 22; once the backend passes, the API's Docker image is built. [`dependabot.yml`](../.github/dependabot.yml) opens weekly updates for NuGet, npm and GitHub Actions, grouping Angular packages and leaving Angular and ASP.NET Core major versions to deliberate upgrades. One root [`.editorconfig`](../.editorconfig) defines formatting.
- **Why:** A reproducible check replaces "works on my machine", and Render deploys only commits that passed it (D28).
- **Alternative:** Local checks only, which depend on one machine and on discipline.

### D30. Commits under the candidate's identity, with AI use disclosed in writing
- **Context:** The candidate asked that every commit carry their name, and the assessment expects open disclosure of AI use.
- **Decision:** Commits are authored as Vivek Kumar Singh with the GitHub no-reply address and follow Conventional Commits. How AI was used, the prompts given and what was verified by hand are documented in [AI workflow](AI_WORKFLOW.md) and [Specification prompt](SPEC_PROMPT.md).
- **Why:** The history shows who is accountable for the code, and the disclosure is complete and in one place.
- **Alternative:** `Co-Authored-By` trailers on each commit, which the candidate declined and which say less than a written account.
