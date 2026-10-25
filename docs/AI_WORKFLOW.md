# How I used AI on this assessment

I built this project with an AI coding assistant, Claude Code. This page records how I used it: the tool and how its work was organised, how I turned the brief into a specification, every prompt in order, what the AI produced, what I directed, what a human still has to review, the assumptions and trade-offs, and the problems the AI ran into on my machine.

The official brief is [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md). The specification I wrote from it is recorded verbatim in [SPEC_PROMPT.md](SPEC_PROMPT.md).

**In short:** I wrote the specification and made the product decisions. Claude Code wrote the code, tests, configuration and documentation through focused sub-agents, and checked the result with builds, tests, smoke tests, browser runs and independent reviewer agents. I did not edit the generated code by hand. I steered it through the specification and follow-up prompts. The places that most need a human eye are listed under [What a human must still review](#what-a-human-must-still-review).

## Tools used

| | |
|---|---|
| AI assistant | Claude Code (Anthropic), running in VS Code on Windows 11 |
| Model | Claude Opus 5.5 |
| What the AI ran on my machine | .NET 8 SDK (`dotnet build`, `dotnet test`, `dotnet run`), Angular CLI and Vitest, `curl`, headless Chrome (screenshots and scripted checks), small Node scripts, `git` |

### How the sub-agents were orchestrated

Claude Code worked as an orchestrator. It did not write most of the code in its main session. It wrote a plan and handed out focused tasks.

1. **Design contract first.** After reading my specification, the main session wrote an internal design contract. It fixed the Core types and method names, the order in which a move is validated, the exact error messages, the API layout, a frozen JSON contract, the test plan, and the Angular structure and visual design. The contract is a working file and is not in the repository. The decisions that matter are in [DECISIONS.md](DECISIONS.md).
2. **One sub-agent per task.** Each task went to a separate sub-agent with its own prompt and its own list of files. Every sub-agent worked under the same rules:
   - never run a git command that changes the repository (only the orchestrator commits);
   - never change the JSON contract;
   - report every deviation from the contract, with the reason;
   - stop any server it started.
3. **Parallel only when safe.** Sub-agents ran at the same time only when they touched different files.
4. **Reports, then integration.** Each sub-agent returned a structured report: files created, deviations, the commands it ran with their output, and notes for the next agent. The orchestrator reviewed the report, integrated the work and made the commit.
5. **A second contract for the extended scope.** When I asked for an enterprise structure, a review portal and free hosting (my prompt 4 below), the orchestrator wrote a second design contract and ran a second round of sub-agents.
6. **Independent review, then fixes.** Reviewer sub-agents that had not written the code checked it. Fix sub-agents then applied the findings that were confirmed.
7. **Documentation last.** Documentation sub-agents wrote the docs from the code and the build reports, and a fact-check pass compared them with the code. This page was drafted that way, from the real prompt log, the build reports and the code.

### What I did and what the AI did

| Area | Me | Claude Code |
|---|---|---|
| Requirements | Read the brief; wrote the specification; decided every open question (Option A undo, where the computer moves, what Reset keeps) | Copied my specification into `docs/SPEC_PROMPT.md`; transcribed the Word brief into `docs/PROBLEM_STATEMENT.md` |
| Design | Chose the stack, the API, the game-state shape and the quality bar; asked for the enterprise structure, the review portal and the hosting targets | Wrote the two design contracts (types, messages, contract, test plan, folder layering) |
| Code and tests | Defined the required test list; set the rule that every line must be explainable to a React/TypeScript/Java developer | Wrote all code, tests, configuration and Dockerfiles through sub-agents |
| Verification | Set the quality bar; I am responsible for the final review and for defending the code in the panel | Built, tested, smoke-tested, took screenshots, ran scripted browser checks and reviewer agents |
| Git and GitHub | Chose the repository, the commit identity and the attribution policy | Ran the git commands and pushed |
| Hosting | Chose free hosting and asked for a GitHub-based deployment | Wrote the deployment files; the one-time account steps (creating the Render service, enabling GitHub Pages) are mine to do |

## How I converted the requirement into a specification

The brief ([PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md)) describes what the app must do, but leaves several choices open. An AI agent fills open choices on its own, and not always the same way twice. So before any code existed I rewrote the brief as an executable specification, [SPEC_PROMPT.md](SPEC_PROMPT.md). Every requirement in it can be checked, and every choice the brief leaves open is already decided.

| The brief says | My specification pins it down |
|---|---|
| Angular + .NET Web API, in-memory or SQLite | **Fixed stack, no substitutions:** latest stable Angular with standalone components, .NET 8 Web API, in-memory storage in a thread-safe singleton, no database |
| "Suggested API scope"; "the exact endpoint names can vary" | **The seven endpoints, used exactly as listed,** with exact request bodies (`{ "mode": … }`, `{ "player", "row", "col" }`) and 400 with a clear message body for every rejected move |
| The game state "should include" a list of fields | **A frozen state contract:** the field list, the status values, and the rule that every endpoint that changes state returns the full updated state, so the frontend never computes a rule itself |
| Option A or Option B for undo after completion | **Option A**, stated in the README |
| The computer "should make a move automatically" | **The computer moves inside the same `POST /moves` request**, server-side, and never after the human's move has ended the game |
| Undo removes "the latest move or move pair based on the selected game mode" | **The edge case is decided:** history X then O, Undo removes both; Undo is disabled when the history is empty |
| "Start a fresh game session"; "session-level scoreboard" | **One session = one game id. Reset keeps the id and the mode. The scoreboard is global for the server process.** |
| A list of things the tests should cover | **A named test list:** one clearly named test per case, including one test per computer priority rule and "the computer does not move after the game is over" |
| — | **Eight build phases**, each ending in a commit, with a final clean-clone verification that uses only the README |
| README contents; AI workflow notes | **Required docs:** README sections in a fixed order, Windows PowerShell commands, `API.md` with real `curl` output, `DECISIONS.md`, this file, and `PANEL_QA.md` with 25–35 questions |
| A "clean and usable interface" | **A quality bar:** no build warnings, nullable C# and strict TypeScript, small single-purpose files, no dead or commented-out code, comments only where they explain why, and a UI that looks intentional |

I added two instructions about how to work:

- **Do not stop to ask.** Make a sensible decision, record it in `DECISIONS.md`, and keep going.
- **Write for me.** I am a React/TypeScript/Java developer and less experienced with Angular and .NET, so the code should be idiomatic and easy to read, and non-obvious Angular or .NET choices should be explained in short comments and in the docs.

## The prompts used

### My prompts, in order

1. **The specification prompt.** Recorded verbatim in [SPEC_PROMPT.md](SPEC_PROMPT.md). Purpose: turn the problem statement into unambiguous, testable instructions.
2. "push code here https://github.com/intellectwithvivek/ABB.git … push all commits by name, don't use my office email account, complete all end to end task." (The message also named my personal email address, which is left out here.) Purpose: publish to my personal GitHub under my own name, not my work identity.
3. An answer to a question from the tool. GitHub refused the push because my email address is private (error GH007), so I chose my GitHub no-reply address. Purpose: keep my email private and still attribute every commit to my account.
4. "start all phases, complete it fast; use enterprise-level codebase management and folder structure in backend and frontend; all docs must be readable from the frontend by the interviewers; I plan to deploy on free hosting like Vercel / DigitalOcean; the complete brief is the file 'Round 2 - Problem Statement.docx'; make it very professional — they can go everywhere from the frontend." Purpose: an enterprise structure, a review portal, readiness for deployment, and the official brief as the reference.
5. "why is claude showing in the commit history — all commits should go by my name." Purpose: commits carry only my identity, with no AI co-author trailer. AI usage is disclosed on this page instead.
6. "can we deploy backend and frontend on GitHub?" Purpose: GitHub Pages for the frontend, plus Render for the API, because GitHub cannot run a .NET API.
7. "complete all tasks, complete the project end to end" (sent twice). Purpose: finish every remaining phase without stopping.

### Orchestration prompts Claude Code generated and acted on, in order

1. **Design contract v1.** Exact Core types and methods, validation order, error messages, API layout, frozen JSON contract, test plan, Angular structure and visual design.
2. **Sub-agent "core-impl".** Implement `TicTacToe.Core` to the contract (phase 2).
3. **Sub-agent "core-tests".** One named xUnit test per required case, plus extra cases (phase 3).
4. **Sub-agent "api-impl".** Controllers, DTOs, ProblemDetails errors, CORS, Swagger, service and HTTP integration tests, a `curl` smoke test, and `docs/API.md` (phase 4).
5. **Sub-agent "ui-impl".** The Angular UI with standalone components and signals: store, components, toast, loading state, and a visual check in headless Chrome (phase 5).
6. **Sub-agent "ui-tests".** Vitest specs for the board, `GameApiService` and the other units, with a mutation check (phase 6).
7. **Design contract v2.** Enterprise folder layering, the review portal (overview, play, docs viewer), deployment to GitHub Pages, Vercel, Render, DigitalOcean and Docker, and CI.
8. **Sub-agents "backend-enterprise", "frontend-restructure", "frontend-portal" and "devops".** Implement contract v2.
9. **Review sub-agents.** Requirements traceability, adversarial probing of the game logic, a scripted browser end-to-end run, backend code quality and frontend code quality. Fix sub-agents then applied the confirmed findings.
10. **Documentation sub-agents.** README, ARCHITECTURE, TESTING, DECISIONS, DEPLOYMENT, CONTRIBUTING, AI_WORKFLOW and PANEL_QA, followed by fact-check and final-verification sub-agents.

How the two lists line up: orchestration prompts 1–6 carried out my prompt 1. Prompts 7–8 answered my prompt 4, and the GitHub Pages + Render pairing was added to contract v2 after my prompt 6. Prompts 9–10 answered my prompt 7.

## What the AI generated

Everything below was generated by Claude Code's sub-agents to my specification and the two design contracts.

**Core game logic** ([`backend/TicTacToe.Core`](../backend/TicTacToe.Core/))
- `Domain/`: `Board`, `Position`, `Move`, `Player`, `GameMode`, `GameStatus`.
- `Engine/GameEngine.cs`: the rules of Tic Tac Toe. It validates and applies moves, detects wins and draws, and undoes moves. The current player and the outcome are derived from the board and history, never stored.
- `Opponents/ComputerPlayer.cs`: the rule-based opponent.
- `Sessions/GameSession.cs`: the product rules. It handles modes, the computer's reply, the Option A undo policy and pair undo, and records each finished game exactly once.
- `Scoring/`: a thread-safe `Scoreboard` behind `IScoreboardService`.

**Tests** ([`backend/TicTacToe.Tests`](../backend/TicTacToe.Tests/) and the `*.spec.ts` files in [`frontend/src`](../frontend/src/))
- xUnit tests for the Core, one named test per case required by the specification, plus extra cases. Examples: a ninth move that completes a line is a win, the computer prefers winning to blocking, and the scoreboard counts every call across 10,000 parallel rounds of updates.
- Application and HTTP tests: `GameServiceTests`, and `WebApplicationFactory` integration tests for status codes, problem+json bodies, CORS, the health check, rate limiting and configuration validation.
- A concurrency test: exactly one of several parallel moves to the same cell succeeds.
- Tests for the idle-game cleanup that run on a fake clock.
- Vitest specs for every game component, `GameApiService` (using `provideHttpClientTesting`), the store, error mapping, routing and the docs portal (catalog, Markdown rendering, link rewriting).

See [TESTING.md](TESTING.md) for the full inventory and the current counts.

**API** ([`backend/TicTacToe.Api`](../backend/TicTacToe.Api/))
- Controllers for the seven endpoints. Request and response DTOs, and a `ResponseMapper`.
- `GameService`, which runs each action under that game's lock.
- `InMemoryGameRepository`, behind the `IGameRepository` interface.
- `GameExceptionHandler`, which maps errors to RFC 7807 problem+json responses.
- Validated settings classes (Options pattern) for CORS, sessions, rate limiting and Swagger.
- A per-client-IP rate limiter, a `/health` endpoint, and `ExpiredSessionCleanupService`, which removes idle games.
- Swagger, `TicTacToe.Api.http` sample requests, and central package management.

**UI** ([`frontend/src/app/features/game`](../frontend/src/app/features/game/))
- Standalone, zoneless Angular 21 components: board, cell, status bar, controls, move history and scoreboard.
- `GameStore`, built on signals. It holds only the last snapshot from the server plus UI state.
- `GameApiService` and the error-to-message mapping.
- A non-blocking error toast, a loading state, and plain CSS with no UI library.

**Review portal** ([`frontend/src/app/core`](../frontend/src/app/core/) and [`frontend/src/app/features`](../frontend/src/app/features/))
- The site shell (header, footer, not-found page) and lazy-loaded routes.
- An overview page for interviewers: how to review, features mapped to the brief, an architecture diagram and quick links.
- A docs hub and a document viewer that renders the repository's own Markdown with `marked`. It has a sidebar, an "On this page" list and heading anchors, and it rewrites links: links to other documents open in the app, and links to source files open on GitHub.
- [`frontend/scripts/copy-docs.mjs`](../frontend/scripts/copy-docs.mjs), which publishes `README.md` and `docs/` with every build, so the portal shows exactly the files reviewers read on GitHub.

**Deployment and CI**
- [`backend/Dockerfile`](../backend/Dockerfile): multi-stage, non-root, port taken from `PORT`, forwarded headers enabled.
- [`frontend/Dockerfile`](../frontend/Dockerfile) and [`frontend/nginx.conf`](../frontend/nginx.conf): nginx serves the UI and proxies `/api` and `/swagger` to the API.
- The three environment files, and the `github-pages` build configuration in `angular.json`.
- The repository-level files from contract v2: `docker-compose.yml`, `render.yaml`, `vercel.json`, `.do/app.yaml`, the GitHub Actions workflows for CI and GitHub Pages, Dependabot, a pull-request template and `.editorconfig`.

See [DEPLOYMENT.md](DEPLOYMENT.md).

**Documentation**
- The README and every file in `docs/`, including this one, drafted by documentation sub-agents.
- `API.md`, which contains the real output of the `curl` smoke test.
- The Markdown transcription of the Word brief.

The one exception is [SPEC_PROMPT.md](SPEC_PROMPT.md): I wrote it, and the AI only copied it into the repository.

## What I changed or directed

I made my changes as directions, not as hand edits to generated files. They came in two forms.

**Decisions in the specification.** These are the fixed stack, the exact endpoints, the frozen state shape, Option A, the computer moving inside the move request, pair undo, Reset keeping the id and mode, the global scoreboard, the test list, the phases and the quality bar. All of them are in [SPEC_PROMPT.md](SPEC_PROMPT.md).

**Follow-up prompts.**
- Publish under my personal identity.
- Keep my email private with the no-reply address.
- Remove the AI co-author trailer from commits.
- Restructure both projects to an enterprise standard.
- Make every document readable from the frontend.
- Prepare free hosting, specifically on GitHub.
- Finish the project end to end.

**Deviations from my specification that I accepted.** The AI reported each one with its reason:
- **Angular 21.2, not the latest (22).** Angular 22's CLI does not run on the Node.js version installed on my machine.
- **`provideHttpClientTesting()` instead of `HttpClientTestingModule`.** It is the current, non-deprecated replacement with the same purpose.
- **An extra `canUndo` field in the game state.** The backend decides whether Undo is allowed, so the frontend never re-implements the rule.
- **One error title for every broken game rule.** Every rule error, including the undo errors, uses the title "Invalid move". The `detail` field always carries the specific message.
- **Two framework adjustments in [`ServiceCollectionExtensions.cs`](../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs).** A log filter on the framework's exception middleware, and `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes`. Both are explained under environment issues below.
- **Layering inside the three projects, not new projects.** The enterprise structure is expressed through folders and namespaces inside the three projects the brief names, because the panel will compare the repository against the brief's layout.

### What a human must still review

These are the places where a subtle mistake would break an acceptance criterion or a public deployment. Each has tests. A test only proves what its author thought of, so I treat each of these as my own review responsibility.

| Area | Where | Why it needs a human | How to check |
|---|---|---|---|
| Computer priority | [`ComputerPlayer.ChooseMove`](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs) and `FindLineCompletingMove` | The order must be exactly win → block → center → corner → any cell. A "completing" line must hold exactly two of the player's marks and one empty cell. The helpers return `Position?` because `FirstOrDefault` on a struct would silently return (0,0), a real cell. | `ComputerPlayerTests` has one test per rule plus `ChooseMove_CanWinAndMustBlock_PrefersWinning`. Also play boards where the computer can both win and block. |
| Pair undo | [`GameSession.Undo`](../backend/TicTacToe.Core/Sessions/GameSession.cs) | The Option A check must come first. Pair undo uses one extra `UndoLastMove` (an `if`, not a loop) and relies on the move count always being even between requests in computer mode. | `Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn`, `Undo_AfterTwoRounds_RemovesOnlyLastPair` |
| Scoreboard counted once | `GameSession.RecordResultIfFinished`, the `_resultRecorded` flag, and `GameSession.Reset` | The scoreboard must change exactly once per finished game. `Reset` must re-arm the guard, or the next game would never be counted. | `PlayMove_GameWon_RecordsWinExactlyOnce`, `PlayMove_GameDrawn_RecordsDrawExactlyOnce`, `Reset_ThenNextGameEnds_RecordsNextResultToo` |
| Validation order | [`GameEngine.ApplyMove`](../backend/TicTacToe.Core/Engine/GameEngine.cs) and `EvaluateOutcome` | The order is game over → off board → wrong player → occupied. It decides which message a user sees when several rules are broken at once, and the off-board check must run before the board is indexed. A rejected move must change nothing. The win check must run before the draw check. | `GameEngineTests`; the rejected-move tests assert that the board, turn, history and status are all unchanged |
| Lock and mapping | [`GameService.RunLocked`](../backend/TicTacToe.Api/Application/GameService.cs) and `CreateGame`; [`ResponseMapper`](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs) | Every action and its mapping must happen inside `lock (session.SyncRoot)`, so a response is a consistent snapshot and a reader never sees the human's move without the computer's reply. `CreateGame` maps the new game before publishing it. The mapper's `board[row][col]` orientation is part of the frozen contract. | `SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds`, and the JSON shape test in `GamesApiTests` |
| CORS origins | [`FrontendCorsOptions`](../backend/TicTacToe.Api/Configuration/FrontendCorsOptions.cs), `Cors:AllowedOrigins` in [`appsettings.json`](../backend/TicTacToe.Api/appsettings.json), `UseTicTacToeApi` in [`WebApplicationExtensions.cs`](../backend/TicTacToe.Api/Extensions/WebApplicationExtensions.cs) | Only the real frontend origin may be allowed. A deployed origin is scheme + host only, with no `/ABB` path and no trailing slash, set through `Cors__AllowedOrigins__0`. CORS must run before the rate limiter so that a 429 still reaches the UI. | `Preflight_FromFrontendOrigin_IsAllowed`, `Preflight_FromOtherOrigin_IsNotAllowed`; from the deployed site, check the browser's network tab |
| Error mapping and logging | [`GameExceptionHandler.TryHandleAsync`](../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs) and `ToStatusAndTitle`; `AddErrorHandling` in `ServiceCollectionExtensions.cs` | Only `GameRuleException` (400) and `GameNotFoundException` (404) may be mapped. Anything else must stay a 500 that leaks no detail. The framework's own exception log is switched off, so the handler's `LogError` is now the only record of a real server error and must never be removed. | The 400/404 tests in `GamesApiTests`; read the handler's fall-through branch |
| Public-hosting limits | [`RateLimitingOptions`](../backend/TicTacToe.Api/Configuration/RateLimitingOptions.cs) (300 requests per 60 s per IP), [`GameSessionOptions`](../backend/TicTacToe.Api/Configuration/GameSessionOptions.cs) (2-hour idle timeout, 10-minute cleanup), [`ExpiredSessionCleanupService`](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs), `InMemoryGameRepository.Find` | These values are reasonable guesses for a demo, not the result of load testing. The rate limit is per client only if the platform's proxy passes the real client address (`ASPNETCORE_FORWARDEDHEADERS_ENABLED` in `backend/Dockerfile`). A game idle for 2 hours is deleted, and the player's next action gets "Game … was not found". | `RateLimitingTests`, `CleanupTick_IdleAndRecentlyUsedGames_RemovesOnlyTheIdleOne`; after deploying, check the logs and a 429 from a real client |
| Markdown rendering and sanitisation | [`markdown-renderer.ts`](../frontend/src/app/features/docs/markdown/markdown-renderer.ts) (`renderMarkdown`, `escapeAttribute`), [`doc-link-resolver.ts`](../frontend/src/app/features/docs/markdown/doc-link-resolver.ts) (`resolveDocLink`), `[innerHTML]` in `doc-viewer-page.component.html` | The HTML relies on Angular's built-in sanitizer; nothing calls `bypassSecurityTrust…`. That is safe because the content is this repository's own docs. If documents ever came from users, a dedicated sanitizer would be needed. Rewritten links must not turn into unexpected URLs. | `markdown-renderer.spec.ts`, `doc-link-resolver.spec.ts`; search the code for `bypassSecurityTrust` |
| Deployment URLs and placeholders | [`environment.github-pages.ts`](../frontend/src/environments/environment.github-pages.ts) (`https://tictactoe-abb-api.onrender.com`), `baseHref: "/ABB/"` in `angular.json`, `render.yaml`, the `YOUR-API-HOST` placeholder in `vercel.json`, `.github/workflows/deploy-pages.yml` | The Render URL is the one the service *should* get from its name. It must be confirmed after the service is created, or overridden with the `API_BASE_URL` repository variable. GitHub Pages needs a one-time switch to "GitHub Actions" as its source. | Follow [DEPLOYMENT.md](DEPLOYMENT.md), then play a game on the deployed site |
| Store request flow | [`GameStore`](../frontend/src/app/features/game/state/game.store.ts): `play`, `run`, `init` | `play` must send the `currentPlayer` the backend reported. The loading guard in `run` prevents double submits. `init` builds the create-game request before deciding whether it needs it. That is harmless, because an HTTP observable sends nothing until it is subscribed, but it can be misread as "always creates a game". | `game.store.spec.ts` |
| Brief transcription | [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) against [`assets/Round-2-Problem-Statement.docx`](assets/Round-2-Problem-Statement.docx) | The AI transcribed the Word file. The portal presents the Markdown as the official brief, so it must match the original word for word. | Read the two side by side |

## Which parts were reviewed most carefully, and why

The most scrutiny went where a mistake is easy to make and hard to see.

1. **Pair undo and the scoreboard guard.** These are the rules the brief spells out with examples, and the ones that break silently. An off-by-one undo or a double-counted win still produces a plausible-looking screen. They were checked by the Core author's own sandbox run, by the named tests, and by the adversarial reviewer.
2. **Computer move selection.** The brief gives an exact priority order. The two classic traps here are preferring a block over a win, and C#'s `default(Position)` being the real cell (0,0). There is a test for each rule and one for win-before-block.
3. **Concurrency.** The game repository is a singleton shared by every request. A double click or two browser tabs could race on the same game, so the per-game lock and "map inside the lock" have a dedicated parallel test.
4. **The JSON contract and error messages.** The frontend and backend were built by different agents against one frozen contract. Any drift breaks the UI only at run time, so the contract shape, string enums, null cells and problem+json bodies are pinned by integration tests and the `curl` smoke test.
5. **The public deployment surface.** CORS, the rate limit, session expiry and the docs portal's `[innerHTML]` are what stands between the app and untrusted traffic once it is online.

These are also the parts I walk through first when I explain the code.

## How quality was checked

- **Contract first, deviations reported.** Every builder worked to the written contract and listed each deviation with its reason. The orchestrator reviewed each one before integrating it.
- **Build gates.**
  - `TreatWarningsAsErrors` in [`Directory.Build.props`](../backend/Directory.Build.props): any compiler or analyser warning fails the backend build.
  - The Angular production build has to be warning-free, within its size budgets.
  - Prettier formatting is checked.
  - `dotnet list package --vulnerable --include-transitive` reported no vulnerable packages.
- **A sandbox before the tests existed.** The Core author compiled the Core into a throwaway console project and ran about 60 checks. They included every message, every win line, pair undo, record-once, and 30,000 parallel scoreboard updates. The test author separately re-derived its expected boards with a small script, as a cross-check of the expectations themselves.
- **Automated tests.** xUnit for the Core, the application layer and the HTTP pipeline, and Vitest for the frontend. All 75 backend tests passed at the end of the API phase, and all 70 frontend tests at the end of the frontend-test phase. Both suites grew in the enterprise phase; see [TESTING.md](TESTING.md).
- **A `curl` smoke test against the real server.** It ran 21 steps covering every endpoint and every error path. Its output is pasted into [API.md](API.md). Temporary probe tests, deleted afterwards, also confirmed that an unexpected exception becomes a 500 with no internal detail, logged once, and that malformed bodies produce exactly one meaningful validation error.
- **Mutation checks on the frontend tests.** The test author broke the source in four places, one at a time: the toast's auto-dismiss time, the winning-cell highlight, the player sent with a move, and the double-submit guard. Each break failed exactly the intended test, which shows the tests can catch real regressions.
- **Visual checks.** Headless Chrome screenshots at several widths covered in-progress, won, draw and error states (against a stand-in server for the filled-in states), and later the portal pages.
- **A scripted browser end-to-end run.** Chrome was driven through the DevTools Protocol, with no extra test framework. The portal checks covered:
  - deep links to a `#heading`;
  - links inside an article routing in-app without a page reload;
  - the "On this page" list;
  - sidebar navigation;
  - the `.docx` download.

  They were also run under the `/ABB/` base path that GitHub Pages uses, and with a console-error sweep of every route.
- **Independent reviewer agents.** Separate agents, which had not written the code, reviewed:
  - requirements traceability, from every line of the brief to code and tests;
  - the game logic, adversarially;
  - backend code quality;
  - frontend code quality.

  Only findings the orchestrator confirmed were fixed.
- **Clean-clone verification.** The final step clones the repository into an empty folder and follows only the README commands. The backend, the frontend and both test suites must work there.
- **CI.** The GitHub Actions workflow builds and tests the backend and the frontend, and builds both Docker images, on every push and pull request.

## Assumptions made

1. **Option A:** Undo is disabled once a game is won or drawn, and the scoreboard is final for that game.
2. **The computer's move happens inside the same `POST /api/games/{id}/moves` request.** If the human's move ends the game, the computer does not move.
3. **Reset keeps the game id and the mode.** "Start a fresh game session" means a fresh game under the same session. New Game creates a new id.
4. **The scoreboard is global for the server process** ("session-level" = server lifetime). Every game shares it, and on a public deployment so does every visitor.
5. **In computer mode the human is X and moves first.** A move submitted as O in that mode is rejected as the wrong player.
6. **`currentPlayer` keeps alternating after the final move.** If X wins on move 5, it reads "O". Once the status is not `InProgress`, the UI shows the result instead of a turn.
7. **Coordinates are 0-based in the API (`row`/`col` 0–2) and 1-based in the UI** ("Row 1, Column 1").
8. **The mode selector applies when New Game is pressed.** It does not change the game in progress, and a hint says so.
9. **A page refresh resumes the current game.** The game id is kept in `sessionStorage` (per tab). If the server no longer knows the id, after a restart or idle cleanup, a new game starts.
10. **Angular 21.2 instead of 22.** Angular 22's CLI needs Node.js 24.15 or later, and my machine has 24.14. Angular 21.2 has everything the brief needs.
11. **Pair undo always removes two moves in computer mode,** because the computer replies within the same request and the move count is always even between requests. With no moves, Undo is disabled.
12. **If one move completes two lines at once, only the first line found is highlighted** (rows, then columns, then diagonals).
13. **The computer is deterministic.** Among equal options it takes the first in a fixed order: lines as above, then corners (0,0), (0,2), (2,0), (2,2), then the remaining cells row by row.
14. **When a move breaks several rules, only the first is reported,** in the order game over → off board → wrong player → occupied.
15. **Status codes.**
    - An unknown game id returns 404; the brief names only the 400 cases.
    - A malformed body returns 400 with ASP.NET's validation problem.
    - Every error is RFC 7807 problem+json.
    - `POST /api/games` returns 201 Created with a `Location` header.
16. **The backend adds `canUndo` to the game state,** so the Undo rule lives in one place.
17. **Enum names are accepted case-insensitively on input and integers are rejected.** Responses always use the canonical names (`"X"`, `"VsComputer"`).
18. **Locally the API is served over plain HTTP on port 5000,** with no HTTPS redirect, so no development certificate is needed.
19. **Limits for the public demo:** idle games are deleted after 2 hours (checked every 10 minutes), and each client IP may make 300 requests per minute. Swagger UI is on in every environment, so the deployed API documents itself.
20. **There is no authentication.** Anyone holding a game id can act on that game, and GUIDs are not guessable in practice.
21. **The working folder is the repository root.** The specification's layout calls it `tictactoe-abb/`; the GitHub repository is `ABB`.
22. **The portal renders only this repository's own Markdown,** which is trusted content.

## Trade-offs

| Chosen | Alternative | Why |
|---|---|---|
| In-memory store (`ConcurrentDictionary` plus a lock per game) | SQLite with EF Core | The brief allows in-memory storage. There is no schema, no migrations and no file to manage, and it is the fastest thing for a panel to read. `IGameRepository` is the seam where a database can replace it. The cost: games and scores are lost on restart, including when a free host puts the API to sleep. |
| Option A: no undo after the game ends | Option B: undo after the game ends, reversing the score | The scoreboard stays final, and the record-once guard never has to be undone. Option B would need a "remove result" path on the scoreboard and careful re-arming of the guard. The cost: a player cannot take back a losing last move. |
| The computer moves inside `POST /moves` | A separate `computer-move` endpoint, or the client asking for the computer's move | One round trip. The human move and the reply happen atomically under the same lock. The client can neither forget nor duplicate the computer's turn, and no half-finished state is ever visible. The cost: a "computer is thinking" pause would have to be faked on the client. |
| Standalone components, signals and a small `GameStore` | NgModules with an RxJS or NgRx store | Standalone components and zoneless change detection are Angular 21's defaults, and signals are its recommended way to hold state. They need far less boilerplate, and signals read much like React state. RxJS is kept only for HTTP. The cost: no NgRx devtools or time travel, which an app this size does not need. |
| Full game state in every response | Deltas or events | The frontend never computes a rule, and rendering is the same whatever happened before. The state is tiny (9 cells and a short history). The cost: a few more bytes per response. |
| Exceptions (`GameRuleException` → 400 via `IExceptionHandler`) | `Result<T>` types returned through every layer | This is idiomatic .NET 8. Controllers describe only the success path, and errors are mapped in one place. The cost: an expected error travels as an exception, and the possible failures are not visible in method signatures. |
| Controllers with `[ApiController]` | Minimal APIs | The brief's layout names controllers. `[ApiController]` gives automatic 400 validation responses, attributes document the responses in Swagger, and the style is familiar to a Java/Spring reader. The cost: a little more ceremony. |
| Rule-based computer opponent | Minimax (unbeatable) | The brief prescribes the exact priority order, and a rule-based opponent can be tested one rule at a time. Minimax would sometimes choose differently from that order. The cost: the computer can be beaten, for example with a fork. |
| GitHub Pages (UI) + Render (API) | One host for both (Docker Compose, DigitalOcean App Platform, or Vercel with rewrites) | I asked for a GitHub-based deployment. Pages can only serve static files, so the API needs a free container host. The cost: the two parts are on different origins, so CORS must be configured; the free API sleeps when idle, so the first request is slow and in-memory state is lost; and two URLs must be kept in sync. The single-host options are also provided, with `/api` on the same origin. |
| Layering by folders and namespaces inside three projects | Separate Application and Infrastructure projects | The panel will compare the repository with the brief's three-project layout. Folders still keep the layers apart. |
| Copy `README.md` and `docs/` into the build | Keep a second copy of the docs inside the frontend | One source of truth: the portal shows exactly the files on GitHub. The Angular builder refuses asset folders outside `frontend/`, hence the small copy script. |

## Commit authorship

Every commit is authored and committed under my own identity, "Vivek Kumar Singh", with my GitHub no-reply email address. Claude Code ran the git commands on my instruction. At my explicit request (prompt 5), the commits carry no AI co-author trailer. I wanted the history to show who is accountable for the code, and this page discloses the AI's involvement in full instead.

## Environment issues the AI hit and how they were resolved

| Issue | Resolution |
|---|---|
| The .NET 8 SDK was installed but not on `PATH` | Every command prefixed `PATH` with `C:\Program Files\dotnet` for that command only |
| No NuGet package source was configured, so `dotnet restore` failed | A repository-local [`backend/nuget.config`](../backend/nuget.config) that points at nuget.org |
| The `dotnet new xunit` template pinned test packages with vulnerable transitive dependencies | Upgraded the test packages; now managed in [`Directory.Packages.props`](../backend/Directory.Packages.props) |
| Angular 22 requires Node.js 24.15 or later; the machine has 24.14 | Used Angular 21.2 (see assumption 10) |
| Windows Smart App Control sometimes blocked `dotnet test` from loading the freshly built test DLL (`0x800711C7`, "An Application Control policy has blocked this file") | Not bypassed; the security feature stayed on. The AI rebuilt and retried, and later runs passed (75 of 75 at the end of the API phase). |
| In .NET 8, `ExceptionHandlerMiddleware` logs every handled 400/404 game error as an "unhandled exception" with a stack trace | That log category is filtered out, and `GameExceptionHandler` logs the truly unexpected errors itself |
| MVC added a second, vague "The request field is required." error to malformed bodies, which could appear first in the list the UI shows | `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes`, so each malformed body produces one error that names the cause |
| GitHub rejected the push because my email address is private (GH007) | Commits use my GitHub no-reply address (my prompt 3) |
| The Angular builder refuses asset folders outside the `frontend/` workspace | [`frontend/scripts/copy-docs.mjs`](../frontend/scripts/copy-docs.mjs) copies `README.md` and `docs/` before `start` and `build` |
| Docker is not installed on the machine | The Dockerfiles could not be built locally. The API's start-up command was simulated by running the published Release build the way the container does, and the CI workflow builds both images on GitHub. |
| In Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`, and error bodies are not exposed in `ErrorDetails` | Used `curl.exe` and the Bash tool; [API.md](API.md) shows how to read error bodies from PowerShell |
| Headless Chrome would not render narrower than about 500 px | Narrow layouts were checked at 500 px; phone widths below that were not screenshot-tested |
