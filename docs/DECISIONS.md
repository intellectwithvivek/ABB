# Design decisions and trade-offs

Every significant decision made while building this project, with the reason for it and the option that was turned down. Each entry has the same four parts:

- **Context**: the problem or constraint.
- **Decision**: what was chosen.
- **Why**: the reasoning.
- **Alternative considered**: what else was possible and why it was not chosen.

Entries are numbered once and never renumbered, so `D14` always means the same decision. D1–D7 were recorded while the project was scaffolded. Later entries are grouped by area. Links to source files open the code on GitHub.

Related documents: [Architecture](ARCHITECTURE.md) shows how the parts fit together, the [API reference](API.md) holds the full contract, and [Testing](TESTING.md) lists what the tests cover.

## Environment & tooling

### D1. The working folder is the repository root
- **Context:** The brief says "you are working inside an empty folder that will become a GitHub repository". Its layout diagram names the root `tictactoe-abb/`.
- **Decision:** The working folder is the repository root. It is published as [intellectwithvivek/ABB](https://github.com/intellectwithvivek/ABB). `README.md`, `backend/`, `frontend/` and `docs/` sit exactly where the layout puts them.
- **Why:** A clone matches the layout the panel expects. Only the top-level folder name differs from the diagram.
- **Alternative considered:** Nesting everything in a `tictactoe-abb/` subfolder. This adds a pointless level to every path and command.

### D2. Angular 21.2 (LTS line) instead of 22.x
- **Context:** Angular 22 was the newest release, but its CLI refuses to run on Node.js below 24.15.0 / 22.22.3. The development machine has Node.js 24.14.0 and Angular CLI 21.2.
- **Decision:** Use Angular 21.2, a supported LTS release.
- **Why:** It has everything the brief needs: standalone components, signals, zoneless change detection and Vitest as the default test runner. It runs on any Node 20.19+, 22.12+ or 24 LTS, including the Node 22 used by CI and the Docker build.
- **Alternative considered:** Upgrading Node.js first so Angular 22 could be used. Nothing in the brief needed it. Moving later takes one command after a Node upgrade: `ng update @angular/core@22 @angular/cli@22`.

### D3. A repo-local `backend/nuget.config`
- **Context:** The development machine had no NuGet package source configured, so `dotnet restore` failed.
- **Decision:** Add [`backend/nuget.config`](../backend/nuget.config). It clears all sources (`<clear/>`) and adds only nuget.org.
- **Why:** Restore behaves the same on every machine, in CI and in Docker, and no user-level configuration is touched.
- **Alternative considered:** Fixing the machine's global NuGet configuration. That works on one machine only and is invisible to reviewers.

### D4. Shared build settings, with warnings treated as errors
- **Context:** The quality bar is "no warnings on `dotnet build`" for three projects.
- **Decision:** Set `Nullable`, `ImplicitUsings` and `TreatWarningsAsErrors` once, in [`backend/Directory.Build.props`](../backend/Directory.Build.props).
- **Why:** MSBuild applies the file to every project below it automatically. Any new warning fails the build, so warnings cannot pile up.
- **Alternative considered:** Repeating the settings in each `.csproj`. The copies drift apart over time.

### D5. Test packages upgraded from the template defaults
- **Context:** The SDK 8 `dotnet new xunit` template pins xunit 2.5.3 and Microsoft.NET.Test.Sdk 17.8.0. These pull in transitive packages with published high-severity advisories (`System.Net.Http` 4.3.0 and `System.Text.RegularExpressions` 4.3.0).
- **Decision:** Upgrade to xunit 2.9.3, xunit.runner.visualstudio 3.1.5, Microsoft.NET.Test.Sdk 17.14.1 and coverlet.collector 6.0.4. The versions now live in `Directory.Packages.props` (D9).
- **Why:** `dotnet list package --vulnerable --include-transitive` is clean.
- **Alternative considered:** Keeping the template versions. A reviewer running the vulnerability scan would see the warnings.

### D6. HTTP only on `http://localhost:5000`
- **Context:** The brief fixes the local backend URL at `http://localhost:5000`.
- **Decision:** [`launchSettings.json`](../backend/TicTacToe.Api/Properties/launchSettings.json) has a single `http` profile on port 5000. `UseHttpsRedirection` is not used.
- **Why:** A local assessment app does not need a development certificate, and the redirect would only add a warning and a second port. When the app is deployed, the hosting platform ends TLS in front of the container (D63).
- **Alternative considered:** The template's HTTPS profile. It needs a trusted dev certificate on every reviewer's machine.

### D7. Explicit `.component` / `.service` suffixes in Angular
- **Context:** Angular CLI 20+ generates `app.ts` / `class App` by default. The brief names `GameApiService`.
- **Decision:** Configure the workspace to keep suffixes (`angular.json` → `schematics` → `type`). Rename the root component to `AppComponent`. Generate new components with `OnPush` change detection by default.
- **Why:** Most reviewers recognise suffixed names such as `BoardComponent` and `GameApiService`, and they match the brief.
- **Alternative considered:** The new suffix-less style. It is valid, but it would mix two naming styles with the brief's own names.

### D8. The .NET SDK is pinned with `global.json`
- **Context:** A machine can have several SDKs installed (8, 9, 10). `dotnet` picks the newest one unless told otherwise.
- **Decision:** [`backend/global.json`](../backend/global.json) asks for SDK `8.0.100` with `rollForward: latestFeature`.
- **Why:** Any .NET 8 SDK is accepted, but a 9 or 10 SDK is never used by accident, which could change analyzers and warnings.
- **Alternative considered:** Pinning an exact patch version. Every reviewer would have to install that exact SDK.

### D9. Central Package Management
- **Context:** Three projects reference NuGet packages, and test and API packages must stay on the same versions.
- **Decision:** [`backend/Directory.Packages.props`](../backend/Directory.Packages.props) sets `ManagePackageVersionsCentrally=true` and holds every version. A `PackageReference` in a `.csproj` names the package only.
- **Why:** Versions are kept in one file, projects cannot drift apart, and Dependabot updates one line.
- **Alternative considered:** A version in every `.csproj`. This is the default, but it gets harder to manage as projects are added.

### D10. Never weaken the machine's security to run tests
- **Context:** Windows Smart App Control on the development machine sometimes blocked `dotnet test` from loading the freshly built, unsigned test DLL (error `0x800711C7`).
- **Decision:** Rebuild and retry instead of turning the protection off. CI on GitHub Actions is the authoritative test run.
- **Why:** Turning off an OS security feature to make a build pass is the wrong habit. Later local runs passed, and CI runs on clean Linux machines.
- **Alternative considered:** Turning Smart App Control off, or moving development into WSL. The first is a security regression. The second was unnecessary once retries worked.

### D11. C# written for a reader who knows Java and TypeScript
- **Context:** The code is defended line by line by a developer who knows Java and TypeScript well but is new to .NET.
- **Decision:**
  - Use classic constructors with `private readonly` fields (no C# 12 primary constructors).
  - Put one type in each file.
  - Write `///` comments only on the main types and on members whose purpose is not obvious.
  - Add short comments where C# differs from Java: extension methods for enum behaviour, `readonly record struct`, `required`/`init`.
- **Why:** Every line reads like Java or TypeScript, with the .NET-specific parts explained where they appear.
- **Alternative considered:** The tersest modern C#: primary constructors, and expression-bodied members everywhere. It is shorter, but harder to explain in a review.

## Domain & game rules

### D12. `GameEngine` holds the rules; `GameSession` holds the product's policy
- **Context:** The brief mixes the rules of Tic Tac Toe (turns, wins, draws) with product choices: game modes, a computer opponent, undo policy and scoring.
- **Decision:** There are two classes:
  - [`GameEngine`](../backend/TicTacToe.Core/Engine/GameEngine.cs) is the mechanism. It applies and validates moves, detects wins and draws, and undoes moves. It knows nothing about modes or scores.
  - [`GameSession`](../backend/TicTacToe.Core/Sessions/GameSession.cs) is the product. It holds the mode, makes the computer reply, applies the Option A undo policy and does the pair undo in VsComputer mode, and records each result once.
- **Why:** Each class has one reason to change and can be tested on its own. For example, `GameEngine.UndoLastMove` has no Option A check, because that is a policy, not a rule.
- **Alternative considered:** One `Game` class. It would be smaller at first, but rule bugs and policy bugs would be tangled together, and it would be harder to test.

### D13. The current player is derived, not stored
- **Context:** Undo, reset and rejected moves must never leave a stale "whose turn" value behind.
- **Decision:** `CurrentPlayer => Moves.Count % 2 == 0 ? X : O`. X always starts, and the turn passes after every valid move.
- **Why:** There is no field to forget to update. Undo restores the correct turn by construction, and a rejected move cannot change it.
- **Alternative considered:** A `_currentPlayer` field toggled on each move and on each undo. Every code path would have to keep it in sync by hand.

### D14. The outcome is recomputed after every change, and a win is checked before a draw
- **Context:** The status must be right after a move, an undo and a reset. A ninth move can complete a line.
- **Decision:** The private `EvaluateOutcome()` runs after every change. It first looks for a completed line in `Board.Lines`. Only if there is none does it check whether the board is full (Draw).
- **Why:** The status is never stale. A last move that completes a line is a win, not a draw (`ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw`).
- **Alternative considered:** Updating the status step by step on each move. Undo would then need its own inverse logic.

### D15. One exception type for broken rules, checked in a fixed order
- **Context:** The backend must reject four kinds of invalid move with a clear message: game over, off the board, wrong player and occupied cell.
- **Decision:** `ApplyMove` checks in this order: game over → off board → wrong player → occupied. It throws [`GameRuleException`](../backend/TicTacToe.Core/Engine/GameRuleException.cs), whose message is written for the player (for example `Cell (row 0, col 0) is already taken by X.`). A rejected move changes nothing.
- **Why:** A fixed order gives one predictable message per request. The message travels unchanged to the UI's toast. Checking "game over" first means a finished game always explains itself.
- **Alternative considered:** Returning a result object (`MoveResult.Invalid(reason)`). This is also valid, but every caller must check it. An exception maps naturally to HTTP 400 in one place (D30).

### D16. Board mutators are `internal`; tests reach them with `InternalsVisibleTo`
- **Context:** The API must be able to read the board, but must never change it without going through the engine. Tests need to set up arbitrary positions.
- **Decision:** `Board.Place`, `Clear` and `ClearAll` are `internal`. [`TicTacToe.Core.csproj`](../backend/TicTacToe.Core/TicTacToe.Core.csproj) declares `<InternalsVisibleTo Include="TicTacToe.Tests" />`.
- **Why:** The board and the move history cannot get out of sync. Tests can still build a position such as `TestBoards.Parse("XO.", ".X.", "..O")` directly, without replaying moves.
- **Alternative considered:** Public mutators, which would let any layer corrupt the game. Or tests that replay move sequences only, which would be verbose for the computer-opponent cases.

### D17. `currentPlayer` keeps its derived value after the game ends
- **Context:** After X wins on move 5, the derived turn is O, even though nobody can move.
- **Decision:** Keep the derived value (D13) in the response. The frontend shows the result, not the turn, once `status` is not `InProgress`.
- **Why:** Adding a special case (for example `null` after the end) would break the single derivation rule and change the frozen contract's type. `status` already tells the client that the game is over.
- **Alternative considered:** Returning `currentPlayer: null` for finished games. It is slightly more explicit, but it complicates both the model and the contract.

### D18. A deterministic, rule-based computer opponent
- **Context:** The brief gives a five-step priority: win, block, centre, corner, any cell.
- **Decision:** [`ComputerPlayer.ChooseMove`](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs) is a `??` chain that follows exactly that order. Lines are scanned in `Board.Lines` order, corners in the order (0,0), (0,2), (2,0), (2,2), and free cells row by row. The helpers return `Position?`, because `FirstOrDefault` on a struct would return `(0,0)`, a real cell, when nothing matches.
- **Why:** The same board always gives the same move. Each rule has its own test, and a reviewer can predict every move.
- **Alternative considered:** Random tie-breaking, which makes tests flaky, or minimax, which is unbeatable but not what the brief asks for. Minimax is listed as a future improvement.

### D19. The computer moves inside the same `POST /moves` request
- **Context:** In VsComputer mode the computer must reply automatically after the human's move, and must never move after the game has ended.
- **Decision:** `GameSession.PlayMove` applies the human's move. If the mode is VsComputer and the game is still in progress, it applies the computer's move in the same call. The response already contains both moves.
- **Why:** There is one round trip and the server never sits in a "waiting for the computer" state. The frontend has no extra logic, and the human cannot act between the two moves. In VsComputer mode it is always X's turn between requests, so a move sent as O is rejected by the normal wrong-player check.
- **Alternative considered:** A separate `POST /computer-move` endpoint called by the frontend. That needs an extra request and a client-side rule, and a race is possible between the two calls.

### D20. Option A: undo is disabled once a game is won or drawn
- **Context:** The brief asks for a choice between Option A (no undo after completion) and Option B (undo after completion, with the scoreboard adjusted).
- **Decision:** Option A. `GameSession.Undo` throws `Undo is not available after the game has ended. Reset the game to play again.` when the status is not `InProgress`, and `canUndo` is `false`.
- **Why:** A result is final once it is on the scoreboard, so the scoreboard never has to be decremented and "counted exactly once" (D22) stays easy to reason about.
- **Alternative considered:** Option B. The session would have to remember exactly what it recorded and reverse it, and a scoreboard reset between the win and the undo would make the reversal ambiguous.

### D21. In VsComputer mode, undo removes the human's move and the computer's reply together
- **Context:** The brief says: "X plays, O computer plays, Undo → both removed, it is X's turn".
- **Decision:** After undoing one move, `GameSession.Undo` undoes one more if it is now the computer's turn. It uses an `if`, not a loop.
- **Why:** After any request in VsComputer mode, the number of moves is even (the computer always replies unless the game ended, and a finished game cannot be undone). So one extra undo always gives the turn back to X.
- **Alternative considered:** A loop until it is X's turn. It does the same thing but hides that at most two moves are removed.

### D22. An explicit "already recorded" flag counts each game exactly once
- **Context:** The scoreboard must update once per finished game, and not again after a rejected move, a rejected undo or a reset.
- **Decision:** `GameSession` keeps a private `_resultRecorded` flag. `RecordResultIfFinished()` records the result only if the game is finished and the flag is not set. `Reset()` clears the flag.
- **Why:** A finished game already rejects moves and undo, so double counting is impossible in practice. But the scoreboard rule should not depend on that indirectly: the flag states the rule in the code itself.
- **Alternative considered:** Relying only on the structural guarantee. It is correct today, but a later change (for example Option B) could silently break it.

### D23. Reset keeps the game id and mode; the scoreboard lives as long as the server
- **Context:** The brief says that Reset Game "starts a fresh game session" and keeps the scoreboard. It also says the scoreboard is "session-level".
- **Decision:** `POST /api/games/{id}/reset` clears the board, the history and the result, gives the turn to X, and keeps the same id and mode. The scoreboard is one server-wide instance shared by every game, and lives as long as the server process. "New Game" (`POST /api/games`) is how a player changes mode.
- **Why:** A stable id keeps the client simple (the URL and the saved id stay valid). The scoreboard is "served by the backend", as the brief asks, without needing user accounts.
- **Alternative considered:** A new id on every reset, which makes the client track a moving id for no benefit. Or one scoreboard per browser, which needs an identity concept the brief does not have.

## API

### D24. Controllers with `[ApiController]`, not minimal APIs
- **Context:** .NET 8 offers both MVC controllers and minimal APIs.
- **Decision:** Two controllers: [`GamesController`](../backend/TicTacToe.Api/Controllers/GamesController.cs) and [`ScoreboardController`](../backend/TicTacToe.Api/Controllers/ScoreboardController.cs). Each action is one line that calls the application layer. Routes use the `{id:guid}` constraint, so an id that is not a GUID never reaches an action (404).
- **Why:** Controllers look like Spring `@RestController` classes and are familiar to the reviewer. `[ApiController]` adds automatic 400 responses for malformed bodies, and `[ProducesResponseType]` documents every status code in Swagger.
- **Alternative considered:** Minimal APIs. They are shorter for seven endpoints, but validation and response documentation must be wired by hand, and the style is less familiar to a Java reader.

### D25. Every game endpoint returns the full game state, including `canUndo`
- **Context:** The brief makes the backend the single source of truth. The frontend must not re-implement rules.
- **Decision:** Every game endpoint returns the complete `GameStateResponse`: the board, the turn, the status, the winner, the winning cells, the history, the scoreboard and `canUndo`. The server computes `canUndo` as "in progress and at least one move".
- **Why:** The client renders exactly what it receives. Undo's enabled state, the turn and the result are never computed in Angular, so the two sides cannot disagree. The payload is under 1 kB.
- **Alternative considered:** Returning only the changed parts (deltas). This saves bytes nobody needs to save, and makes the client merge state and compute rules.

### D26. `201 Created` with a `Location` header for a new game
- **Context:** `POST /api/games` creates a resource.
- **Decision:** Return `CreatedAtAction(nameof(GetGame), …)`. The response is 201 with the game state in the body and an absolute `Location` that points to `GET /api/games/{id}`. Every other success is 200 with a body.
- **Why:** This is correct HTTP. The URL is generated from the route, so it is never hard-coded.
- **Alternative considered:** Returning 200 for everything. It is simpler, but it breaks REST conventions that a reviewer may check.

### D27. Request DTOs use `required` members, not `[Range]`
- **Context:** A body with a missing field must be rejected. Without that, a missing `"col"` would silently become column 0.
- **Decision:** [`CreateGameRequest`](../backend/TicTacToe.Api/Contracts/Requests/CreateGameRequest.cs) and [`SubmitMoveRequest`](../backend/TicTacToe.Api/Contracts/Requests/SubmitMoveRequest.cs) are records with `required` `init` properties. System.Text.Json in .NET 8 rejects a body that lacks one, and `[ApiController]` answers 400. There is deliberately no `[Range(0, 2)]` on `Row` or `Col`.
- **Why:** The board-range rule lives in Core (D15), so there is one source of truth and one error message ("Row and column must be between 0 and 2 …").
- **Alternative considered:** `[Range]` attributes. They would duplicate the rule in a second layer, with a second, differently worded message.

### D28. Enums travel as strings, and integers are rejected
- **Context:** The contract uses `"X"`, `"VsComputer"` and `"InProgress"`. By default, .NET writes enums as numbers.
- **Decision:** Register `JsonStringEnumConverter(allowIntegerValues: false)` in [`ServiceCollectionExtensions`](../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs).
- **Why:** The JSON can be read on its own and matches the TypeScript union types. Rejecting numbers means `"player": 1` is a 400 and cannot quietly select a value. Names are read case-insensitively; responses always use the canonical casing.
- **Alternative considered:** Numeric enums, which are unreadable and fragile if the enum order changes. Or accepting both, which lets a typo pass.

### D29. `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes`
- **Context:** With nullable reference types enabled, MVC treats every non-nullable parameter as implicitly `[Required]`. When a body fails to parse, it adds a second, vague `"The request field is required."` entry, which could come first in `errors`. The frontend shows the first entry.
- **Decision:** Set `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true` in `AddControllers`.
- **Why:** Each malformed body produces exactly one error entry, which names the cause (`$.mode`, `$.col`). Tests pin this behaviour (`SubmitMove_PlayerNotXOrO_Returns400WithSingleErrorForPlayer`). Empty bodies are still rejected.
- **Alternative considered:** Making the frontend skip the vague entry. That would leak a server quirk into the client.

### D30. Exceptions become ProblemDetails through `IExceptionHandler`
- **Context:** Broken rules must return 400 and unknown ids must return 404, both with a clear message, and controllers should not be full of `try`/`catch`.
- **Decision:** [`GameExceptionHandler`](../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs) implements .NET 8's `IExceptionHandler`:
  - `GameRuleException` becomes 400 with the title `Invalid move`.
  - `GameNotFoundException` becomes 404 with the title `Game not found`.
  - The exception message becomes the `detail`, written as RFC 7807 `application/problem+json` through `IProblemDetailsService`.
  - Any other exception is logged and falls through to the framework's default 500 ProblemDetails, without internal details.
- **Why:** This is the framework's single place for mapping exceptions to responses. Controller actions describe only the success path. Every error, including validation errors and 429, has the same shape, so the frontend needs a single parser. There is deliberately no `[Produces("application/json")]`, because it would turn `problem+json` responses into plain JSON.
- **Alternative considered:** `try`/`catch` in every action, or a custom middleware. Both work, but they repeat code or reinvent what .NET 8 provides.

### D31. The exception middleware's "unhandled exception" log is filtered
- **Context:** In .NET 8, `ExceptionHandlerMiddleware` logs every exception as `fail: An unhandled exception has occurred`, with a stack trace, before `IExceptionHandler` runs. Every expected 400 or 404 looked like a server crash in the logs.
- **Decision:** Filter the category `Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware` to `LogLevel.None`. `GameExceptionHandler` logs, at Error level, any exception it does not map.
- **Why:** The logs show real failures only. A truly unexpected exception is still logged exactly once.
- **Alternative considered:** Leaving the noise, which hides real errors among expected ones. Or returning error results instead of throwing (see D15).

### D32. Response DTOs are separate from Core types
- **Context:** The JSON contract is frozen, but Core types may evolve.
- **Decision:** Positional records in `Contracts/Responses/` are filled by the static [`ResponseMapper`](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs). The property order follows the contract.
- **Why:** Renaming a Core member cannot silently change the API. Core also stays free of serialization concerns.
- **Alternative considered:** Serializing `GameSession` directly. It needs less code, but it couples the wire format to the domain model and exposes internals.

### D33. CORS origins come from configuration
- **Context:** The frontend runs on a different origin: `http://localhost:4200` locally, and GitHub Pages when deployed.
- **Decision:** `Cors:AllowedOrigins` in `appsettings.json` is bound to [`FrontendCorsOptions`](../backend/TicTacToe.Api/Configuration/FrontendCorsOptions.cs) (`[MinLength(1)]`). A deployment overrides it with environment variables such as `Cors__AllowedOrigins__0=https://intellectwithvivek.github.io`. Any header and any method are allowed for the listed origins only.
- **Why:** A new deployment needs no code change, and an empty list stops startup instead of silently blocking every browser call.
- **Alternative considered:** `AllowAnyOrigin()`, which is too open for a public API. Or hard-coded origins, which need a rebuild for every host.

### D34. Typed settings, validated at startup
- **Context:** The API now has settings for CORS, Swagger, rate limiting and session expiry.
- **Decision:** Each section is bound to a class in `Configuration/` with `.ValidateDataAnnotations().ValidateOnStart()`. The class names avoid framework names: `GameSessionOptions` rather than `SessionOptions`, and `ApiDocumentationOptions` rather than `SwaggerOptions`.
- **Why:** A bad value, such as a zero cleanup interval, stops startup with a message that names the setting (`Startup_ZeroCleanupInterval_FailsWithValidationError`), instead of failing hours later.
- **Alternative considered:** Reading `IConfiguration["…"]` strings where they are needed. This has no types and no validation, and it fails late.

### D35. Swagger is served in every environment
- **Context:** Reviewers should be able to explore the deployed API, not only a local one.
- **Decision:** Swagger UI (`/swagger`) is on when `Swagger:Enabled` is true, which is the default. Setting `Swagger__Enabled=false` turns it off.
- **Why:** A deployed demo explains its own API. The switch keeps it easy to hide in a real production setting.
- **Alternative considered:** Swagger in Development only, which is the template default. A reviewer of the hosted demo would then see no API docs.

### D36. A `/health` endpoint, exempt from rate limiting
- **Context:** Render, DigitalOcean and Docker check whether the app is alive.
- **Decision:** `AddHealthChecks()` with `MapHealthChecks("/health").DisableRateLimiting()`, which returns plain text `Healthy`.
- **Why:** This uses the platform's standard liveness probe. A client that floods the API can never make the platform think the app is down and restart it.
- **Alternative considered:** Pointing the health check at a game endpoint. That has side effects and is subject to rate limiting.

### D37. ASP.NET Core's built-in rate limiter, per client IP
- **Context:** The API is deployed as a public demo with in-memory state.
- **Decision:** `AddRateLimiter` sets a global fixed window per client IP address: 300 requests per 60 seconds, configurable under `RateLimiting:*`. When a client is over the limit, the API returns 429 problem+json with `Retry-After` ([`RateLimitRejectionHandler`](../backend/TicTacToe.Api/ErrorHandling/RateLimitRejectionHandler.cs)). CORS runs before the limiter, so the browser can still read a 429. The container sets `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`, so behind a proxy the limit uses the real client IP.
- **Why:** This is built into .NET 8, so no package is needed. The limit is generous enough that normal play never reaches it, and the 429 response looks like every other error.
- **Alternative considered:** No limit, which leaves the demo easy to abuse. Or a third-party package, which adds a dependency for something the framework already does.

### D38. A short `Program.cs`; the setup lives in extension methods
- **Context:** The service registrations and the middleware pipeline grew with health checks, rate limiting, options and a background service.
- **Decision:** `Program.cs` calls `AddTicTacToeApi(configuration)` and `UseTicTacToeApi()`. These are defined in [`Extensions/`](../backend/TicTacToe.Api/Extensions/), with one private method per concern and a comment on the order of each middleware. It ends with `public partial class Program;`, so `WebApplicationFactory<Program>` can start the app in tests.
- **Why:** Program.cs gives the overview, and each setup step can be read and reviewed on its own.
- **Alternative considered:** Everything inline in `Program.cs`, which is the template style. It is fine for a demo, but it becomes a 150-line file of mixed concerns.

## Concurrency & state

### D39. In-memory storage behind a repository interface
- **Context:** The brief allows in-memory storage or SQLite.
- **Decision:** [`InMemoryGameRepository`](../backend/TicTacToe.Api/Infrastructure/Persistence/InMemoryGameRepository.cs) is a `ConcurrentDictionary<Guid, …>` behind [`IGameRepository`](../backend/TicTacToe.Api/Application/IGameRepository.cs). The interface lives in the application layer, as a "port": `GameService` defines what it needs from storage. `IScoreboardService` likewise sits in front of the in-memory `Scoreboard`. `GameService` itself has no interface, because it has only one implementation.
- **Why:** Nothing needs a database to meet the brief. The interfaces mark exactly where a database could be added later, and no layer has an interface it does not need.
- **Alternative considered:** SQLite with EF Core. It survives restarts, but adds migrations, a file and a dependency for no requirement. An interface on every class would be ceremony with nothing behind it.

### D40. DI lifetimes match where the state lives
- **Context:** ASP.NET Core creates services as singleton, scoped (one per request) or transient.
- **Decision:**
  - `IGameRepository`, `IScoreboardService` and `TimeProvider.System` are **singletons**, because they hold or provide the server's shared state.
  - `GameService` is **scoped**, because it is stateless and works on the singletons.
  - `ExpiredSessionCleanupService` is a hosted service.
- **Why:** State that must be shared lives in exactly one instance, and nothing that is created per request holds data.
- **Alternative considered:** A singleton `GameService`. It would also work, since it is stateless, but scoped is the conventional default for request-handling services and is safe if a scoped dependency is added later.

### D41. A lock per game, with the response mapped inside the lock
- **Context:** Requests run in parallel. A double click can send two moves for the same game at once, and `GameSession` is not thread-safe.
- **Decision:** `GameService.RunLocked` finds the session, then runs `lock (session.SyncRoot)`, applies the action and maps the response inside the lock. `GetGame` takes the lock too. `CreateGame` maps the new game before adding it to the repository, so no lock is needed there.
- **Why:**
  - Requests for one game run one at a time, while different games still run in parallel.
  - Mapping inside the lock makes the response a consistent snapshot of what this action produced.
  - A read never sees a half-finished computer-mode request (the human's move applied, the computer's reply not yet).
  - This is proven by `SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds`.
- **Alternative considered:** One global lock, which serialises every game on the server. Or making `GameSession` itself thread-safe, which mixes concurrency into domain code that is otherwise pure.

### D42. The scoreboard has its own private lock
- **Context:** One scoreboard is shared by every game, and different games run in parallel.
- **Decision:** [`Scoreboard`](../backend/TicTacToe.Core/Scoring/Scoreboard.cs) guards its three counters with one private `readonly object _lock`. `GetScores()` returns an immutable `ScoreSnapshot`.
- **Why:** The counters are always read consistently, and no outside code can take the same lock (it is never `this`). A test runs 30,000 parallel updates to prove it.
- **Alternative considered:** `Interlocked` per counter. It is lock-free, but a reader could see X's count from before an update and O's from after it.

### D43. Idle games expire, tracked by the repository
- **Context:** A public deployment that keeps every game ever started would grow its memory without limit.
- **Decision:**
  - The repository records the time each game was last used. Both `Add` and `Find` update it, and the entry is swapped atomically with `TryUpdate`.
  - [`ExpiredSessionCleanupService`](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs) is a `BackgroundService` with a `PeriodicTimer`. Every `Sessions:CleanupInterval` (10 minutes) it removes the games that have been idle longer than `Sessions:IdleTimeout` (2 hours).
  - Time comes from .NET 8's `TimeProvider`.
- **Why:** Core stays free of clocks and infrastructure. Any request counts as activity, so a game in progress is never removed. With `FakeTimeProvider`, a test moves through hours of idle time in milliseconds.
- **Alternative considered:** A `LastActivity` property on `GameSession`, updated from an injected clock. This puts a hosting concern into the domain. Or no expiry at all, which is acceptable locally but not for a public demo.

## Frontend

### D44. Modern Angular only: standalone, zoneless, signals, OnPush
- **Context:** Angular 21 defaults to standalone components, and to zoneless change detection.
- **Decision:**
  - No NgModules and no zone.js.
  - Dependencies come from `inject()`.
  - Components use signal `input()`/`output()`, `@if`/`@for` control flow and `OnPush` everywhere.
- **Why:** This is current, idiomatic Angular with the least boilerplate. Signals make data flow explicit, and the concepts map closely to React props and state.
- **Alternative considered:** NgModules with `@Input()` decorators and zone.js. It still works, but it is legacy style that a reviewer would question.

### D45. A signals-based store holds the server snapshot plus UI state only
- **Context:** The backend is the source of truth. The UI still needs loading, error and selected-mode state.
- **Decision:**
  - [`GameStore`](../frontend/src/app/features/game/state/game.store.ts) keeps `game`, the last `GameState` the backend returned, and never edits it locally.
  - It also keeps three UI signals: `selectedMode`, `loading` and `errorMessage`.
  - Derived values (`canPlay`, `canUndo`, `board`, `moves`) are `computed()`.
  - The writable signals are private, and components get read-only views and call methods.
- **Why:** There is one place to read state and one place to send actions, and no game rule exists in TypeScript. `play()` sends the `currentPlayer` the backend reported. There is no `isGameOver` signal because nothing would use it.
- **Alternative considered:** NgRx, which is heavy for one screen of state. Or components that call `HttpClient` directly, which scatters state and error handling.

### D46. One request at a time
- **Context:** A double click must not submit the same action twice.
- **Decision:** The store's private `run()` ignores any action while `loading` is true. It sets `loading`, clears the error, and on success stores the snapshot. On error it sets `errorMessage`. The board and the buttons are disabled while loading.
- **Why:** Duplicate submissions are blocked on the client, and the server lock (D41) protects against anything that still gets through.
- **Alternative considered:** RxJS `exhaustMap` per action stream. It does the same thing, but is harder to read for someone new to RxJS.

### D47. A page refresh resumes the game through `sessionStorage`
- **Context:** Refreshing the page should not throw the current game away.
- **Decision:** The game id is stored under `tictactoe.gameId` in `sessionStorage`. `init()` loads that game. If loading fails for any reason (for example a server restart or an expired game), it creates a new game. The mode picker follows the resumed game's mode.
- **Why:** A refresh keeps the game, and each browser tab has its own game. A stale id recovers by itself.
- **Alternative considered:** `localStorage`, where every tab would fight over one game. Or putting the id in the URL (`/play/:id`). That is shareable, but sharing a game is not a requirement.

### D48. A mode change applies when a new game starts
- **Context:** The brief needs a mode selector, but changing the mode in the middle of a game has no clear meaning.
- **Decision:** The selector changes only `selectedMode`. "New Game" creates a game in that mode. While the selection differs from the active game's mode, a hint reads "Mode applies when you start a new game."
- **Why:** The game in progress never changes under the player, and the active mode is always visible.
- **Alternative considered:** Restarting immediately when the mode changes, which can lose a game to a misclick. Or changing the mode of the running game, which the backend does not allow (the mode is fixed per session).

### D49. 1-based positions for people, 0-based in the API
- **Context:** The brief's history example says "Row 1, Column 1". Arrays and the API are 0-based.
- **Decision:** The API, the models and the store use 0-based `row` and `col`. Only the view adds 1: the move-history table and the cells' `aria-label`s.
- **Why:** There is one coordinate system in code and data, and human-friendly text in the UI. The conversion is in two template expressions, each with a comment.
- **Alternative considered:** A 1-based API, which mismatches arrays and invites off-by-one errors in the rules.

### D50. Errors appear in a non-blocking toast
- **Context:** Invalid moves and network failures need a visible message that does not get in the way.
- **Decision:**
  - [`toErrorMessage`](../frontend/src/app/core/http/api-error.ts) picks the ProblemDetails `detail`, then the first validation `errors` entry, then `title`, then a generic message.
  - Status 0 (no response at all) becomes "Cannot reach the game server at … Is the backend running?".
  - The [`ErrorToastComponent`](../frontend/src/app/shared/ui/error-toast/error-toast.component.ts) uses `role="alert"`, can be dismissed, and closes itself after 5 seconds.
- **Why:** The message the server wrote reaches the player unchanged, the board stays usable, and the most common local mistake (backend not running) explains itself.
- **Alternative considered:** `alert()` dialogs, which block the page. Or inline form errors, which do not fit a game board.

### D51. Configuration through an `APP_CONFIG` injection token, with one environment file per target
- **Context:** The API URL differs per deployment: `http://localhost:5000/api` locally, `/api` behind a same-origin proxy, and an absolute Render URL on GitHub Pages.
- **Decision:**
  - [`app-config.ts`](../frontend/src/app/core/config/app-config.ts) defines `AppConfig` and the `APP_CONFIG` token. `app.config.ts` is the only file that imports `environment`.
  - `angular.json` swaps the file per build configuration: `environment.production.ts` for `production`, and `environment.github-pages.ts` for `github-pages`.
  - Services inject the token.
- **Why:** No URL is hard-coded in a service, and tests provide their own config. Adding a host means adding one file and one build configuration.
- **Alternative considered:** Importing `environment` in every service, which is harder to test. Or a runtime `config.json` fetched at startup. That is more flexible, but adds a request and a loading state for little gain.

### D52. Lazy routes, route titles and component input binding
- **Context:** The app has four pages, and the docs viewer needs `marked`.
- **Decision:**
  - Every route uses `loadComponent`, so each page is its own chunk and `marked` loads only with the docs pages.
  - A custom [`PageTitleStrategy`](../frontend/src/app/core/routing/page-title.strategy.ts) turns `title: 'Play'` into "Play · Tic Tac Toe".
  - `withComponentInputBinding()` delivers `:slug` as a signal input.
  - `withInMemoryScrolling` handles `#anchor` links.
- **Why:** The initial download stays small, browser tabs are readable, and components need no `ActivatedRoute` plumbing.
- **Alternative considered:** Loading every page up front. It is simpler, but it puts the markdown parser in the first download.

### D53. No UI library
- **Context:** The brief asks for a clean, intentional UI and does not require a component library.
- **Decision:** Plain CSS with custom properties in `styles.css`. Shared classes (`.panel`, `.button`) are global, and each component stylesheet stays under the 4 kB production budget. Buttons and cells have visible hover, focus and disabled states, and `prefers-reduced-motion` is respected.
- **Why:** There are no extra dependencies or theme overrides, every style can be explained, and the bundle stays small.
- **Alternative considered:** Angular Material. It looks polished, but it is heavy and opinionated for a nine-cell board.

## Testing

### D54. Backend: xUnit, plain `Assert`, one clearly named test per required case
- **Context:** The brief lists the minimum cases. The panel will look for each one.
- **Decision:**
  - xUnit with plain `Assert`, and no FluentAssertions or Moq: real objects are cheap here.
  - Tests are named `Method_Scenario_ExpectedOutcome`, for example `Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`.
  - The test folders mirror the Core and API folders.
  - [`TestSupport/`](../backend/TicTacToe.Tests/TestSupport/) holds `TestBoards.Parse("XO.", …)` and move-sequence helpers.
- **Why:** Each requirement maps to a test whose name can be found with a search, and boards are readable at a glance.
- **Alternative considered:** Fewer large tests that cover several cases each. These are harder to map to the brief and harder to diagnose when they fail.

### D55. API tests run the real app in memory
- **Context:** Status codes, JSON shape, CORS and error bodies can only be tested through HTTP.
- **Decision:** Use `WebApplicationFactory<Program>` from `Microsoft.AspNetCore.Mvc.Testing` (see the `Api/Integration/` tests). Settings are overridden per test with `UseSetting` (for example a permit limit of 3 for the rate-limit test). Concurrency is tested at the service level with `Task.WhenAll`.
- **Why:** The real pipeline runs, including JSON options, the exception handler, CORS, the rate limiter and health checks, but no port or server process is needed.
- **Alternative considered:** Calling controllers directly. That skips everything that makes an API correct on the wire.

### D56. Time-dependent code is tested with `FakeTimeProvider`
- **Context:** Session expiry depends on hours passing.
- **Decision:** Production code takes `TimeProvider`. Tests pass `FakeTimeProvider` from `Microsoft.Extensions.TimeProvider.Testing` and call `Advance(...)`.
- **Why:** The tests are fast and deterministic, with no `Thread.Sleep`.
- **Alternative considered:** Very short real timeouts in tests. These are slow and flaky.

### D57. Frontend: Vitest, the Angular 21 default
- **Context:** Angular 21's unit-test builder (`@angular/build:unit-test`) uses Vitest with jsdom. Karma is deprecated.
- **Decision:** Run Vitest through `ng test`, with `npm run test:ci` for a single run. There are component tests for the board, cells, controls, status bar, history, scoreboard, toast and docs pages, plus tests for the store, the API service, the error mapping and the markdown renderer.
- **Why:** This is the default the CLI generates, it is fast, and its API (`describe`, `it`, `vi.fn`) is familiar to anyone who has used Jest.
- **Alternative considered:** Karma and Jasmine. That stack is deprecated and needs a real browser.

### D58. `provideHttpClientTesting()` instead of `HttpClientTestingModule`
- **Context:** The specification asked for `HttpClientTestingModule`, which is deprecated in current Angular.
- **Decision:** Use `provideHttpClient()`, `provideHttpClientTesting()` and `HttpTestingController` (in [`game-api.service.spec.ts`](../frontend/src/app/features/game/data-access/game-api.service.spec.ts)).
- **Why:** This is the modern, non-deprecated replacement, with the same controller and assertions. It fits the standalone, provider-based setup.
- **Alternative considered:** Following the specification to the letter. It still works, but the API is marked deprecated, and it would bring an NgModule into a codebase that has none.

### D59. Tests are shown to fail when the code is wrong
- **Context:** Green tests prove little if they would also pass against broken code.
- **Decision:** The frontend tests were mutation-checked by hand: the code was broken in four places, one at a time, and each break failed exactly the intended test. Examples of the breaks: hard-coding player X in `play()`, removing the winning-cell class, removing the loading guard, changing the toast timeout. Core rules were also checked against an independent re-implementation of the expected values.
- **Why:** This gives confidence that the assertions really guard the behaviour they are named after.
- **Alternative considered:** Relying on coverage percentages. Coverage shows that code ran, not that it was checked.

## Repository, CI & deployment

### D60. Enterprise layering inside the brief's projects
- **Context:** The brief fixes `backend/TicTacToe.Api`, `TicTacToe.Core`, `TicTacToe.Tests` and `frontend/`. The project should still read like a well-organised enterprise codebase.
- **Decision:** Keep the projects exactly where the brief puts them, and organise the folders inside them. Namespaces follow folders.
  - **Core:** `Domain/`, `Engine/`, `Opponents/`, `Sessions/`, `Scoring/`.
  - **API:** `Controllers/`, `Contracts/Requests|Responses/`, `Mapping/`, `Application/`, `Infrastructure/Persistence|Maintenance/`, `ErrorHandling/`, `Configuration/`, `Extensions/`.
  - **Tests:** mirror the Core and API folders, plus `TestSupport/`.
  - **Frontend:** `core/` (config, http, layout, routing), `shared/ui/`, and `features/<feature>/` (`home`, `game`, `docs`), each with the subfolders it needs: `components/`, `data-access/`, `state/`, `models/`.
- **Why:** The panel finds the brief's layout immediately, and each folder answers "where does X go?". Dependencies point inward: the API depends on Core, and Core depends on nothing.
- **Alternative considered:** Splitting into more projects (`Domain`, `Application`, `Infrastructure`). That is clean architecture by the book, but it would depart from the brief's layout and add projects with one file each.

### D61. CI on GitHub Actions, with Dependabot and one `.editorconfig`
- **Context:** Every change should be checked the same way, on a clean machine, and the dependencies should not quietly go stale.
- **Decision:**
  - [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request to `main`, with three jobs:
    - **backend:** installs the SDK that `global.json` selects, then restores, builds and tests in Release.
    - **frontend:** Node 22, `npm ci`, `npm run build`, `npm run test:ci` and `npm run format:check`.
    - **docker:** after the other two jobs pass, validates `docker-compose.yml` and builds both images without pushing them.
  - [`.github/dependabot.yml`](../.github/dependabot.yml) opens weekly update PRs for NuGet, npm and GitHub Actions. Angular packages are grouped together. New Angular and ASP.NET Core major versions are ignored, because those are deliberate upgrades (`ng update`, a new .NET version), not routine bumps.
  - A [pull request template](../.github/pull_request_template.md) repeats the checks.
  - One root [`.editorconfig`](../.editorconfig) defines the rules for every editor and for both formatters. C# naming and style rules are suggestions, because the compiler's warnings are already errors.
- **Why:** "Works on my machine" is replaced by a reproducible check. The Docker images cannot be built on the development machine, so CI verifies them. Render deploys only commits whose checks passed (D62).
- **Alternative considered:** Local checks only, which depend on discipline and on one machine's state.

### D62. Deployment targets: GitHub Pages + Render recommended, three alternatives supported
- **Context:** The project should be reviewable online on free hosting. GitHub can host static files but cannot run a .NET API.
- **Decision:** There are four documented targets. See [Deployment](DEPLOYMENT.md).
  1. **GitHub Pages for the frontend, Render's free web service for the API.** Recommended: everything deploys from this GitHub repository.
  2. **Vercel** for the frontend, which rewrites `/api` and `/swagger` to the API on Render.
  3. **DigitalOcean App Platform**, with the static site and the API in one app on one origin.
  4. **Docker Compose** on any machine: nginx serves the app and proxies `/api` to the API container.

  The Render Blueprint ([`render.yaml`](../render.yaml)) deploys only after CI passes (`autoDeployTrigger: checksPass`), and only when `backend/**` changes (`buildFilter`), so editing the docs does not restart the API and wipe its in-memory games. On DigitalOcean the API runs as exactly one instance, because a second process would not know the first one's games.
- **Why:** Option 1 costs nothing and needs only GitHub plus a Render account. On the same-origin options (2–4), the browser needs no CORS at all. GitHub Pages is cross-origin, so CORS is configured there (D33).
- **Alternative considered:** One target only. Reviewers and future hosts differ, and the Docker images make every option cheap to support.

### D63. Container images: multi-stage, non-root, and listening on the platform's port
- **Context:** Render, DigitalOcean and Docker hosts all run containers, and each chooses the port in its own way.
- **Decision:**
  - [`backend/Dockerfile`](../backend/Dockerfile) is multi-stage. The `sdk:8.0` image restores (in a cached layer), publishes in Release, then copies the output to `aspnet:8.0`.
  - The API runs as the image's non-root user, listens on `${PORT:-8080}`, and trusts `X-Forwarded-*` headers from the platform proxy.
  - The build context leaves out `TicTacToe.Tests`.
  - [`frontend/Dockerfile`](../frontend/Dockerfile) builds with `node:22-alpine` from the repository root, because the portal needs `../docs`, and serves the result with `nginx:alpine`.
- **Why:** The images are small, contain no SDK or source, follow least privilege, and the same image runs on every platform.
- **Alternative considered:** A single-stage SDK image, which is several times larger and ships the compiler. Or a fixed port, which breaks on Render.

### D64. GitHub Pages: a sub-path base href, a 404.html copy and an overridable API URL
- **Context:** A project site is served from `https://intellectwithvivek.github.io/ABB/`, Pages has no SPA fallback, and the API URL may change.
- **Decision:**
  - The `github-pages` build configuration sets `baseHref: "/ABB/"`.
  - The workflow copies `index.html` to `404.html`, so deep links such as `/ABB/docs/api` load the app.
  - The repository variable `API_BASE_URL`, when set, regenerates `environment.github-pages.ts` at build time.
  - All content URLs are relative (`content/docs/API.md`), so they work under any base href.
- **Why:** Deep links and refreshes work on a static host, and a different Render URL needs no code change.
- **Alternative considered:** Hash routing (`/#/docs/api`). It works without `404.html`, but the URLs are uglier and in-page `#anchors` clash with it.

### D65. Commits are authored under the candidate's identity, and AI use is disclosed in writing
- **Context:** The candidate asked that every commit carry their name, without an AI co-author trailer. The brief also expects open disclosure of AI use.
- **Decision:** Commits are authored as *Vivek Kumar Singh*, using the GitHub no-reply address, because the personal address is private. Commit messages follow Conventional Commits (`chore: scaffold backend, frontend and docs`). How AI was used, which prompts were given and what was reviewed by hand is documented in [AI workflow](AI_WORKFLOW.md) and [the specification prompt](SPEC_PROMPT.md).
- **Why:** The history shows who is accountable for the code, and the AI disclosure is complete and in one place, rather than spread across commit trailers.
- **Alternative considered:** `Co-Authored-By` trailers on each commit. The candidate rejected these, and they say less than a written workflow document.

## Documentation & review portal

### D66. The frontend is also a review portal
- **Context:** Interviewers should be able to play the game and read every project document without cloning anything.
- **Decision:** The app has a shell with a header (Overview, Play, Docs, API ↗, GitHub ↗) and a footer. It has four pages:
  - an overview page, with "how to review" steps, feature cards mapped to the brief and an architecture diagram;
  - `/play`, the game;
  - `/docs`, a hub with document cards by category;
  - `/docs/:slug`, the viewer, with a sidebar, rendered Markdown, an "On this page" list, previous/next links and "View source on GitHub".
- **Why:** One link gives a reviewer the running app, the documentation, the API reference and the source.
- **Alternative considered:** A separate documentation site, such as GitHub Pages with Jekyll. That is a second build and a second design, and it drifts from the app.

### D67. The portal renders the repository's own Markdown files
- **Context:** Documents must not exist in two versions, one for GitHub and one for the portal.
- **Decision:**
  - [`frontend/scripts/copy-docs.mjs`](../frontend/scripts/copy-docs.mjs) runs before `npm start` and `npm run build`. It copies `README.md` and `docs/` to `frontend/public/content/`, which is git-ignored and published with the site.
  - The Angular builder rejects asset folders outside the workspace, which is why a script is used.
  - A typed [`docs.catalog.ts`](../frontend/src/app/features/docs/docs.catalog.ts) lists every document with its category and source path.
  - A document that is missing from a build shows a friendly "not available" state.
- **Why:** There is a single source of truth: the file a reviewer reads on GitHub is the file the portal renders. Editing a document needs no frontend change unless a new document is added.
- **Alternative considered:** Copying the docs into `src/` by hand, which drifts. Or fetching the raw files from GitHub at runtime, which needs the network and shows `main` rather than the deployed version.

### D68. Markdown rendering: `marked`, Angular's sanitizer, GitHub-compatible anchors and links rewritten for the portal
- **Context:** The portal must show tables, code and headings well, and links written for GitHub must still work inside the app.
- **Decision:** [`markdown-renderer.ts`](../frontend/src/app/features/docs/markdown/markdown-renderer.ts) is a pure function that uses `marked`. The HTML is bound with `[innerHTML]`, so Angular's sanitizer strips scripts.
  - Heading ids follow GitHub's slug rules. A directive sets them after rendering, because the sanitizer removes `id` attributes.
  - Links are rewritten:
    - a link to another catalog document opens in the app, keeping its `#anchor`;
    - the original `.docx` downloads;
    - any other repository path (source files) opens on GitHub in a new tab;
    - external links open in a new tab.
  - A directive sends clicks on in-app links to the Angular Router, so the page does not reload.
  - The docs service treats a `text/html` answer as a 404, because SPA hosts answer missing files with `index.html`.
- **Why:** The same Markdown works on GitHub and in the portal, and a link such as `API.md#errors` behaves as the reader expects in both places.
- **Alternative considered:** `ngx-markdown`. It is a larger dependency that hides the link and anchor behaviour this portal needs to control.

### D69. The brief is kept as a faithful transcription, with the original next to it
- **Context:** The official brief is a Word document, and the specification given to the AI is the candidate's own work.
- **Decision:** [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) transcribes the brief and links the original `.docx` in `docs/assets/`. [`SPEC_PROMPT.md`](SPEC_PROMPT.md) records the specification prompt word for word. The traceability matrix maps each requirement to code and tests.
- **Why:** Reviewers can compare the brief, the specification and the result in the portal, without opening Word.
- **Alternative considered:** Linking only the `.docx`. It cannot be read in a browser, and it cannot be linked to section by section.
