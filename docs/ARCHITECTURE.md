# Architecture

This document explains how the Angular single-page app, the ASP.NET Core Web API and the `TicTacToe.Core` game rules fit together. It covers who owns which state, how a request travels through the system, and how the pieces are deployed. Links to source files open the code on GitHub.

Related documents: the [API reference](API.md) has the full JSON contract, [Design decisions](DECISIONS.md) records the reasoning and the alternatives, [Testing](TESTING.md) shows what proves the behaviour, and [Deployment](DEPLOYMENT.md) has step-by-step hosting instructions.

## Goals and constraints

**Goals**

- Meet every requirement of the [problem statement](PROBLEM_STATEMENT.md): the board, turns, win and draw detection, Reset Game, move history, undo by mode, the scoreboard and the rule-based computer opponent.
- Make the **backend the single source of truth** (Clarification 1). The server decides every rule. The browser sends actions and renders the state it gets back.
- Keep every rule explainable and testable without HTTP. The rules live in a plain class library with no web dependencies.
- Make the project easy to run and review: two commands locally, Swagger UI, and a review portal that renders these documents.
- Make it safe enough for a public demo: memory stays bounded, requests are rate limited, there is a health check, and CORS is configurable.

**Constraints and what they led to**

| Constraint | Source | Consequence |
|---|---|---|
| Angular + TypeScript frontend, .NET Web API backend, REST | Brief | Angular 21.2 (standalone components, signals, zoneless) and ASP.NET Core 8 controllers |
| In-memory storage is acceptable | Brief | Games live in a `ConcurrentDictionary` and the scoreboard in a singleton, so both are lost on restart |
| Fixed layout: `backend/TicTacToe.Api`, `TicTacToe.Core`, `TicTacToe.Tests`, `frontend/` | Spec | The "enterprise" structure comes from folders and namespaces inside these projects, not from extra projects |
| The JSON contract is frozen early | Design | Backend and frontend were built in parallel against one contract, and tests pin the exact JSON |
| Option A: no undo after a game ends | Spec decision | A finished game is final, so the scoreboard never needs correcting |
| Zero build warnings | Spec quality bar | `TreatWarningsAsErrors`, strict TypeScript and templates, Angular bundle and style budgets |
| The reviewer uses Windows + PowerShell | Spec | Commands are written for PowerShell, and the API and the UI run on fixed ports (5000 / 4200) |

