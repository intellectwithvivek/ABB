# Architecture

How the Angular single-page app, the ASP.NET Core Web API and the `TicTacToe.Core` rules library fit together: who owns which state, how a request travels through the system, and how it is deployed. Links to source files open the code on GitHub.

Related: the [API reference](API.md) holds the JSON contract, [Design decisions](DECISIONS.md) the reasoning and alternatives, [Testing](TESTING.md) the test strategy and [Deployment](DEPLOYMENT.md) the hosting setup.

## Goals and constraints

- **Meet the [problem statement](PROBLEM_STATEMENT.md):** board, turns, win and draw detection, Reset Game, move history, undo by mode, scoreboard and the rule-based computer opponent.
- **The backend is the single source of truth.** The server decides every rule; the browser sends actions and renders the state it receives.
- **Rules are testable without HTTP.** They live in a class library with no web dependencies.
- **Easy to review:** two commands to run locally, Swagger UI, and a portal that renders these documents.
- **Safe enough for a public demo:** bounded memory, rate limits, a health check, small request bodies.

| Constraint | Consequence |
|---|---|
| Angular + TypeScript frontend, .NET Web API, REST (brief) | Angular 21.2 (standalone, signals, zoneless) and ASP.NET Core 8 controllers |
| In-memory storage is acceptable (brief) | Games in a `ConcurrentDictionary`, the scoreboard in a singleton; both are lost on restart |
| Fixed project layout (specification) | Structure comes from folders and namespaces inside the given projects ([D1](DECISIONS.md#d1-keep-the-specified-project-layout-and-structure-the-code-inside-it)) |
| Option A: no undo after a game ends | A finished game is final, so the scoreboard never needs correcting |
| Zero build warnings | `TreatWarningsAsErrors`, strict TypeScript and templates, bundle and style budgets |

**Non-goals:** authentication, persistence across restarts, several API instances, an unbeatable computer.

## System context and containers

```text
                 +---------------------------+     source links     +---------------------+
                 |  Reviewer's browser       |--------------------->|  GitHub repository  |
                 +---------------------------+                      +---------------------+
                     | HTML, JS, CSS, content/*.md
                     | REST + JSON on /api, Swagger UI on /swagger (same origin)
                     v
 +-------------------------------------------+   rewrite /api/*, /swagger*   +--------------------------------+
 |  Vercel                                   |------------------------------>|  Render: TicTacToe.Api         |
 |  static Angular build + published docs    |                               |  ASP.NET Core 8, Docker        |
 +-------------------------------------------+                               |  games + scoreboard in memory  |
                                                                             +--------------------------------+
                                                                                  ^  GET /health (health check)
```

```text
 Angular 21 SPA (frontend/)                                   TicTacToe.Api (backend/)
 +-----------------------------------------------+            +------------------------------------------------+
 |  /            HomePageComponent               |            |  pipeline: exception handler, status pages,    |
 |  /play        GamePageComponent --> GameStore |            |            CORS, rate limiter, Swagger, /health|
 |                                       |       |  REST/JSON |  Controllers --> GameService --> Core          |
 |                              GameApiService --+----------->|  InMemoryGameRepository        (singleton)     |
 |  /docs        DocsHubPageComponent            |            |  Scoreboard                    (singleton)     |
 |  /docs/:slug  DocViewerPageComponent          |            |  ExpiredSessionCleanupService  (hosted)        |
 |                 --> DocsService: content/*.md |            |                    |                           |
 +-----------------------------------------------+            |  TicTacToe.Core (class library, no ASP.NET)    |
                                                              +------------------------------------------------+
```

| Container | Technology | Code | Responsibility |
|---|---|---|---|
| SPA | Angular 21.2, TypeScript 5.9 | [frontend/src/app/](../frontend/src/app/) | Review portal (overview, play, docs); UI state only |
| Web API | ASP.NET Core 8 | [backend/TicTacToe.Api/](../backend/TicTacToe.Api/) | HTTP to Core calls, game storage, errors, limits, Swagger, health |
| Rules | .NET 8 class library | [backend/TicTacToe.Core/](../backend/TicTacToe.Core/) | Rules, computer opponent, undo policy, scoreboard |

## Backend

### Projects and dependency rules

```text
   TicTacToe.Tests --------------------------+
         |                                   |
         v                                   v
   TicTacToe.Api  ---------------------->  TicTacToe.Core
   (ASP.NET Core 8, Swashbuckle)           (no package or framework references beyond .NET)
```

1. **Core has no ASP.NET dependency**, so every rule runs in a plain unit test.
2. **Dependencies point inward.** The API references Core; Core never references the API.
3. **Only Core changes a board.** `Board.Place`, `Clear` and `ClearAll` are `internal`; `InternalsVisibleTo` opens them to the tests only.
4. **Build settings and package versions live in one place:** [Directory.Build.props](../backend/Directory.Build.props), [Directory.Packages.props](../backend/Directory.Packages.props) and [global.json](../backend/global.json).

### TicTacToe.Core

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

| Folder | Main types | Responsibility |
|---|---|---|
| [Domain/](../backend/TicTacToe.Core/Domain/) | `Board`, `Position`, `Move`, `Player`, `GameMode`, `GameStatus` | Vocabulary and the 3x3 grid; `Board.Lines` lists the 8 winning lines |
| [Engine/](../backend/TicTacToe.Core/Engine/) | `GameEngine`, `GameRuleException` | **Rules:** validate and apply a move, derive the turn, recalculate the outcome, undo, reset |
| [Opponents/](../backend/TicTacToe.Core/Opponents/) | `ComputerPlayer` | Win, block, centre, first free corner, first free cell |
| [Scoring/](../backend/TicTacToe.Core/Scoring/) | `IScoreboardService`, `Scoreboard`, `ScoreSnapshot` | Thread-safe totals shared by every game |
| [Sessions/](../backend/TicTacToe.Core/Sessions/) | `GameSession` | **Product policy:** mode, computer reply, Option A, pair undo, exactly-once recording, `SyncRoot` |

### TicTacToe.Api

| Folder | Responsibility |
|---|---|
| [Program.cs](../backend/TicTacToe.Api/Program.cs), [Extensions/](../backend/TicTacToe.Api/Extensions/) | Composition root: `AddTicTacToeApi` registers services, `UseTicTacToeApi` builds the pipeline |
| [Controllers/](../backend/TicTacToe.Api/Controllers/) | `GamesController`, `ScoreboardController`: success path only, no rules, no `try`/`catch` |
| [Contracts/](../backend/TicTacToe.Api/Contracts/) | Request records with `required` members; positional response records in JSON order |
| [Mapping/](../backend/TicTacToe.Api/Mapping/) | `ResponseMapper`: Core types to DTOs |
| [Application/](../backend/TicTacToe.Api/Application/) | `GameService` (find, lock, act, map), `IGameRepository` (the storage port), `GameNotFoundException` |
| [Infrastructure/](../backend/TicTacToe.Api/Infrastructure/) | `InMemoryGameRepository`, `ExpiredSessionCleanupService` |
| [ErrorHandling/](../backend/TicTacToe.Api/ErrorHandling/) | `GameExceptionHandler`, `RateLimitRejectionHandler`: errors as problem+json |
| [Configuration/](../backend/TicTacToe.Api/Configuration/) | Typed settings validated at startup: CORS, Swagger, rate limits, idle games |

- **The application layer owns its storage port.** `IGameRepository` lives in `Application/` and `Infrastructure/` implements it, so `GameService` never sees a `ConcurrentDictionary`.
- **`GameService` returns response DTOs**, because the response must be built while the game's lock is held. `ScoreboardController` calls `IScoreboardService` directly; there is no use-case logic to add.
- **Only `ErrorHandling/` knows status codes.** Core throws `GameRuleException`, the application layer throws `GameNotFoundException`.
- **Lifetimes follow state:** `IGameRepository`, `IScoreboardService` and `TimeProvider` are singletons, `GameService` is scoped, the cleanup service is hosted.

### Middleware pipeline

[WebApplicationExtensions.cs](../backend/TicTacToe.Api/Extensions/WebApplicationExtensions.cs) adds, in order:

1. `UseExceptionHandler()` catches everything after it and hands it to `GameExceptionHandler`.
2. `UseStatusCodePages()` gives body-less errors (404 for an unknown path or non-GUID id, 405) a problem+json body.
3. `UseCors(...)` serves the origins in `Cors:AllowedOrigins` (the Angular dev server). It precedes the rate limiter, so a 429 still carries CORS headers.
4. `UseRateLimiter()` applies the per-IP window to every request and the stricter `create-game` policy to `POST /api/games`.
5. `UseSwagger()` / `UseSwaggerUI()` when `Swagger:Enabled` is true (the default).
6. `MapHealthChecks("/health").DisableRateLimiting()`, then `MapControllers()`.

Kestrel limits request bodies to 4 KB; a larger body is answered with 413 problem+json.

## Request lifecycle: a move in VsComputer mode

```text
Browser  cell click -> BoardComponent (cellSelected) -> GamePageComponent -> GameStore.play(0, 0)
         GameApiService: POST /api/games/{id}/moves  {"player":"X","row":0,"col":0}
         (deployed: same origin, Vercel rewrites the request to the Render API)

API      route matching ............. {id:guid}; not a GUID -> no route -> 404
 +- UseExceptionHandler ............. anything thrown below -> GameExceptionHandler
 +- UseCors / UseRateLimiter ........ over the per-IP limit -> 429, stops here
 +- GamesController.SubmitMove
     +- model binding ............... SubmitMoveRequest; malformed body -> 400 ValidationProblemDetails
     +- GameService.SubmitMove -> RunLocked
         +- IGameRepository.Find(id) ............. unknown id -> GameNotFoundException -> 404
         +- lock (session.SyncRoot)
         |   +- GameSession.PlayMove(X, (0,0))
         |   |   +- GameEngine.ApplyMove .......... game over? off board? wrong turn? taken?
         |   |   |                                  -> GameRuleException -> 400, nothing changed
         |   |   |                                  place X, append move 1, EvaluateOutcome()
         |   |   +- RecordResultIfFinished() ...... still in progress: nothing recorded
         |   |   +- VsComputer and still in progress:
         |   |       +- ComputerPlayer.ChooseMove . win > block > centre > corner > any  => (1,1)
         |   |       +- GameEngine.ApplyMove(O) ... same checks, move 2, EvaluateOutcome()
         |   |       +- RecordResultIfFinished() .. if the game ended: one RecordWin / RecordDraw
         |   +- ResponseMapper.ToGameState(session, scoreboard.GetScores())
         +- lock released
 +- 200 OK  GameStateResponse: X's move and O's reply, X to move

Browser  GameStore sets `game`, saves the id in sessionStorage -> computed signals -> OnPush views re-render
```

- The store sends `player: game.currentPlayer`, the turn the server last reported; it never decides whose turn it is.
- When a rule is broken, the exception leaves the `lock` block (releasing it) and `GameExceptionHandler` writes `400` with title `Invalid move` and the rule as `detail`. The store shows the `detail` and reloads the game, so a tab whose copy is stale catches up.

## State ownership and derived state

| State | Owner | Where it lives |
|---|---|---|
| Board, history, status, winner, winning cells | Backend | `GameEngine` inside each `GameSession`, held by `InMemoryGameRepository` |
| Whose turn, whether undo is allowed | Backend (derived) | `GameEngine.CurrentPlayer`, `GameSession.CanUndo` → `currentPlayer`, `canUndo` |
| Mode | Backend | `GameSession.Mode`, fixed for the life of a game (Reset keeps it) |
| Scoreboard | Backend | The singleton `Scoreboard`, shared by every game |
| Latest game snapshot | Frontend, read-only copy | The `game` signal in [GameStore](../frontend/src/app/features/game/state/game.store.ts), replaced by each response |
| Mode for the next New Game, request in flight, error | Frontend UI state | `selectedMode`, `loading`, `errorMessage` signals |
| Which game this tab plays | Browser | `sessionStorage['tictactoe.gameId']` |

Values that can be computed are never stored:

- **Current player** is `Moves.Count % 2 == 0 ? X : O`. After the game ends it still advances, so clients read `status` first.
- **Outcome** is recalculated by `EvaluateOutcome()` after every move, undo and reset; a win is checked before a draw, and if one move completes two lines the first in `Board.Lines` order is reported.
- **`canUndo`** is `Status == InProgress && Moves.Count > 0`, computed on the server.
- **Pair undo** follows from the turn: undo once, then once more if it is now the computer's turn.
- **Frontend `computed()` signals** (`board`, `moves`, `canPlay`, `canUndo`, …) only read the snapshot.

The one stored flag is `GameSession._resultRecorded`: recording a result is a side effect on the shared scoreboard and cannot be derived afterwards. Only Reset clears it.

## Concurrency

```text
   request A (game 1) --+                                  +--> lock(game1.SyncRoot) --+
   request B (game 1) --+--> InMemoryGameRepository.Find --+    (A and B take turns)   +--> Scoreboard
   request C (game 2) --+    (ConcurrentDictionary,        +--> lock(game2.SyncRoot) --+    (own private lock)
                             no global lock)                    (runs in parallel)
```

- **Store:** `Add` uses `TryAdd`; `Find` uses `TryGetValue`, then `TryUpdate` swaps in an immutable entry with a fresh "last used" time.
- **Per-game lock:** `GameService` locks the session's `SyncRoot` for every operation, reads included, so no read sees the human's move without the computer's reply. `CreateGame` maps the new game before adding it to the repository, so it needs no lock.
- **Scoreboard:** one private lock guards the three counters, and `GetScores()` returns a consistent `ScoreSnapshot`. Locks are always taken session first, then scoreboard, so they cannot deadlock.
- **Idle cleanup:** [ExpiredSessionCleanupService](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs) ticks every 10 minutes on a `PeriodicTimer` and calls `RemoveIdleSince(now - 2 h)`. `TryRemove(pair)` removes only the exact entry it checked, so a game used in the meantime stays. A failed run is logged and retried at the next tick.
- **Browser:** the store ignores new actions while one is in flight; the server lock is the real guarantee.

## Error model

| Situation | Response |
|---|---|
| A move or undo breaks a rule (`GameRuleException`) | **400**, title `Invalid move`, `detail` = the rule |
| Unknown game id (`GameNotFoundException`) | **404**, title `Game not found` |
| Malformed body: missing field, wrong type, unknown enum name, number for an enum | **400** `ValidationProblemDetails` with one `errors` entry |
| Id not a GUID, or unknown path | **404** via `UseStatusCodePages` |
| Wrong HTTP method | **405** via `UseStatusCodePages` |
| Body over 4 KB / no JSON content type | **413** / **415** |
| Too many requests from one IP | **429** with `Retry-After` (`RateLimitRejectionHandler`) |
| Anything else | Logged by `GameExceptionHandler`, then **500** without internal details |

Every error is RFC 7807 `application/problem+json`. In the browser, [toErrorMessage](../frontend/src/app/core/http/api-error.ts) turns a failure into one sentence: `detail`, then the first validation error, then `title`. A 502/503/504 from the proxy becomes "The game server is starting up or temporarily unavailable. Please try again in a moment."; status 0 becomes "Cannot reach the game server…". On a game action, a 400 reloads the game and a 404 starts a new game in the same mode. [ErrorToastComponent](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts) shows the message as a non-blocking `role="alert"` toast.

## Frontend architecture

```text
frontend/src/
  environments/      environment.ts (local), environment.production.ts (deployed)
  app/
    app.config.ts    router, title strategy, HttpClient, APP_CONFIG
    app.routes.ts    lazy routes
    core/            config (APP_CONFIG), http (toErrorMessage), layout (header, footer, 404), routing (titles)
    shared/ui/       presentational building blocks: error-toast
    features/
      home/          overview page for reviewers
      game/          /play: state/, data-access/, models/, components/
      docs/          docs hub, viewer, catalog, data-access/, markdown/, components/
    testing/         TEST_APP_CONFIG for specs
```

`core/` and `shared/` never import from `features/`. Features are independent, except that the home page reads the docs catalog for its quick links.

**Routing.** [app.routes.ts](../frontend/src/app/app.routes.ts) lazy-loads every page with `loadComponent`: `''` overview, `play`, `docs`, `docs/:slug` and a `**` not-found page. `withComponentInputBinding()` delivers `:slug` as a signal input, `withInMemoryScrolling` handles `#anchor` links, and [PageTitleStrategy](../frontend/src/app/core/routing/page-title.strategy.ts) produces titles such as "Play · Tic Tac Toe".

**Configuration.** Services inject the [`APP_CONFIG`](../frontend/src/app/core/config/app-config.ts) token (`apiBaseUrl`, `swaggerUrl`, `repositoryUrl`). `app.config.ts` provides it from `environment.ts`, which `angular.json` replaces in production builds:

| Build | `apiBaseUrl` |
|---|---|
| `npm start` (development) | `http://localhost:5000/api` (cross-origin; the API allows `http://localhost:4200`) |
| `npm run build` (production) | `/api` (same origin; Vercel proxies it) |

**Game feature.** [GameStore](../frontend/src/app/features/game/state/game.store.ts) is the single place the page reads state from and sends actions to (`init`, `newGame`, `play`, `undo`, `resetGame`, `resetScoreboard`, `selectMode`, `dismissError`). Its writable signals are private; components get read-only views. [GameApiService](../frontend/src/app/features/game/data-access/game-api.service.ts) is a thin `HttpClient` wrapper, one method per endpoint. [GamePageComponent](../frontend/src/app/features/game/game-page.component.ts) binds store signals to the presentational components (board, cell, controls, status bar, move history, scoreboard, toast), which have no services, use signal inputs and outputs, and run with `OnPush` and zoneless change detection. [game.models.ts](../frontend/src/app/features/game/models/game.models.ts) mirrors the JSON contract with string-literal unions.

**Docs portal.** The portal renders the same Markdown files GitHub shows:

```text
 README.md, docs/                    repository
     |  npm start / npm run build  ->  scripts/copy-docs.mjs
     v
 frontend/public/content/            git-ignored copy, published with the site
     |  GET content/docs/API.md
     v
 DocsService                         an HTML answer (SPA fallback) counts as 404
     v
 renderMarkdown()                    marked + GitHub-style heading ids + link rewriting + table of contents
     v
 <article [innerHTML]>               sanitized by Angular; directives set heading ids and route in-app links
```

[docs.catalog.ts](../frontend/src/app/features/docs/docs.catalog.ts) lists every document (slug, title, category, source path) and drives the hub, sidebar and previous/next links. [doc-link-resolver.ts](../frontend/src/app/features/docs/markdown/doc-link-resolver.ts) resolves relative links as GitHub does: catalog documents open in the app, `docs/assets/` files download, and other repository paths open on GitHub.

## Deployment topology

| | URL |
|---|---|
| Review portal (play, docs) | <https://tictactoe-abb.vercel.app> |
| Swagger UI, through the portal | <https://tictactoe-abb.vercel.app/swagger> |
| API on Render (health check) | <https://tictactoe-abb-api.onrender.com/health> |

```text
 Production
 Browser --- https://tictactoe-abb.vercel.app ---> Vercel (vercel.json)
                                                     |  static files, content/*.md; other paths -> index.html
                                                     |  /api/*, /swagger*  -> rewrite
                                                     v
                                                   Render web service (render.yaml, backend/Dockerfile)
                                                   https://tictactoe-abb-api.onrender.com
                                                   one container on $PORT; Render checks GET /health

 Local development
 Browser --- http://localhost:4200 -----> ng serve (npm start)          environment.ts
    +------- http://localhost:5000/api --> dotnet run (TicTacToe.Api)   CORS allows http://localhost:4200
```

- **Vercel** builds `frontend/` (`npm run build` also publishes the docs) and proxies `/api` and `/swagger`, so the browser stays on one origin and production needs no CORS.
- **Render** builds the multi-stage, non-root image from [backend/Dockerfile](../backend/Dockerfile). It deploys only commits whose CI checks passed, and only when `backend/**` changed.
- **In-memory consequences:** a redeploy or restart clears games and the scoreboard. The free instance sleeps after 15 idle minutes, and the next request takes about a minute; the status bar and toast explain the wait, and the store starts a new game when its saved game is gone.

## Scaling path

One API process owns all state, which matches the brief and the single Render instance. Several instances, or a serverless host such as Vercel's, would need shared state. The seams already exist:

| Concern | Today | With shared state (Redis or SQL) |
|---|---|---|
| Game storage | `InMemoryGameRepository` | Another `IGameRepository`: a game stored as its mode, moves and recorded flag, rebuilt by replaying the moves |
| One request per game at a time | `lock (session.SyncRoot)` | Optimistic concurrency: a save succeeds only if the game's version is unchanged |
| Scoreboard | `Scoreboard` with a private lock | `IScoreboardService` over atomic increments, committed together with the game's "result recorded" flag so a result still counts once |
| Idle games | `ExpiredSessionCleanupService` | A key expiry (Redis) or a scheduled delete (SQL) |

The rules, controllers, JSON contract and frontend stay as they are. What changes is `IGameRepository` (it gains a save step, because today a found `GameSession` is the live object), a way to rebuild a session from stored moves, and `GameService.RunLocked`, which becomes load, act, save-if-unchanged. The trade-offs are recorded in [D18](DECISIONS.md#d18-in-memory-storage-behind-igamerepository-and-iscoreboardservice) and [D28](DECISIONS.md#d28-vercel-serves-the-site-and-proxies-the-api-render-runs-the-api-container); current limitations are listed in the [README](../README.md#known-limitations).
