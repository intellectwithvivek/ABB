# How I used AI on this assessment

I built this project with Claude Code. This page records the tools I used, how I turned the brief into a specification, the prompts in order, what the AI generated, what I directed and reviewed, and the assumptions, trade-offs and environment issues along the way.

The official brief is [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md). The specification I wrote from it is recorded verbatim in [SPEC_PROMPT.md](SPEC_PROMPT.md).

**In short:** I wrote the specification and made every product, hosting and scope decision. Claude Code generated the code, tests, configuration and documentation through focused sub-agents, and verified the result with builds, tests, a `curl` smoke test, browser runs and independent reviewer agents. I did not edit generated files by hand. I directed every change through prompts, tested the app myself, and I am accountable for every line.

## Tools

| | |
|---|---|
| Assistant | Claude Code (Anthropic), in VS Code on Windows 11 |
| Model | Claude Opus 5.5 |
| Way of working | One orchestrating session that delegated focused tasks to sub-agents |
| Commands the AI ran | .NET 8 SDK (`dotnet build`, `test`, `run`), Angular CLI and Vitest, `curl.exe`, headless Chrome through the DevTools Protocol, small Node scripts, `git` |

### How the sub-agents were orchestrated

1. **Design contract first.** Before any code, the main session wrote a design contract: Core types and method names, the order in which a move is validated, exact error messages, the API layout, a frozen JSON contract, the test plan and the Angular structure. The contract was a working file outside the repository; the decisions that matter are in [DECISIONS.md](DECISIONS.md).
2. **One sub-agent per task.** Each task had its own prompt and its own list of files. Every sub-agent had to keep the JSON contract unchanged, report each deviation with its reason, stop any server it started, and never run a git command that changes the repository.
3. **Parallel only when safe.** Sub-agents ran at the same time only when they touched different files.
4. **Reports, then integration.** Each sub-agent returned the files it changed, its deviations and the commands it ran with their output. The orchestrator reviewed the report, integrated the work and committed it.
5. **Independent review.** Reviewer sub-agents that had not written the code checked it, and fix sub-agents applied only the confirmed findings. Documentation was fact-checked against the code the same way.

## How I converted the requirement into a specification

The brief leaves several choices open, and an AI agent fills open choices on its own, not always the same way twice. Before any code existed, I rewrote the brief as an executable specification in which every requirement can be checked and every open question is already decided.

| The brief says | My specification decides |
|---|---|
| Angular + .NET Web API; in-memory storage or SQLite | Latest stable Angular with standalone components, .NET 8 Web API, in-memory storage in a thread-safe singleton |
| "Suggested API scope"; endpoint names can vary | The seven endpoints exactly, with request bodies, and a 400 with a clear message for every rejected move |
| The game state "should include" a list of fields | A frozen state shape; every endpoint that changes state returns the full state, so the frontend never computes a rule |
| Option A or Option B for undo after completion | Option A, stated in the README |
| The computer "should make a move automatically" | The computer moves inside the same `POST /moves` request, and never after the human's move has ended the game |
| Undo removes "the latest move or move pair" | History X then O and Undo removes both; Undo is disabled when the history is empty |
| "Start a fresh game session"; "session-level scoreboard" | One session is one game id; Reset keeps the id and mode; one scoreboard for the server process |
| Things the tests should cover | One clearly named test per case, including one per computer priority rule |
| A "clean and usable interface" | A quality bar: no build warnings, nullable C#, strict TypeScript, small files, no dead code, comments only to explain why |

I added two working instructions: make a sensible decision and record it instead of stopping to ask, and write idiomatic, readable code with short comments on non-obvious Angular and .NET choices, because my background is React, TypeScript and Java. The specification also fixed eight build phases, each ending in a commit, and the documents to write.

## The prompts used

### My prompts, in order