**Non-goals:** authentication, persistence across restarts, running more than one API instance, and an unbeatable (minimax) computer. See [Known limitations](#known-limitations).

## System context

```text
   +--------------------------------+   source and doc links    +------------------------------+
   |  Reviewer / player             |-------------------------->|  GitHub repository           |
   |  (laptop web browser)          |                           |  code + Markdown docs        |
   +--------------------------------+                           +------------------------------+
        |                     |
        | HTML, JS, CSS,      | REST + JSON: /api/games..., /api/scoreboard...
        | content/*.md        | Swagger UI:  /swagger
        v                     v
   +----------------+   +---------------------------------+     GET /health   +-------------------+
   |  Static host   |   |  Tic Tac Toe API                |<------------------|  Hosting platform |
   |  (Angular SPA) |   |  ASP.NET Core 8                 |   liveness check  |  (Render, DO,     |
   +----------------+   |  games + scoreboard in memory   |                   |   Docker)         |
                        +---------------------------------+                   +-------------------+
```

The browser downloads the Angular app and the published Markdown documents from a static host. It then calls the API for every game action. The API owns all game state. Hosting platforms poll `GET /health` to know that the API is alive.

## Containers

```text
 Browser
 +----------------------------------------------------------------------------------------+
 |  Angular 21 SPA (frontend/)                                                            |
 |                                                                                        |
 |   /             HomePage                  /play  GamePage --> GameStore (signals)      |
 |   /docs         DocsHubPage                                       |                    |
 |   /docs/:slug   DocViewerPage --> DocsService                     v                    |
 |                                   (HttpClient, text)          GameApiService           |
 |                                        |                      (HttpClient, JSON)       |
 +----------------------------------------|-------------------------------|---------------+
                                          | GET content/docs/*.md         | POST/GET {apiBaseUrl}/...
                                          v                               v
 +--------------------------------------+   +-----------------------------------------------+
 |  Static host                         |   |  TicTacToe.Api (ASP.NET Core 8)               |
 |  index.html, hashed bundles,         |   |   pipeline: exception handler, CORS,          |
 |  content/README.md, content/docs/... |   |             rate limiter, Swagger, /health    |
 +--------------------------------------+   |   Controllers --> GameService --> Core        |
                                            |   InMemoryGameRepository     (singleton)      |
                                            |   Scoreboard                 (singleton)      |
                                            |   ExpiredSessionCleanupService (hosted)       |
                                            |                    |                          |
                                            |                    v                          |
                                            |   TicTacToe.Core (class library, no ASP.NET)  |
                                            +-----------------------------------------------+
```

| Container | Technology | Code | Responsibility |
|---|---|---|---|
| Angular SPA | Angular 21.2, TypeScript 5.9, signals | [frontend/src/app/](../frontend/src/app/) | The review portal (overview, play, docs). It holds UI state only. |
| Static host | `ng serve`, nginx, GitHub Pages, Vercel or DigitalOcean | [frontend/nginx.conf](../frontend/nginx.conf) | Serves the built app and the published docs under `content/` |
| Web API | ASP.NET Core 8 | [backend/TicTacToe.Api/](../backend/TicTacToe.Api/) | Translates HTTP to Core calls. Keeps sessions in memory and handles errors, CORS, rate limiting, Swagger and the health check. |
| Game rules | .NET 8 class library | [backend/TicTacToe.Core/](../backend/TicTacToe.Core/) | The rules, the computer opponent, the undo policy and the scoreboard |

## Backend

### Projects and dependency rules

```text
   TicTacToe.Tests ----------------------------+
         |                                     |
         v                                     v
   TicTacToe.Api  ----------------------->  TicTacToe.Core
   (ASP.NET Core Web API, Swashbuckle)      (class library: .NET base library only)
```

1. **Core has no ASP.NET or NuGet dependency.** The rules compile and run in a unit test with no web host ([TicTacToe.Core.csproj](../backend/TicTacToe.Core/TicTacToe.Core.csproj)).
2. **Dependencies point inward.** The API references Core, and Core never references the API. The test project references both.
3. **Only Core can change a board.** `Board.Place`, `Clear` and `ClearAll` are `internal`, so the API can read a board but cannot change it behind the engine's back. `InternalsVisibleTo` opens them to the tests only, so a test can set up any position directly.
4. **One place for build settings and package versions.** [Directory.Build.props](../backend/Directory.Build.props) turns on nullable reference types, implicit usings and warnings as errors. [Directory.Packages.props](../backend/Directory.Packages.props) holds every NuGet version (Central Package Management). [global.json](../backend/global.json) pins the .NET 8 SDK line.

These rules are kept by convention and code review. No architecture-test tool enforces them.

### TicTacToe.Core layers

```text
                     Sessions/   GameSession: mode, computer reply, undo policy, record result once
                    /    |    \
                   v     v     v
          Engine/    Opponents/    Scoring/
          rules      computer      totals
                   \     |     /
                    v    v    v
                     Domain/     Board, Position, Move, Player, GameMode, GameStatus
```

| Folder | Types | Responsibility |
|---|---|---|
| [Domain/](../backend/TicTacToe.Core/Domain/) | `Player`, `PlayerExtensions`, `GameMode`, `GameStatus`, `Position`, `Move`, `Board` | The shared vocabulary and the 3x3 grid. `Board.Lines` lists the 8 winning lines literally (3 rows, 3 columns, 2 diagonals). |
| [Engine/](../backend/TicTacToe.Core/Engine/) | `GameEngine`, `GameRuleException` | **The rules of Tic Tac Toe (the mechanism).** The engine validates and applies a move, derives whose turn it is, recalculates the outcome, undoes one move and resets. It knows nothing about modes or the scoreboard. |
| [Opponents/](../backend/TicTacToe.Core/Opponents/) | `ComputerPlayer` | A deterministic priority order: win, block, take the centre, take the first free corner, take the first free cell |
| [Scoring/](../backend/TicTacToe.Core/Scoring/) | `IScoreboardService`, `Scoreboard`, `ScoreSnapshot` | Totals for the lifetime of the server, shared by every game and thread-safe |
| [Sessions/](../backend/TicTacToe.Core/Sessions/) | `GameSession` | **The product's rules (the policy).** The session handles the mode and the computer's reply inside the same call. It applies Option A undo and pair undo in VsComputer mode, and it records each result exactly once. It also exposes the `SyncRoot` lock object. |

The engine/session split keeps the rules apart from the product decisions. For example, `GameEngine.UndoLastMove` can undo a winning move, and a test uses that to prove the status is recalculated from the board. `GameSession.Undo` refuses the same undo because of Option A.

### TicTacToe.Api layers

| Folder | Types | Responsibility |
|---|---|---|
| [Program.cs](../backend/TicTacToe.Api/Program.cs) | top-level statements | Three lines: `AddTicTacToeApi`, `UseTicTacToeApi`, `Run`. It also declares `public partial class Program` so the tests can host the app. |
| [Extensions/](../backend/TicTacToe.Api/Extensions/) | `ServiceCollectionExtensions`, `WebApplicationExtensions` | The composition root. One method registers everything in DI and one builds the middleware pipeline. Each concern sits in its own private method. |
| [Controllers/](../backend/TicTacToe.Api/Controllers/) | `GamesController`, `ScoreboardController` | Translate HTTP to calls on the success path only. They contain no rules and no try/catch. `[ProducesResponseType]` documents the error codes for Swagger. |
| [Contracts/Requests/](../backend/TicTacToe.Api/Contracts/Requests/), [Contracts/Responses/](../backend/TicTacToe.Api/Contracts/Responses/) | `CreateGameRequest`, `SubmitMoveRequest`, `GameStateResponse`, `CellDto`, `MoveDto`, `ScoreboardDto` | The wire format. Request members are `required`, so a missing field is a 400 instead of a silent default. Responses are positional records whose parameter order is the JSON property order. |
| [Mapping/](../backend/TicTacToe.Api/Mapping/) | `ResponseMapper` | Maps Core types to DTOs (for example `board[row][col]`), so the contract stays stable if Core changes shape |
| [Application/](../backend/TicTacToe.Api/Application/) | `GameService`, `GameNotFoundException`, `IGameRepository` | The use cases: find the game, lock it, run one action, map the result. The layer also owns the repository interface (a "port"). |
| [Infrastructure/Persistence/](../backend/TicTacToe.Api/Infrastructure/Persistence/) | `InMemoryGameRepository` | `ConcurrentDictionary<Guid, SessionEntry>`, plus the time each game was last used |
| [Infrastructure/Maintenance/](../backend/TicTacToe.Api/Infrastructure/Maintenance/) | `ExpiredSessionCleanupService` | A `BackgroundService` that removes idle games |
| [ErrorHandling/](../backend/TicTacToe.Api/ErrorHandling/) | `GameExceptionHandler`, `RateLimitRejectionHandler` | Turn expected exceptions and rate-limit rejections into `application/problem+json` |
| [Configuration/](../backend/TicTacToe.Api/Configuration/) | `FrontendCorsOptions`, `GameSessionOptions`, `RateLimitingOptions`, `ApiDocumentationOptions` | Typed settings bound from [appsettings.json](../backend/TicTacToe.Api/appsettings.json) and validated at startup |

Dependency rules inside the API:

- **Controllers call one collaborator.** `GamesController` calls `GameService`. `ScoreboardController` calls `IScoreboardService` directly, because reading or zeroing the totals involves no use-case logic.
- **The application layer defines the storage it needs.** `IGameRepository` lives in `Application/`, and `Infrastructure/Persistence/` implements it (dependency inversion). `GameService` never sees a `ConcurrentDictionary`. A database-backed store would replace one class and one DI line.
- **`GameService` returns response DTOs.** It maps inside the session lock so that every response is a consistent snapshot. This couples `Application/` to `Mapping/` and `Contracts/Responses/`, a deliberate trade-off for a single API.
- **Only `ErrorHandling/` maps exceptions to status codes.** Core throws `GameRuleException`, the application throws `GameNotFoundException`, and nothing else knows about HTTP.
- **The DTOs reuse Core's enums** (`Player`, `GameMode`, `GameStatus`) and serialise them by name. Renaming an enum member would change the JSON. The HTTP tests pin the exact strings, so such a change cannot slip through.

**Dependency injection lifetimes** ([ServiceCollectionExtensions.cs](../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs)):

| Registration | Lifetime | Why |
|---|---|---|
| `IGameRepository` → `InMemoryGameRepository` | Singleton | It holds every game, so every request must share it |
| `IScoreboardService` → `Scoreboard` | Singleton | There is one scoreboard per server process |
| `GameService` | Scoped (one per request) | It has no state of its own and works on the singletons |
| `TimeProvider.System` | Singleton | An injected clock, so tests can use `FakeTimeProvider` |
| `ExpiredSessionCleanupService` | Hosted service | It starts and stops with the app |

### Middleware pipeline

Order matters. [WebApplicationExtensions.cs](../backend/TicTacToe.Api/Extensions/WebApplicationExtensions.cs) adds the steps in this order:

1. `UseExceptionHandler()` comes first, so it catches exceptions from everything after it and hands them to `GameExceptionHandler`.
2. `UseCors(...)` uses the origins from `Cors:AllowedOrigins`. It runs before the rate limiter, so a 429 still carries the CORS header and preflight requests never use up the limit.
3. `UseRateLimiter()` applies one fixed window per client IP address.
4. `UseSwagger()` / `UseSwaggerUI()` run only when `Swagger:Enabled` is true (the default).
5. `MapHealthChecks("/health").DisableRateLimiting()` serves the health check, which is never rate limited.
6. `MapControllers()` routes to the controllers.

## Request lifecycle of a move

This is the full path of `POST /api/games/{id}/moves` in **VsComputer** mode. The human (X) plays the top-left cell on an empty board.

```text
POST /api/games/{id}/moves   { "player": "X", "row": 0, "col": 0 }
 |
 +- UseExceptionHandler ........ wraps everything below (GameExceptionHandler)
 +- UseCors .................... adds Access-Control-Allow-Origin for an allowed origin
 +- UseRateLimiter ............. per-IP fixed window; over the limit -> 429, stops here
 +- routing + model binding .... {id:guid}; JSON -> SubmitMoveRequest; malformed body -> 400, stops here
 +- GamesController.SubmitMove
     +- GameService.SubmitMove -> RunLocked(id, action)
         +- IGameRepository.Find(id) ............ unknown id -> GameNotFoundException (404)
         +- lock (session.SyncRoot)
         |    +- GameSession.PlayMove(X, (0,0))
         |    |    +- GameEngine.ApplyMove(X, (0,0)) ... game over? off board? wrong player? taken?
         |    |    |                                     -> GameRuleException (400), nothing changed
         |    |    |    place the mark, append Move #1, EvaluateOutcome()
         |    |    +- RecordResultIfFinished() ......... still in progress: nothing recorded
         |    |    +- VsComputer and still InProgress:
         |    |         +- ComputerPlayer.ChooseMove(board, O) ... win > block > centre > corner > any
         |    |         +- GameEngine.ApplyMove(O, (1,1)) ........ same checks, Move #2, EvaluateOutcome()
         |    |         +- RecordResultIfFinished() .............. if that ended the game:
         |    |                                                    Scoreboard.RecordWin / RecordDraw
         |    +- ResponseMapper.ToGameState(session, Scoreboard.GetScores())
         +- lock released
 +- 200 OK, application/json: GameStateResponse (X's move, O's reply, X to move again)
```

Step by step:

1. **Browser.** A click on a cell makes [BoardComponent](../frontend/src/app/features/game/components/board/board.component.ts) emit `cellSelected`. [GamePageComponent](../frontend/src/app/features/game/game-page.component.html) passes it to `GameStore.play(row, col)`. The store sends `player: game.currentPlayer`, the turn the backend last reported. [GameApiService](../frontend/src/app/features/game/data-access/game-api.service.ts) then posts the body to `{apiBaseUrl}/games/{id}/moves`.
2. **Pipeline.** The exception handler, CORS and the rate limiter run as described in [Middleware pipeline](#middleware-pipeline).
3. **Routing and binding.** The `{id:guid}` route constraint rejects a non-GUID id with 404 before any code runs. `[ApiController]` reads `SubmitMoveRequest` from the JSON body. `JsonStringEnumConverter(allowIntegerValues: false)` and the `required` members reject a bad body with an automatic 400 `ValidationProblemDetails`, and the action is never called.
4. **Controller.** [GamesController.SubmitMove](../backend/TicTacToe.Api/Controllers/GamesController.cs) builds a `Position` and calls `GameService.SubmitMove`.
5. **Application service.** [GameService.RunLocked](../backend/TicTacToe.Api/Application/GameService.cs) finds the session. A miss throws `GameNotFoundException`. A hit also refreshes the game's "last used" time. The service then takes `lock (session.SyncRoot)`, so requests for this game run one at a time.
6. **Session.** [GameSession.PlayMove](../backend/TicTacToe.Core/Sessions/GameSession.cs) asks the engine to apply X's move.
7. **Engine.** [GameEngine.ApplyMove](../backend/TicTacToe.Core/Engine/GameEngine.cs) checks, in order: is the game over, is the cell off the board, is it the wrong player, is the cell taken. The first failure throws `GameRuleException` before anything changes. Otherwise the engine places the mark, appends the move and recalculates the outcome from the board.
8. **Result guard.** `RecordResultIfFinished` records a finished game on the scoreboard once. Here the game is still in progress, so nothing is recorded.
9. **Computer reply.** The mode is VsComputer and the game is still in progress, so [ComputerPlayer.ChooseMove](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs) picks O's cell. In this example that is the centre (1,1). The engine applies it with the same validation, and the result guard runs again. If O's move ended the game, `Scoreboard.RecordWin(O)` or `RecordDraw()` runs under the scoreboard's own lock.
10. **Mapping.** Still inside the session lock, [ResponseMapper.ToGameState](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs) builds the `GameStateResponse` with the current scoreboard snapshot.
11. **Response.** The lock is released and the controller returns the DTO. System.Text.Json writes camelCase properties with enums as strings, and the client receives `200 OK` with both moves already applied.
12. **Browser again.** The store replaces its `game` signal with the response and saves the game id in `sessionStorage`. Its computed signals (`board`, `moves`, `canPlay`, `canUndo`, ...) recalculate, and the OnPush components re-render.

When step 7 rejects the move, the exception leaves the `lock` block, which always releases the lock. `GameExceptionHandler` then writes `400` problem+json with the title `"Invalid move"` and the rule as the `detail`. The store keeps the previous snapshot and shows the `detail` in a toast.

## State ownership

The backend owns every piece of game state. The frontend keeps only what is needed to drive the screen.

| State | Owner | Where it lives |
|---|---|---|
| Board, move history, status, winner, winning cells | Backend | `GameEngine` inside each `GameSession`, stored in `InMemoryGameRepository` |
| Whose turn it is and whether undo is allowed | Backend (derived) | `GameEngine.CurrentPlayer`, `GameSession.CanUndo`, sent as `currentPlayer` and `canUndo` |
| Mode of a game | Backend | `GameSession.Mode`, which is fixed for the life of the game (Reset keeps it) |
| Scoreboard (X wins, O wins, draws) | Backend | The singleton `Scoreboard`, shared by every game |
| The latest game snapshot | Frontend, as a read-only copy | The `game` signal in [GameStore](../frontend/src/app/features/game/state/game.store.ts). It is replaced by each response and never edited. |
| The mode picked for the *next* New Game | Frontend (UI state) | The `selectedMode` signal |
| Request in flight, error message | Frontend (UI state) | The `loading` and `errorMessage` signals |
| Which game this tab is playing | Browser | `sessionStorage['tictactoe.gameId']`, so a page refresh resumes the game |
| Documentation | Repository | `README.md` and `docs/`, published with the site as `content/` |

There is one partial update. `POST /api/scoreboard/reset` returns only the scoreboard, so the store replaces just the `scoreboard` part of its snapshot with the server's answer. The frontend still computes nothing itself.

The frontend also mirrors one fact for wording only: in VsComputer mode the human is X. [StatusBarComponent](../frontend/src/app/features/game/components/status-bar/status-bar.component.ts) uses that to choose between "You win!" and "Computer wins!". No rule depends on it.

## Derived state

Values that can be computed are computed, never stored. That is why undo can never leave anything stale.

- **Current player** is `Moves.Count % 2 == 0 ? X : O`. X always starts and the turn passes after every valid move. After an undo the turn is automatically correct. After a game ends, the value still moves on (an X win on move 5 reports `currentPlayer: "O"`), so the UI shows the result instead of the turn.
- **Outcome** (status, winner, winning cells) is recalculated by `EvaluateOutcome()` from the board after every move, undo and reset. The win check runs before the draw check, so a ninth move that completes a line is a win. If one move completes two lines, the first line in `Board.Lines` order is reported.
- **`canUndo`** is `Status == InProgress && Moves.Count > 0`. The server computes it, so the Undo button never re-implements the rule.
- **Pair undo in VsComputer mode** is derived from the turn, not hard-coded as "undo two". The session undoes once, and then once more only if it is now the computer's turn.
- **Frontend computed signals** (`board`, `winningCells`, `moves`, `scoreboard`, `canPlay`, `canUndo`, `canReset`) combine the snapshot with the `loading` flag. They add no game rules.

One flag is stored deliberately: `GameSession._resultRecorded`. Recording a result is a side effect on a shared object, the scoreboard, and it cannot be derived from the board afterwards. The flag guarantees "exactly once per game", and only Reset clears it.

## Concurrency model

Kestrel serves requests in parallel on thread-pool threads. Three mechanisms keep the shared state consistent:

```text
   request A (game 1) --+                                  +--> lock(game1.SyncRoot) --+
   request B (game 1) --+--> InMemoryGameRepository.Find --+    (A and B take turns)   +--> Scoreboard
   request C (game 2) --+    (ConcurrentDictionary,        +--> lock(game2.SyncRoot) --+    (own private lock)
                             no global lock)                    (runs in parallel)
```

- **Store:** [InMemoryGameRepository](../backend/TicTacToe.Api/Infrastructure/Persistence/InMemoryGameRepository.cs) uses a `ConcurrentDictionary<Guid, SessionEntry>`. `Add` uses `TryAdd`. `Find` uses `TryGetValue` and then swaps in a new immutable entry with a fresh "last used" time (`TryUpdate`), so no lock is needed.
- **Per-game lock:** `GameSession` is not thread-safe on its own. `GameService` locks the session's `SyncRoot` for every operation, reads included, so a read never sees a half-finished request (X's move applied but O's reply not yet). Requests for different games never wait for each other. `CreateGame` maps the new game before adding it to the store, so no other request can see it yet and no lock is needed.
- **Scoreboard lock:** [Scoreboard](../backend/TicTacToe.Core/Scoring/Scoreboard.cs) guards its three counters with one private lock, and `GetScores()` returns a consistent `ScoreSnapshot`. Locks are always taken in the same order (session, then scoreboard) and the scoreboard never calls back into a session, so the two locks cannot deadlock.
- **Cleanup service:** [ExpiredSessionCleanupService](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs) wakes up every `Sessions:CleanupInterval` (10 minutes) on a `PeriodicTimer`, so two cleanups never overlap. It calls `RemoveIdleSince(now - Sessions:IdleTimeout)`. `TryRemove(pair)` removes an entry only if it is still the exact entry that was checked, so a game found in the meantime stays. Both the timer and the repository read time from the injected `TimeProvider`.
- **Frontend:** the browser is single-threaded, and the store ignores new actions while a request is in flight, so a double click sends one request. The server's lock is the real guarantee. The browser rule only avoids pointless 400s.

All of this is in-process. Running two API instances would split games and scoreboards between them (see [Known limitations](#known-limitations)).

## Error model

| Situation | Raised by | HTTP response |
|---|---|---|
| A move or undo breaks a game rule | `GameRuleException` (Core) | **400** problem+json, `title: "Invalid move"`, `detail`: the rule, e.g. `Cell (row 0, col 0) is already taken by X.` |
| Unknown game id (never created, or removed as idle) | `GameNotFoundException` (Application) | **404** problem+json, `title: "Game not found"` |
| Malformed body: missing field, wrong type, unknown enum name, number for an enum | ASP.NET Core model binding (`[ApiController]`) | **400** `ValidationProblemDetails` with exactly one `errors` entry naming the field |
| Id is not a GUID | `{id:guid}` route constraint | **404** with an empty body |
| Body sent without `Content-Type: application/json` | MVC | **415** |
| Too many requests from one IP address | Rate limiter → `RateLimitRejectionHandler` | **429** problem+json and a `Retry-After` header |
| Anything else (a bug) | Any code | Logged by `GameExceptionHandler`, then **500** problem+json with no internal details |

Notes on the design:

- **Exceptions for rule violations.** Core reports a broken rule by throwing `GameRuleException` with a sentence written for the player. The controllers describe only the success path. [GameExceptionHandler](../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs), the .NET 8 `IExceptionHandler`, is the single place that maps the two expected exception types to 400/404 and writes them through `IProblemDetailsService`.
- **Validation happens once.** Board range, turn and occupancy are checked in Core. That gives one source of truth and one message, which is why the request DTOs have no `[Range]` attributes.
- **Invariant guards are not user errors.** `Board.Place` on an occupied cell, `ComputerPlayer.ChooseMove` on a full board and a duplicate game id throw `InvalidOperationException`. They cannot happen through the API. If one did, it would surface as a logged 500.
- **Two .NET 8 specifics.** First, the exception middleware's own "unhandled exception" log is filtered out, because it would report every expected 400/404 as a failure. `GameExceptionHandler` logs real failures itself. Second, `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes` stops MVC from adding a vague second validation error, so the first error is always the real cause. Both are explained in [ServiceCollectionExtensions.cs](../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs).

**In the browser:** [toErrorMessage](../frontend/src/app/core/http/api-error.ts) turns any failed call into one sentence. Status 0 (no response: server down or CORS refused) becomes "Cannot reach the game server at ...". Otherwise the function uses the problem's `detail`, then the first validation error, then the `title`, then a generic message. The store puts the sentence in `errorMessage` and keeps the last good snapshot. [ErrorToastComponent](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts) shows it as a non-blocking `role="alert"` toast that closes itself after 5 seconds.

## Frontend architecture

### Folder structure

```text
frontend/src/
  environments/        one AppConfig per deployment (see "Configuration per deployment")
  app/
    app.config.ts      providers: router, title strategy, HttpClient, APP_CONFIG
    app.routes.ts      lazy-loaded routes
    app.component.*    the shell: skip link, site header, <main><router-outlet/></main>, site footer
    core/              app-wide pieces used by every page; never imports a feature
      config/          APP_CONFIG injection token and the AppConfig interface
      http/            toErrorMessage: ProblemDetails -> one readable sentence
      layout/          site-header, site-footer, not-found-page
      routing/         PageTitleStrategy ("Play · Tic Tac Toe")
    shared/ui/         reusable presentational components: error-toast
    features/
      home/            landing page for reviewers (+ architecture diagram, page content as data)
      game/            the /play page: state/, data-access/, models/, components/, testing/
      docs/            docs hub, doc viewer, catalog, data-access/, markdown/, components/
    testing/           TEST_APP_CONFIG shared by the specs
```

- `core/` and `shared/` never import from `features/`.
- Features do not depend on each other, with one read-only exception: the home page reads the docs catalog to show quick links.

### Routing and lazy loading

[app.routes.ts](../frontend/src/app/app.routes.ts) uses `loadComponent` for every page, so each page is its own lazy chunk. The initial download stays small, and the Markdown renderer (`marked`) is fetched only when a document is opened.

| Path | Page | Title |
|---|---|---|
| `''` | `HomePageComponent` | Overview · Tic Tac Toe |
| `play` | `GamePageComponent` | Play · Tic Tac Toe |
| `docs` | `DocsHubPageComponent` | Documentation · Tic Tac Toe |
| `docs/:slug` | `DocViewerPageComponent` | Documentation · Tic Tac Toe |
| `**` | `NotFoundPageComponent` | Not found · Tic Tac Toe |

[app.config.ts](../frontend/src/app/app.config.ts) configures the router:

- `withComponentInputBinding()` delivers `:slug` as a signal input.
- `withInMemoryScrolling(...)` scrolls to the top on navigation and supports `#anchor` links.
- [PageTitleStrategy](../frontend/src/app/core/routing/page-title.strategy.ts) appends the app name to each route title.

### Configuration per deployment

Services never import an environment file. They inject the [`APP_CONFIG`](../frontend/src/app/core/config/app-config.ts) token (`apiBaseUrl`, `swaggerUrl`, `repositoryUrl`), which `app.config.ts` provides from `environment.ts`. [angular.json](../frontend/angular.json) swaps that file per build configuration with `fileReplacements`:

| Build | File | `apiBaseUrl` |
|---|---|---|
| `ng serve` (development) | [environment.ts](../frontend/src/environments/environment.ts) | `http://localhost:5000/api` |
| `ng build` (production: Docker, Vercel, DigitalOcean) | [environment.production.ts](../frontend/src/environments/environment.production.ts) | `/api`, the same origin, proxied by the host |
| `ng build --configuration github-pages` | [environment.github-pages.ts](../frontend/src/environments/environment.github-pages.ts) | `https://tictactoe-abb-api.onrender.com/api`, plus `baseHref: "/ABB/"` |

The specs provide their own [TEST_APP_CONFIG](../frontend/src/app/testing/app-config.fixture.ts), whose URLs differ from every environment file. A spec therefore fails if code reads an environment file directly.

### Game feature: a signal store and presentational components

```text
  user click
     |
     v
  presentational component --(output)--> GamePageComponent --> GameStore method (play, undo, ...)
     ^                                                              |
     |                                                              | if loading: ignore
     | signal inputs                                                | loading = true, error = null
     |                                                              v
  GamePageComponent template <-- computed signals <-- game.set(response) <-- GameApiService --> API
                                 (board, moves, canPlay, canUndo, ...)
```

- **[GameStore](../frontend/src/app/features/game/state/game.store.ts)** (`providedIn: 'root'`) is the single place the page reads state from and sends actions to. Its writable signals are private. Components get read-only views and change state only through methods (`init`, `newGame`, `play`, `undo`, `resetGame`, `resetScoreboard`, `selectMode`, `dismissError`). One private `run()` helper handles every request: it ignores an action while one is in flight, sets `loading`, clears the error, stores the response on success, and turns a failure into `errorMessage`.
- **`init()`** resumes the game id saved for this browser tab, or creates a new game when there is none or the server no longer knows it (for example after a restart).
- **[GameApiService](../frontend/src/app/features/game/data-access/game-api.service.ts)** is a thin `HttpClient` wrapper with one method per endpoint and no logic.
- **[GamePageComponent](../frontend/src/app/features/game/game-page.component.ts)** is the only component that injects the store. It binds signals to inputs and outputs to store methods.
- **Presentational components** render their inputs and emit intents. They have no services and no rules:

| Component | Inputs | Outputs |
|---|---|---|
| [BoardComponent](../frontend/src/app/features/game/components/board/board.component.ts) | `board`, `winningCells`, `disabled` | `cellSelected` |
| [CellComponent](../frontend/src/app/features/game/components/cell/cell.component.ts) | `value`, `row`, `col`, `highlighted`, `disabled` | `selected` |
| [StatusBarComponent](../frontend/src/app/features/game/components/status-bar/status-bar.component.ts) | `game`, `loading` | none |
| [ControlsComponent](../frontend/src/app/features/game/components/controls/controls.component.ts) | `selectedMode`, `activeMode`, `canUndo`, `canReset`, `busy` | `modeSelected`, `newGame`, `undo`, `resetGame` |
| [MoveHistoryComponent](../frontend/src/app/features/game/components/move-history/move-history.component.ts) | `moves` | none |
| [ScoreboardComponent](../frontend/src/app/features/game/components/scoreboard/scoreboard.component.ts) | `scoreboard`, `busy` | `resetScoreboard` |
| [ErrorToastComponent](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts) | `message` | `dismissed` |

[game.models.ts](../frontend/src/app/features/game/models/game.models.ts) mirrors the JSON contract in TypeScript, using string-literal unions for the enums.

### Docs portal

The portal renders the same Markdown files that reviewers read on GitHub, so there is one source of truth:

```text
 README.md, docs/*.md, docs/assets/*                         (repository)
      |  npm start / npm run build  ->  prestart / prebuild  ->  scripts/copy-docs.mjs
      v
 frontend/public/content/                                    (git-ignored copy, published as static assets)
      |  GET content/docs/API.md  (relative URL, so it also works under the /ABB/ base href)
      v
 DocsService.getMarkdown()      an HTML answer (a host's SPA fallback) is treated as 404
      v
 renderMarkdown()               marked + GitHub-style heading ids + link rewriting + table of contents
      v
 <article [innerHTML]>          sanitised by Angular
      +  HeadingAnchorsDirective   sets heading ids after render, scrolls to the #fragment
      +  InAppLinksDirective       routes clicks on in-app links through the Angular Router
```

- **Publishing.** [copy-docs.mjs](../frontend/scripts/copy-docs.mjs) exists because the Angular builder refuses asset folders outside `frontend/`. npm runs it before `start`, `build` and `watch`.
- **Catalog.** [docs.catalog.ts](../frontend/src/app/features/docs/docs.catalog.ts) is the typed list of documents (slug, title, category, source path). It drives the hub, the sidebar and the previous/next links.
- **Links.** [doc-link-resolver.ts](../frontend/src/app/features/docs/markdown/doc-link-resolver.ts) resolves relative links the way GitHub does:
  - a link to another catalog document opens in the app, keeping its `#anchor`;
  - the Word original is downloaded;
  - any other repository path, such as the source-code links in this document, opens on GitHub in a new tab.
- **Heading anchors.** Angular's sanitiser strips `id` attributes from `[innerHTML]`, so the renderer returns the heading ids separately and [HeadingAnchorsDirective](../frontend/src/app/features/docs/markdown/heading-anchors.directive.ts) sets them through the DOM. The [heading slugger](../frontend/src/app/features/docs/markdown/heading-slugger.ts) follows GitHub's rules, so `API.md#rate-limiting` works in both places.
- **Missing files.** A document missing from the build shows a friendly "not published yet" state with a link to GitHub. Diagrams in these documents are plain-text code blocks, because the portal does not render Mermaid.

### Angular choices in one place

- **Standalone components** only: no NgModules.
- **Zoneless change detection**, the default since Angular 21. Signals drive change detection, there is no zone.js, and every component is `OnPush`.
- **Modern APIs:** `inject()`, signal `input()` / `output()`, `computed`, `effect` (toast timer), `afterRenderEffect` (heading anchors), `toSignal` / `toObservable` (the doc viewer's `switchMap` cancels a stale document request), and the built-in `@if` / `@for` / `@switch` / `@let` template syntax.
- **Strict TypeScript and strict templates.** No UI library is used: the styles are plain CSS with shared tokens in `src/styles.css`, and each component stylesheet stays under the 4 kB budget.

## Deployment topology

The same two artifacts run everywhere: the Angular build and the API container image built from [backend/Dockerfile](../backend/Dockerfile). The Dockerfile is a multi-stage build that runs as a non-root user, listens on `PORT` (default 8080) and honours `X-Forwarded-*` headers from a proxy. What changes between hosts is whether the browser talks to the API **cross-origin** (which needs CORS) or **same-origin** (the host proxies `/api` and `/swagger`). Step-by-step instructions are in [Deployment](DEPLOYMENT.md).

**Local development**

```text
 Browser --- http://localhost:4200 ---------> ng serve        (SPA + content/)       environment.ts
    |
    +------- http://localhost:5000/api -----> dotnet run      (TicTacToe.Api)        CORS allows localhost:4200
```

**Docker Compose** ([docker-compose.yml](../docker-compose.yml), web image from [frontend/Dockerfile](../frontend/Dockerfile))

```text
 Browser --- http://localhost:8080 ---------> web: nginx      (SPA + content/)       environment.production.ts
                                                |  /api/*, /swagger  -> proxy_pass
                                                v
                                              api: TicTacToe.Api on :8080            same origin: no CORS needed
```

**GitHub Pages + Render**

```text
 Browser --- https://intellectwithvivek.github.io/ABB/ ---> GitHub Pages     (static, base href /ABB/)
    |
    +------- https://tictactoe-abb-api.onrender.com/api ---> Render web service (backend/Dockerfile)
                                                            CORS: Cors__AllowedOrigins__0 = the Pages origin
```

**Vercel** (frontend) with the API on any Docker host

```text
 Browser --- https://<project>.vercel.app ---> Vercel static site (SPA)
                                                 |  rewrites /api/* and /swagger -> API host
                                                 v
                                               API on Render, DigitalOcean or any Docker host
```

**DigitalOcean App Platform** (one app, two components)

```text
 Browser --- https://<app>.ondigitalocean.app ---> App Platform router
                                                     |-- /                 -> static site "web"
                                                     |-- /api, /swagger    -> service "api" (backend/Dockerfile)
```

| Topology | Frontend build | `apiBaseUrl` | Cross-origin? | Configuration files |
|---|---|---|---|---|
| Local | `ng serve` | `http://localhost:5000/api` | Yes, `localhost:4200` is allowed by default | [launchSettings.json](../backend/TicTacToe.Api/Properties/launchSettings.json), [appsettings.json](../backend/TicTacToe.Api/appsettings.json) |
| Docker Compose | production | `/api` | No, nginx proxies | [docker-compose.yml](../docker-compose.yml), [frontend/nginx.conf](../frontend/nginx.conf) |
| GitHub Pages + Render | `github-pages` | `https://tictactoe-abb-api.onrender.com/api` | Yes, set the Pages origin in `Cors__AllowedOrigins__0` | [deploy-pages.yml](../.github/workflows/deploy-pages.yml), `render.yaml` |
| Vercel | production | `/api` | No, Vercel rewrites | `vercel.json` |
| DigitalOcean | production | `/api` | No, App Platform routes | `.do/app.yaml` |

Because state is in memory, a restarted or stopped API instance forgets every game and resets the scoreboard. A free Render instance, for example, can be stopped when idle. The frontend copes with this in two ways:

- When the page loads and the saved game id returns 404, the store starts a new game.
- A move sent to a game that has disappeared shows the 404 message in the toast, and New Game recovers.

## Cross-cutting concerns

| Concern | Implementation | Setting | Tests |
|---|---|---|---|
| Health check | `AddHealthChecks()` + `MapHealthChecks("/health")`, plain text `Healthy`, never rate limited | none | `HealthCheckTests`, `RateLimitingTests.Health_OverPermitLimit_IsNotRateLimited` |
| Rate limiting | Built-in `AddRateLimiter` with a global limiter partitioned by client IP; 429 written as problem+json with `Retry-After` | `RateLimiting:PermitLimit` (300), `RateLimiting:WindowSeconds` (60) | `RateLimitingTests` |
| Session expiry | `ExpiredSessionCleanupService` + `InMemoryGameRepository.RemoveIdleSince`; any request for a game counts as using it | `Sessions:IdleTimeout` (2 h), `Sessions:CleanupInterval` (10 min) | `ExpiredSessionCleanupServiceTests`, `InMemoryGameRepositoryTests` |
| CORS | `UseCors` with the origins from `FrontendCorsOptions` (`[MinLength(1)]`). It sits before the rate limiter, so a 429 also carries the header; error responses carry it too. | `Cors:AllowedOrigins`, overridable as `Cors__AllowedOrigins__0` | `GamesApiTests.Preflight_*`, `SubmitMove_RejectedMoveFromFrontendOrigin_ErrorCarriesCorsHeader`, `RateLimitingTests` |
| Swagger / OpenAPI | Swashbuckle; `[ProducesResponseType]` on every action documents its status codes; served in every environment so a deployed API documents itself | `Swagger:Enabled` (true) | `ConfigurationTests.SwaggerDocument_*` |
| Settings validation | Options pattern with `ValidateDataAnnotations().ValidateOnStart()`: a bad value stops startup with a message naming the setting | all of the above | `ConfigurationTests.Startup_ZeroCleanupInterval_FailsWithValidationError` |
| JSON conventions | camelCase properties, enums as names (integers rejected), `required` request members | none | `GamesApiTests` assert raw JSON |
| Logging | Default console logging. The exception middleware's duplicate log is filtered out, and `GameExceptionHandler` logs real failures. | `Logging` section | Not asserted |
| Build quality | Warnings as errors, nullable reference types, central package versions, strict TypeScript and templates, bundle and style budgets, Prettier | [Directory.Build.props](../backend/Directory.Build.props), [angular.json](../frontend/angular.json), [.prettierrc](../frontend/.prettierrc) | The build itself |
| Continuous integration | On every push and pull request to `main`, GitHub Actions builds and tests the backend (Release) and the frontend (build, tests, Prettier check), then builds both Docker images | [ci.yml](../.github/workflows/ci.yml) | Runs both suites |
| Accessibility | Skip link, `aria-live` status, labelled board cells ("Row 1, Column 1, empty"), `role="alert"` toast, visible focus rings | none | Component specs query by these attributes |
| Security posture | No authentication, by design for this exercise. Angular sanitises `[innerHTML]`. The container runs as non-root. The repository holds no secrets. | none | Not applicable |

## Known limitations

- **In-memory only.** Games and the scoreboard are lost on restart. Persistence would replace `InMemoryGameRepository` and `Scoreboard` behind their existing interfaces.
- **Single instance.** The per-game lock and the stores are in-process, so scaling out needs shared storage and a distributed lock or optimistic concurrency.
- **One global scoreboard.** "Session-level" means the lifetime of the server process, shared by every player, as decided in the spec.
- **No identity.** Anyone who knows a game id can play it. A game id is a random GUID that is never listed, which is acceptable for a demo but not for real multiplayer.
- **Rule-based computer.** The opponent follows the brief's five-step priority, so it can be beaten. A minimax opponent would replace `ComputerPlayer` only.

More detail and the alternatives considered are in [Design decisions](DECISIONS.md).