1. **The specification prompt**, recorded in [SPEC_PROMPT.md](SPEC_PROMPT.md). Purpose: turn the brief into unambiguous, testable instructions.
2. "push code here https://github.com/intellectwithvivek/ABB.git … push all commits by name, don't use my office email account, complete all end to end task" (the message also gave my personal email address, omitted here). Purpose: publish to my personal GitHub under my own identity.
3. My answer to a question from the tool: GitHub refused the push because my email address is private (GH007), so commits use my GitHub no-reply address. Purpose: keep my email private and still attribute every commit to my account.
4. "start all phases, complete it fast; use enterprise-level codebase management and folder structure in backend and frontend; all docs must be readable from the frontend by the interviewers; I plan to deploy on free hosting like Vercel / DigitalOcean; the complete brief is the file 'Round 2 - Problem Statement.docx'; make it very professional". Purpose: a layered structure, a review portal for the panel, deployment readiness, and the official brief as the reference.
5. "why is claude showing in the commit history — all commits should go by my name". Purpose: commits carry only my identity; AI use is disclosed on this page instead.
6. "can we deploy backend and frontend on GitHub?" Purpose: explore GitHub-based hosting. GitHub cannot run a .NET API, so the API went to Render. The GitHub Pages target was later removed (prompt 14).
7. "complete all tasks, complete the project end to end" (sent twice). Purpose: finish every remaining phase without stopping.
8. "fix all this thing", after reading the reviewers' findings. Purpose: apply every confirmed finding.
9. "I have reviewed it, it's correct — also review it from your end as an experienced developer and tester". Purpose: an independent senior review and test pass before committing.
10. "run this project locally, I will test it manually". Purpose: my own acceptance test. The tool ran an isolated snapshot on ports 5080 and 4280 so that work in progress was not disturbed.
11. A bug report from that test: "on the docs page a vertical scroll is coming, not looking professional", with screenshots. Purpose: fix the "On this page" list on the docs pages (see [What I reviewed most carefully](#what-i-reviewed-most-carefully-and-how)).
12. A series of hosting questions: frontend on GitHub and backend on Railway; Vercel instead; free options after my Railway trial expired; both parts on Vercel. Purpose: choose the hosting. The research showed that a Vercel-hosted API cannot keep in-memory state reliably.
13. "I have the Vercel $20 plan, I want to deploy this on Vercel; this is a demo for the ABB interview … tell me about the database we use as per the requirement", then "Add Redis for Vercel". Purpose: deploy the portal on Vercel. I first chose a Redis-backed store so the API could also run on Vercel; I reversed that in prompt 14.
14. "remove unnecessary things in code and docs; everything very professional end to end". Purpose: the final cleanup. My decisions with it:
    - Keep Vercel (portal) + Render (API) with in-memory storage. I considered Redis and declined it to keep the solution lean and within the brief, which accepts in-memory storage.
    - Make the panel document a reviewer-facing [Design Q&A](PANEL_QA.md), and keep my personal interview preparation outside the repository.
    - Remove the deployment targets that are not used (GitHub Pages, DigitalOcean, Docker Compose and the nginx frontend image).

### Orchestration prompts Claude Code generated, summarised

1. **Design contract v1**, then one sub-agent each for the Core logic, the Core tests, the Web API (with the `curl` smoke test and [API.md](API.md)), the Angular UI, and the frontend tests. These carried out my prompt 1 (phases 2–6).
2. **Design contract v2**, for layered folders, the review portal, deployment configuration and CI, carried out by backend, frontend, portal and DevOps sub-agents (prompt 4).
3. **Review round:** requirements traceability, adversarial probing of the game logic, a scripted browser run, and backend and frontend code-quality reviews, followed by fix sub-agents (prompts 7–9).
4. **Documentation round:** a sub-agent per document, then fact-check and final-verification sub-agents (prompt 7).
5. **Hosting research and a step-by-step deployment prompt** for configuring Render and Vercel in my own accounts, which I ran with a browser-based assistant, followed by checks of the live site (prompts 12–13).
6. **Design contract v3:** a Redis-backed store for serverless hosting. It was not adopted (prompt 14), and the repository contains no Redis code.
7. **Final cleanup:** code polish, removal of the unused deployment targets, a rewrite of the docs, a fact-check and a full re-verification (prompt 14).

## What the AI generated

All of the following was generated by Claude Code's sub-agents, to my specification and the design contracts. The only file I wrote myself is [SPEC_PROMPT.md](SPEC_PROMPT.md).

- **Core logic** ([`backend/TicTacToe.Core`](../backend/TicTacToe.Core/)): the domain types (`Board`, `Position`, `Move`, `Player`, `GameMode`, `GameStatus`); `GameEngine` (validation, win and draw detection, undo, with the turn and outcome derived from the board and history); the rule-based `ComputerPlayer`; `GameSession` (modes, the computer's reply, Option A, pair undo, recording each result once); and the thread-safe `Scoreboard` behind `IScoreboardService`.
- **API** ([`backend/TicTacToe.Api`](../backend/TicTacToe.Api/)): two controllers for the seven endpoints, request and response DTOs, `ResponseMapper`, `GameService` (each action under the game's lock), `InMemoryGameRepository` behind `IGameRepository`, `GameExceptionHandler` (RFC 7807 problem+json), validated settings classes, a per-client rate limiter, `/health`, idle-game cleanup and Swagger.
- **Tests** ([`backend/TicTacToe.Tests`](../backend/TicTacToe.Tests/) and the `*.spec.ts` files in [`frontend/src`](../frontend/src/)): xUnit tests for the Core, the application layer and the HTTP pipeline, including concurrency tests and an exhaustive test of every game against the computer; Vitest specs for the game components, the store, `GameApiService`, error mapping, routing and the docs portal. See [TESTING.md](TESTING.md).
- **UI** ([`frontend/src/app/features/game`](../frontend/src/app/features/game/)): standalone, zoneless Angular 21 components (board, cell, status bar, controls, move history, scoreboard), the signal-based `GameStore`, `GameApiService`, the error toast and plain CSS with no UI library.
- **Review portal** ([`frontend/src/app`](../frontend/src/app/)): the site shell, an overview page for reviewers, and a docs viewer that renders this repository's own Markdown, published with every build by [`copy-docs.mjs`](../frontend/scripts/copy-docs.mjs).
- **Deployment and CI:** [`backend/Dockerfile`](../backend/Dockerfile), [`render.yaml`](../render.yaml), [`vercel.json`](../vercel.json), the GitHub Actions [CI workflow](../.github/workflows/ci.yml), Dependabot, a pull-request template and `.editorconfig`.
- **Documentation:** the README and every file in `docs/` except SPEC_PROMPT.md, including this page and the Markdown transcription of the Word brief.

## What I directed and changed

I made my changes as directions, not as hand edits to generated files:

- **Through the specification:** the fixed stack, the exact endpoints, the state shape, Option A, the computer moving inside the move request, pair undo, Reset keeping the id and mode, the global scoreboard, the test list, the phases and the quality bar.
- **Through follow-up prompts:** my commit identity and the no-reply address; no AI co-author trailer; the layered structure; the review portal; the hosting choice; applying the reviewers' findings; the fix for the bug I found in my manual test; and the final cleanup with its scope decisions.
- **Deviations I accepted.** The AI reported each one with its reason:
  - Angular 21.2 instead of 22, because Angular 22's CLI needs a newer Node.js than my machine has.
  - `provideHttpClientTesting()` instead of `HttpClientTestingModule`, its current, non-deprecated replacement.
  - An extra `canUndo` field in the game state, so the Undo rule exists only on the server.
  - The title "Invalid move" for every broken game rule, including undo errors; the `detail` always carries the specific message.
  - Two framework adjustments in [`ServiceCollectionExtensions.cs`](../backend/TicTacToe.Api/Extensions/ServiceCollectionExtensions.cs), explained under [environment issues](#environment-issues-and-how-they-were-resolved).
  - Layers expressed as folders and namespaces inside the three projects my specification names, rather than extra projects.

### What a human must review

These are the places where a subtle mistake would break an acceptance criterion or the public deployment. Each has tests, but a test only proves what its author thought of, so I treat them as my own review responsibility.

| Area | Where | Why it needs a human |
|---|---|---|
| Computer priority | [`ComputerPlayer.ChooseMove`](../backend/TicTacToe.Core/Opponents/ComputerPlayer.cs), `FindLineCompletingMove`, `FindFirstEmpty` | The order must be exactly win, block, centre, corner, any cell. A completing line needs exactly two of the player's marks and one empty cell. The helpers return `Position?` because `FirstOrDefault` on a struct returns (0,0), a real cell. |
| Pair undo | [`GameSession.Undo`](../backend/TicTacToe.Core/Sessions/GameSession.cs) | The Option A check must come first. The second `UndoLastMove` is a single `if`, which is correct only because a Vs Computer game always has an even number of moves between requests. |
| Scoreboard counted once | `GameSession.RecordResultIfFinished`, `_resultRecorded`, `GameSession.Reset` | Each finished game must be counted exactly once, and `Reset` must re-arm the guard or the next game would never be counted. |
| Validation order | [`GameEngine.ApplyMove`](../backend/TicTacToe.Core/Engine/GameEngine.cs), `EvaluateOutcome` | The order (game over, off board, wrong player, occupied) decides which message a user sees, and the off-board check must run before the board is indexed. A rejected move must change nothing, and a win must be checked before a draw. |
| Lock and mapping | [`GameService.RunLocked`](../backend/TicTacToe.Api/Application/GameService.cs), `GameService.CreateGame`, [`ResponseMapper.ToGameState`](../backend/TicTacToe.Api/Mapping/ResponseMapper.cs) | The response must be built inside `lock (session.SyncRoot)`, so a reader never sees the human's move without the computer's reply. The `board[row][col]` orientation is part of the contract. |
| Error mapping | [`GameExceptionHandler.TryHandleAsync`](../backend/TicTacToe.Api/ErrorHandling/GameExceptionHandler.cs), `ToStatusAndTitle`, `AddErrorHandling` | Only expected exceptions may become 400, 404 or a Kestrel status; anything else must stay a 500 with no internal detail. The framework's own exception log is filtered, so the handler's `LogError` is the only record of a real server error. |
| Proxy, CORS and client IP | [`vercel.json`](../vercel.json) rewrites, [`environment.production.ts`](../frontend/src/environments/environment.production.ts), [`UseTicTacToeApi`](../backend/TicTacToe.Api/Extensions/WebApplicationExtensions.cs), `Cors:AllowedOrigins` in [`appsettings.json`](../backend/TicTacToe.Api/appsettings.json), `ASPNETCORE_FORWARDEDHEADERS_ENABLED` in the Dockerfile | The Render URL is written into `vercel.json`. Behind the proxy the API sees Vercel's address, so visitors who reach it through the same Vercel address share one rate-limit bucket. CORS is only for local development and must run before the rate limiter, so a 429 still reaches the UI. |
| Public-hosting limits | [`RateLimitingOptions`](../backend/TicTacToe.Api/Configuration/RateLimitingOptions.cs), [`GameSessionOptions`](../backend/TicTacToe.Api/Configuration/GameSessionOptions.cs), [`ExpiredSessionCleanupService`](../backend/TicTacToe.Api/Infrastructure/Maintenance/ExpiredSessionCleanupService.cs), `InMemoryGameRepository.Find` | 300 requests (30 new games) per minute per client and a 2-hour idle timeout are reasonable values for a demo, not load-tested ones. |
| Client request flow | [`GameStore`](../frontend/src/app/features/game/state/game.store.ts) `play`, `run`, `resync`, `init` | `play` must send the `currentPlayer` the server reported; `run` allows one request at a time; `resync` reloads the game after a 400 and starts a new one after a 404. |
| Error wording | [`toErrorMessage`](../frontend/src/app/core/http/api-error.ts) | A 502, 503 or 504 from the proxy means the API is waking up or unavailable, and a same-origin path such as `/api` must never appear in a message. |
| Markdown rendering | [`renderMarkdown`](../frontend/src/app/features/docs/markdown/markdown-renderer.ts), [`resolveDocLink`](../frontend/src/app/features/docs/markdown/doc-link-resolver.ts), `[innerHTML]` in [`doc-viewer-page.component.html`](../frontend/src/app/features/docs/doc-viewer-page.component.html) | The HTML relies on Angular's built-in sanitizer and nothing calls `bypassSecurityTrust…`. That is safe only because the content is this repository's own docs. |
| Brief transcription | [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) against [the original Word file](assets/Round-2-Problem-Statement.docx) | The portal presents the AI's transcription as the official brief, so it must match the original word for word. |

## What I reviewed most carefully, and how

1. **Pair undo and the scoreboard guard.** These are the rules the brief spells out with examples, and a mistake still produces a plausible screen. They are pinned by named tests such as `Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn` and `Reset_ThenNextGameEnds_RecordsNextResultToo`, and by a test that plays all 489 possible games against the computer and checks the scoreboard after every move.
2. **Computer move selection.** There is one test per priority rule plus `ChooseMove_CanWinAndMustBlock_PrefersWinning`, because preferring a block over a win is the classic mistake.
3. **Concurrency.** The repository is shared by every request, so a double click or two tabs could race. `SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds` sends 50 parallel moves to one cell and expects exactly one to succeed.
4. **The JSON contract and error messages.** The frontend and backend were built by different sub-agents against one contract, so integration tests assert the raw JSON, and a `curl` smoke test against the running server covered every endpoint and error path ([API.md](API.md)).
5. **The public surface.** The proxy, rate limit, idle expiry and the portal's `[innerHTML]` are what stand between the app and untrusted traffic.

How the work was checked:

- **Build gates:** `TreatWarningsAsErrors` in [`Directory.Build.props`](../backend/Directory.Build.props), a warning-free Angular production build within its size budgets, a Prettier check, and a scan for vulnerable NuGet packages.
- **Sandbox and mutation checks:** the Core was exercised in a throwaway console project before the tests existed, and the frontend tests were checked by deliberately breaking the source one place at a time ([Testing › Quality checks](TESTING.md#quality-checks)); each break failed the intended test.
- **Browser checks:** headless Chrome screenshots of every game state and portal page, and a scripted run covering deep links to headings, in-app links, the sidebar, the "On this page" list, the Word download, and a console-error sweep of every route.
- **My manual acceptance test:** I played the app myself on the isolated snapshot (prompt 10). On a long document the "On this page" list overflowed sideways because of one very long identifier, and listed about 70 headings as a second scrolling page. The fix wraps long words, shows only the h2 sections when a document has more than 24 headings (`MAX_TOC_ENTRIES_WITH_SUBSECTIONS` in [`doc-toc.component.ts`](../frontend/src/app/features/docs/components/doc-toc/doc-toc.component.ts)) and uses a thin scrollbar, with tests in `doc-toc.component.spec.ts`.
- **Live checks** after deployment: deep links, the published docs, and a game created through the Vercel proxy.
- **CI** builds and tests both projects and builds the API's Docker image on every push and pull request, and Render deploys only after CI passes.
- **Clean-clone check:** the repository was cloned into an empty folder and built, tested and run using only the README commands: 130/130 backend and 170/170 frontend tests, a warning-free build and 24/24 browser scenarios ([details](TESTING.md#quality-checks)).

## Assumptions

1. **Option A:** Undo is disabled once a game is won or drawn, and the scoreboard is final for that game.
2. **The computer moves inside `POST /api/games/{id}/moves`.** If the human's move ends the game, the computer does not move.
3. **Reset keeps the game id and mode.** "Start a fresh game session" means a fresh game in the same session; New Game creates a new id.
4. **The scoreboard is global for the server process.** Every game shares it, and on the public deployment so does every visitor.
5. **In computer mode the human is X and moves first.** A move submitted as O in that mode is rejected as the wrong player.
6. **`currentPlayer` keeps its derived value after the game ends.** The UI shows the result instead of a turn.
7. **Coordinates are 0-based in the API and 1-based in the UI** ("Row 1, Column 1").
8. **A mode change applies when New Game is pressed**, and a hint says so.
9. **A page refresh resumes the game** saved in `sessionStorage` for that tab; if the server no longer has it, a new game starts.
10. **Pair undo always removes two moves in computer mode**, because the computer replies in the same request.
11. **If one move completes two lines, the first line found is highlighted** (rows, then columns, then diagonals).
12. **The computer is deterministic:** among equal options it takes the first in a fixed order.
13. **When a move breaks several rules, only the first is reported**, in the order game over, off board, wrong player, occupied.
14. **Status codes:** 201 Created with a `Location` header for a new game, 404 for an unknown id, 400 for a malformed body, and RFC 7807 problem+json for every error.
15. **Enum names are accepted case-insensitively and integers are rejected**; responses use the canonical names (`"X"`, `"VsComputer"`).
16. **Locally the API runs over plain HTTP on port 5000**, so no development certificate is needed.
17. **Limits for the public demo:** idle games are removed after 2 hours, and each client may send 300 requests per minute, of which 30 may create games. Swagger is on in every environment.
18. **No authentication:** anyone holding a game id can act on that game; GUIDs are not guessable in practice.
19. **In-memory state is acceptable on the public demo:** a restart, a redeploy or the free API instance going to sleep clears games and the scoreboard, and the UI starts a new game.

## Trade-offs

| Chosen | Alternative | Why |
|---|---|---|
| In-memory storage behind `IGameRepository` and `IScoreboardService` | SQLite, or Redis for multi-instance hosting | The brief accepts in-memory storage, and it is the leanest design to read and run. The interfaces are the seam for a persistent store. Cost: state is lost on restart, and the API runs as one instance. |
| Option A | Option B (undo after the end, reversing the score) | The scoreboard stays final and the record-once guard never has to be undone. Cost: a player cannot take back a losing last move. |
| Computer moves inside `POST /moves` | A separate endpoint, or the client asking for the reply | One round trip, applied atomically under one lock; the client can neither forget nor duplicate the computer's turn. |
| Standalone components, signals, a small `GameStore` | NgModules with NgRx | Angular 21's defaults with far less boilerplate; RxJS stays for HTTP. Cost: no NgRx devtools, which an app this size does not need. |
| Full game state in every response | Deltas or events | The client never computes a rule and simply replaces its snapshot. Cost: a few hundred bytes per response. |
| Exceptions mapped by `IExceptionHandler` | `Result<T>` through every layer | Idiomatic .NET 8; controllers describe only the success path. Cost: failures are not visible in method signatures. |
| Controllers with `[ApiController]` | Minimal APIs | Automatic validation responses, Swagger attributes, and a shape familiar to a Spring reader. Cost: a little more ceremony. |
| Rule-based opponent | Minimax | The brief prescribes the priority order, and each rule can be tested on its own. Cost: a fork beats it. |
| Vercel (portal and proxy) + Render (API container) | The API on Vercel with Redis; GitHub Pages + Render; Docker Compose | Vercel's container runtime scales to zero after 5 idle minutes and may run several instances, which in-memory state cannot survive. Render runs one long-lived container, and the proxy keeps the browser on one origin with no CORS. Cost: the free Render instance sleeps after 15 idle minutes, and the first request then takes about a minute. |
| Layers as folders inside three projects | Separate Application and Infrastructure projects | Matches the three-project layout of my specification while keeping the layers apart. |
| `README.md` and `docs/` copied into the build | A second copy of the docs in the frontend | One source of truth: the portal shows exactly the files on GitHub. |

## Commit authorship

Every commit is authored and committed under my own identity, Vivek Kumar Singh, with my GitHub no-reply address. Claude Code ran the git commands on my instruction, and at my request (prompt 5) the commits carry no AI co-author trailer. I want the history to show who is accountable for the code; this page discloses the AI's involvement in full.

## Environment issues and how they were resolved

| Issue | Resolution |
|---|---|
| The .NET 8 SDK was installed but not on `PATH` | Each command added `C:\Program Files\dotnet` to `PATH` for that command only |
| No NuGet package source was configured | A repository-local [`backend/nuget.config`](../backend/nuget.config) that points at nuget.org |
| The `dotnet new xunit` template pinned test packages with vulnerable transitive dependencies | Upgraded them; versions are managed centrally in [`Directory.Packages.props`](../backend/Directory.Packages.props) |
| Angular 22 requires Node.js 24.15 or later; the machine has 24.14 | Angular 21.2, which has everything the brief needs |
| Windows Smart App Control sometimes blocked `dotnet test` from loading the freshly built test DLL (`0x800711C7`) | The security feature stayed on; a rebuild and retry passed |
| .NET 8's exception middleware logs every handled 400/404 as an unhandled exception | That log category is filtered, and `GameExceptionHandler` logs unexpected errors itself |
| MVC added a second, vague "The request field is required." error to malformed bodies | `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes`, so each malformed body produces one error that names the cause |
| GitHub rejected the push because my email address is private (GH007) | Commits use my GitHub no-reply address |
| The Angular builder refuses asset folders outside the workspace | [`copy-docs.mjs`](../frontend/scripts/copy-docs.mjs) copies `README.md` and `docs/` before `npm start` and `npm run build` |
| Docker is not installed on the machine | The published Release build was run the way the container runs it; CI builds the image and Render builds it on deploy |
| `curl` in Windows PowerShell 5.1 is an alias for `Invoke-WebRequest` | Commands use `curl.exe`, and [API.md](API.md) shows how to read error bodies from PowerShell |
| My Railway trial had expired, and a Vercel-hosted API cannot keep in-memory state | The API runs on Render's free plan and Vercel proxies `/api` and `/swagger` to it |
| Render's free instance sleeps when idle, so the first request can take about a minute | The UI says the server may be waking up after 5 seconds of loading, and a 502, 503 or 504 shows a "starting up" message |
