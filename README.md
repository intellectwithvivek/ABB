# Tic Tac Toe: Angular 21 + .NET 8

A browser-based Tic Tac Toe game built for the ABB Senior Software Engineer assessment (Round 2). The .NET 8 Web API owns every rule and all game state: moves, turns, win and draw detection, undo, the computer opponent and the scoreboard. The Angular 21 app sends each action to the API and renders exactly the state the API returns. The same Angular app is also a **review portal**: besides the game, it shows every project document, the API reference and links into the source on GitHub.

**[Review portal](https://intellectwithvivek.github.io/ABB/)** (live after the first GitHub Pages deployment) · [Documentation index](#review-portal--documentation-index) · [API reference](docs/API.md) · [Problem statement](docs/PROBLEM_STATEMENT.md) · [Source on GitHub](https://github.com/intellectwithvivek/ABB)

> **Quick start** (Windows PowerShell, from the repository root, two terminals). Terminal 1: `cd backend; dotnet run --project TicTacToe.Api` · Terminal 2: `cd frontend; npm ci; npm start` → open <http://localhost:4200>

---

## Project overview

The brief asks for a Tic Tac Toe game with an Angular frontend and a .NET backend that runs locally. It must support move history, undo by game mode, a scoreboard kept by the backend, and a basic computer opponent ([full brief](docs/PROBLEM_STATEMENT.md)). This repository delivers that, and adds what a review panel needs to check it quickly: a documentation portal, Swagger, a traceability matrix, and tests for every rule the brief lists.

```text
Angular 21 SPA  (http://localhost:4200)                  ASP.NET Core 8 Web API  (http://localhost:5000)
  Pages: Overview · Play · Docs                          GamesController, ScoreboardController
  GameStore: signals, UI state only    -- REST/JSON -->  GameService: one lock per game
  GameApiService: HttpClient           <-- GameState --  TicTacToe.Core: GameSession, GameEngine,
                                                                         ComputerPlayer, Scoreboard
                                                         InMemoryGameRepository (ConcurrentDictionary)
```

- **`backend/TicTacToe.Core`** holds the game rules as plain C#, with no ASP.NET dependency, so every rule is unit-tested without HTTP.
- **`backend/TicTacToe.Api`** translates HTTP to Core calls, stores games in memory and returns the full game state after every action.
- **`frontend/`** is a standalone, zoneless Angular app. It holds only UI state (selected mode, loading flag, error message) and never re-implements a rule.

The design is explained in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech stack

| Area | Technology |
|---|---|
| Frontend | Angular 21.2 (standalone components, signals, zoneless change detection, `OnPush`), TypeScript 5.9 (strict), RxJS 7.8, [marked](https://marked.js.org/) 18 for the docs portal, plain CSS (no UI library) |
| Backend | .NET 8, ASP.NET Core Web API with controllers, REST + JSON, Swagger / OpenAPI (Swashbuckle 6.6), RFC 7807 problem details, built-in rate limiter and health checks |
| Storage | In memory (`ConcurrentDictionary` behind an `IGameRepository` interface); no database |
| Backend tests | xUnit 2.9, `Microsoft.AspNetCore.Mvc.Testing` 8.0 (in-memory integration tests), `FakeTimeProvider` |
| Frontend tests | Vitest 4 + jsdom through the Angular CLI unit-test builder, `HttpTestingController` |
| Quality gates | `TreatWarningsAsErrors`, nullable reference types, Central Package Management, Prettier, `.editorconfig` |
| Delivery | GitHub Actions (CI and GitHub Pages), Docker (API image, nginx web image), Docker Compose, Render, Vercel, DigitalOcean |

## Features implemented

**Required by the brief**

- [x] **3×3 board.** Empty cells are clickable buttons. A played cell shows X or O and stays locked: the button is disabled and the API rejects the move.
- [x] **Player turns.** X always starts. A prominent status shows whose turn it is ("Player X's turn", or "Your turn (X)" against the computer). Turns alternate only after a valid move, and a rejected move never changes the turn.
- [x] **Win detection** on every row, column and both diagonals. The UI shows the winner, highlights the winning cells, locks the board and updates the scoreboard.
- [x] **Draw detection.** A full board with no line shows "It's a draw!", locks the board and updates the scoreboard.
- [x] **Reset Game** clears the board, the move history and the result, and gives the turn back to X. The game id and mode stay the same and the scoreboard is unchanged.
- [x] **Move history** table with columns Move, Player and Position ("Row 1, Column 1"), updated after every valid move.
- [x] **Undo Last Move** by mode. Two Player removes the last move. Vs Computer removes the computer's reply and your move together. Undo is disabled when there is nothing to undo and once the game is over (Option A).
- [x] **Scoreboard** of X wins, O wins and draws, served by the backend. Each finished game is counted exactly once, and there is a separate **Reset Scoreboard** action.
- [x] **Computer mode.** The human is X and the computer is O. The computer replies automatically in the same request, plays only valid moves, never moves after the game has ended, and follows the brief's priority: win → block → center → corner → any cell.
- [x] **Backend validation** of every move: outside the board, occupied cell, game already over, or wrong player gives a 400 with a clear message.
- [x] **Error display.** API errors appear in a small, non-blocking toast that closes itself after 5 seconds.

**Beyond the brief**

- **Review portal**: an Overview page with a five-minute review guide, the game at `/play`, and every Markdown document in this repository rendered at `/docs`. The portal has a sidebar, an "On this page" list and "View source on GitHub" links, and the header links to Swagger and GitHub.
- **Reliable UI states**: buttons and the board are disabled while a request is in flight (no double submits), and a page refresh resumes the current game (the game id is kept in `sessionStorage`).
- **Accessibility basics**: cells are real buttons with labels such as "Row 1, Column 1, empty", the status is announced through `aria-live`, focus rings are visible, and animations respect reduced-motion settings.
- **Hardening for a public demo**: `GET /health`, a rate limit of 300 requests per minute per IP, cleanup of games idle for 2 hours, CORS origins set in configuration, settings validated at startup, and one lock per game for concurrent requests.
- **Delivery**: Dockerfiles, Docker Compose, a CI workflow and deployment configuration for GitHub Pages + Render, Vercel and DigitalOcean.

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| .NET SDK | **8.0.x** (tested with 8.0.426). [`backend/global.json`](backend/global.json) pins the .NET 8 SDK, so a .NET 9/10 SDK alone is not enough. | `dotnet --version` |
| Node.js | **LTS 22.12+ or 24.x** (tested with 24.14.0). Angular 21 needs `^20.19 \|\| ^22.12 \|\| >=24`. | `node --version` |
| npm | **10+** (ships with Node.js; tested with 11.9.0) | `npm --version` |
| Angular CLI | 21.2, **optional**: the project's local CLI runs through the npm scripts (`npm start`, `npm test`) | `npx ng version` |
| Git | any recent version | `git --version` |

Get the code:

```powershell
git clone https://github.com/intellectwithvivek/ABB.git
cd ABB
```

All commands below are written for **Windows PowerShell 5.1** and start from the repository root. In PowerShell 5.1, `curl` is an alias of `Invoke-WebRequest`, so this README uses `curl.exe`.

## How to run the backend locally

```powershell
cd backend
dotnet run --project TicTacToe.Api
```

The first run restores NuGet packages, which needs internet access. Wait for `Now listening on: http://localhost:5000`. Stop the server with `Ctrl+C`.

| What | URL |
|---|---|
| API base URL | <http://localhost:5000/api> |
| Swagger UI | <http://localhost:5000/swagger> |
| Health check | <http://localhost:5000/health> (returns `Healthy`) |

Check it from a second terminal:

```powershell
curl.exe http://localhost:5000/health
curl.exe http://localhost:5000/api/scoreboard
```

You can also open `backend/TicTacToe.sln` in Visual Studio or Rider and run the `http` profile. [`TicTacToe.Api.http`](backend/TicTacToe.Api/TicTacToe.Api.http) has a sample request for every endpoint (Visual Studio, or VS Code with the REST Client extension). To build without running, use `dotnet build`. Warnings are treated as errors, so a clean build has 0 warnings.

**Troubleshooting**

| Symptom | Fix |
|---|---|
| `dotnet : The term 'dotnet' is not recognized` | The SDK is installed but not on `PATH`. Run `$env:PATH = "C:\Program Files\dotnet;" + $env:PATH` in the same window, or add `C:\Program Files\dotnet` to `PATH` permanently. |
| `A compatible .NET SDK was not found` | Install the .NET 8 SDK. `backend/global.json` accepts any 8.0.x SDK, but not 9.x or 10.x. |
| `NU1100`/`NU1101` "Unable to resolve", or no NuGet source configured | The repository's [`backend/nuget.config`](backend/nuget.config) adds nuget.org for you. Run the commands from `backend/` so it is picked up, and check your internet or proxy settings. |
| `An Application Control policy has blocked this file. (0x800711C7)` | Windows 11 **Smart App Control** sometimes blocks a freshly built, unsigned DLL. Rebuild (`dotnet build --no-incremental`) and retry; it is usually intermittent. If it keeps failing, run the backend or its tests in WSL 2, or rely on the CI workflow. |
| `Failed to bind to address http://127.0.0.1:5000: address already in use` | Something already listens on port 5000, often an earlier API run. If it is a process you started, stop it with the command below. |

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## How to run the frontend locally

In a second terminal, from the repository root:

```powershell
cd frontend
npm ci
npm start
```

`npm start` first copies `README.md` and `docs/` into `frontend/public/content/` so the docs portal can show them, then runs `ng serve`. Open <http://localhost:4200>:

| Page | URL |
|---|---|
| Overview (review guide) | <http://localhost:4200/> |
| Play | <http://localhost:4200/play> |
| Documentation | <http://localhost:4200/docs> |

The UI calls the API at `http://localhost:5000/api`, which is set in [`frontend/src/environments/environment.ts`](frontend/src/environments/environment.ts). Start the backend first. A production build is `npm run build`, and its output goes to `frontend/dist/tictactoe-web/browser`.

**Troubleshooting**

| Symptom | Fix |
|---|---|
| `npm.ps1 cannot be loaded because running scripts is disabled on this system` | Use `npm.cmd ci` and `npm.cmd start`, or allow local scripts once with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| Toast: "Cannot reach the game server at http://localhost:5000. Is the backend running?" | Start the backend (see above), then press **New Game**. |
| `The Angular CLI requires a minimum Node.js version` | Install Node.js 22.12+ or 24.x. |
| Port 4200 is already in use | Run `npm start -- --port 4300`. The API only allows `http://localhost:4200` by default, so start the backend (in `backend/`) with `$env:Cors__AllowedOrigins__0 = "http://localhost:4300"; dotnet run --project TicTacToe.Api`. |

## API endpoint summary

Base URL `http://localhost:5000`. The full contract, with schemas, every error, configuration and a recorded curl smoke test, is in **[docs/API.md](docs/API.md)**.

| Method | Endpoint | Purpose | Success | Errors |
|---|---|---|---|---|
| POST | `/api/games` | Create a game. Body: `{ "mode": "TwoPlayer" \| "VsComputer" }` | **201** GameState + `Location` | 400 |
| GET | `/api/games/{id}` | Get the current game state | 200 GameState | 404 |
| POST | `/api/games/{id}/moves` | Submit a move. Body: `{ "player": "X" \| "O", "row": 0-2, "col": 0-2 }`. In Vs Computer mode the response already includes the computer's reply. | 200 GameState | 400, 404 |
| POST | `/api/games/{id}/undo` | Undo the last move (Two Player) or the last pair (Vs Computer) | 200 GameState | 400, 404 |
| POST | `/api/games/{id}/reset` | Reset the game: same id and mode, scoreboard unchanged | 200 GameState | 404 |
| GET | `/api/scoreboard` | Get the scoreboard | 200 Scoreboard | none |
| POST | `/api/scoreboard/reset` | Reset all counters to zero | 200 Scoreboard | none |
| GET | `/health` | Liveness check for hosting platforms | 200 `Healthy` | none |

Every game endpoint returns the **full game state**, so the frontend never computes a rule itself:

```json
{
  "gameId": "8a6e0804-2bd0-4672-b79d-d97027f9071a",
  "mode": "VsComputer",
  "board": [["X", null, null], [null, "O", null], [null, null, null]],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [
    { "moveNumber": 1, "player": "X", "row": 0, "col": 0 },
    { "moveNumber": 2, "player": "O", "row": 1, "col": 1 }
  ],
  "canUndo": true,
  "scoreboard": { "xWins": 0, "oWins": 0, "draws": 0 }
}
```

Errors are `application/problem+json`, for example `{ "title": "Invalid move", "status": 400, "detail": "Cell (row 0, col 0) is already taken by X." }`. Any client may also get a 429 above the rate limit. `row` and `col` are 0-based in the API and shown 1-based in the UI.

## How to run tests

**Backend** (xUnit; unit tests for Core plus in-memory HTTP integration tests):

```powershell
cd backend
dotnet test
```

Expected result: **83 tests, 0 failed**.

- **49 Core tests**: `GameEngine` 21, `GameSession` 9, `GameSession` in Vs Computer mode 7, `ComputerPlayer` 6, `Scoreboard` 6.
- **34 API tests**: HTTP integration 16, `GameService` 10, configuration 3, rate limiting 2, health check 1, repository 1, idle-game cleanup 1.

If the run stops with `0x800711C7`, see the Smart App Control row under [backend troubleshooting](#how-to-run-the-backend-locally).

**Frontend** (Vitest, single run):

```powershell
cd frontend
npm run test:ci
```

Expected result: **25 test files, 142 tests passed**. `npm test` starts the same suite in watch mode. `npm run format:check` checks formatting.

**Tests the brief requires** (all in `backend/TicTacToe.Tests/Core/`):

| Brief | Test |
|---|---|
| Valid move | `GameEngineTests.ApplyMove_ValidMove_PlacesMarkAndRecordsMove` |
| Invalid move | `GameEngineTests.ApplyMove_OutsideBoard_ThrowsAndKeepsTurn` (4 cases), `ApplyMove_OccupiedCell_ThrowsAndKeepsTurn`, `ApplyMove_WrongPlayer_ThrowsAndKeepsTurn` |
| Turn switching | `GameEngineTests.ApplyMove_ValidMove_PassesTurnToOtherPlayer` |
| Row / column / diagonal win | `GameEngineTests.ApplyMove_CompletesRow_WinsWithRowCells` (3 rows), `ApplyMove_CompletesColumn_WinsWithColumnCells` (3 columns), `ApplyMove_CompletesMainDiagonal_WinsWithDiagonalCells`, `ApplyMove_CompletesAntiDiagonal_WinsWithDiagonalCells` |
| Draw | `GameEngineTests.ApplyMove_FillsBoardWithoutLine_EndsInDraw` |
| Reset game | `GameSessionTests.Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard` |
| Undo, Two Player | `GameSessionTests.Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn` |
| Undo, Vs Computer | `GameSessionVsComputerTests.Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn` |
| Scoreboard update | `GameSessionTests.PlayMove_GameWon_RecordsWinExactlyOnce`, `PlayMove_GameDrawn_RecordsDrawExactlyOnce` |
| Computer move selection | `ComputerPlayerTests`: one test per priority rule, plus "win beats block" |
| Move after completion | `GameEngineTests.ApplyMove_AfterGameWon_ThrowsGameOver`, `ApplyMove_AfterDraw_ThrowsGameOver`, `GameSessionVsComputerTests.PlayMove_HumanCompletesLine_ComputerDoesNotMove` |

On the frontend, `board.component.spec.ts` covers rendering (9 cells, X/O, highlighted winning cells, disabled when the game is over), and `game-api.service.spec.ts` covers the create-game and submit-move calls. [docs/TESTING.md](docs/TESTING.md) describes both suites, and [docs/TRACEABILITY.md](docs/TRACEABILITY.md) maps every requirement to its code and tests.

## AI tools and prompt summary

- **Tool:** Claude Code (Anthropic), running in VS Code on Windows (model: Claude Opus 5.5).
- **Specification first:** I rewrote the brief as an executable specification with a fixed stack, the exact API, the game-state shape, decided clarifications, the required tests, build phases and a quality bar. It is recorded verbatim in **[docs/SPEC_PROMPT.md](docs/SPEC_PROMPT.md)**.
- **Follow-up prompts:** publish to my GitHub under my own identity; add an enterprise folder structure, a review portal for the interviewers and free-hosting deployment; deploy from GitHub (Pages + Render); finish the project end to end.
- **How the AI worked:** Claude Code wrote design contracts (exact types, validation order, error messages and a frozen JSON contract), assigned each phase to a focused sub-agent (Core, tests, API, UI, UI tests, restructure, portal, DevOps, reviewers, docs), then reviewed and integrated the results.
- **What I reviewed most carefully:** the computer's priority order, the Vs Computer undo pair, the guard that counts each result exactly once, the per-game lock, CORS and the error mapping.
- **Things the AI surfaced** that I kept: the .NET 8 exception-middleware log noise (filtered), a misleading duplicate validation error (suppressed), Angular 21.2 instead of 22 because of the Node.js version, a repo-local `nuget.config`, and upgraded test packages without known vulnerabilities.

The full account (prompts in order, what was generated, what I changed, assumptions and trade-offs) is in **[docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md)**.

## Design decisions

- **Rules live in a pure Core library.** `GameEngine` holds the rules of Tic Tac Toe (the mechanism). `GameSession` holds the product's rules: modes, the computer reply, Option A undo and counting each result once.
- **Derived state, not stored state.** The current player comes from the number of moves, and the status is recalculated from the board after every change, so undo can never leave stale state.
- **The backend is the single source of truth.** Every endpoint returns the full `GameState`, including `canUndo` and the scoreboard. The Angular store keeps only the last server snapshot plus UI flags.
- **The computer moves inside `POST /moves`**: one request, one consistent state, no extra endpoint for the client to orchestrate.
- **Thread safety by design.** The repository and scoreboard are singletons (`ConcurrentDictionary`, plus a lock in `Scoreboard`), and each game has its own lock, so a double click can never apply two moves.
- **Errors use RFC 7807 problem details** with one exact, human-readable message per rule. The UI shows `detail` as it is.
- **Modern, small Angular**: standalone components, signal inputs and outputs, `inject()`, the new control flow, zoneless change detection and lazy-loaded routes.
- **One source of truth for the docs.** The portal renders the same Markdown files that GitHub shows.

The decisions and the alternatives considered are in **[docs/DECISIONS.md](docs/DECISIONS.md)**, and the structure is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Clarifications and assumptions

- **Option A is implemented: Undo is disabled once a game is Won or Drawn, and the scoreboard is final for that game.** The API rejects such an undo with a 400 ("Undo is not available after the game has ended. Reset the game to play again."), and `canUndo` is `false`, so the button is disabled. Undo is also disabled when there are no moves.
- **The computer's move happens inside `POST /api/games/{id}/moves`**, on the server, and the response already contains it. If the human's move ends the game, the computer does not move.
- In Vs Computer mode **the human is always X and the computer is O**. X always starts, so a move sent as `"player": "O"` is rejected. One undo removes the computer's reply and your previous move, and it is X's turn again.
- **Reset keeps the game id and mode.** It clears the board, history and result, X moves first, and the scoreboard is untouched. **New Game** creates a new game, with a new id, in the selected mode. A mode change takes effect at the next New Game.
- **The scoreboard is global for the server process.** "Session-level" means the lifetime of the server: one scoreboard shared by every game and browser, and lost on restart. Reset Scoreboard does not touch any game.
- A win is checked before a draw, so a ninth move that completes a line is a **win**. If one move completes two lines, `winningCells` holds the first line found (rows, then columns, then diagonals).
- Rows and columns are **0-based in the API** and **1-based in the UI** ("Row 1, Column 1").
- A page refresh resumes the game saved for that browser tab. If the server no longer knows the game (for example after a restart), a new game starts automatically.

## Known limitations

- **No persistence.** Games and the scoreboard live in memory, so a restart (or a free-tier host going to sleep) loses them. Games nobody has used for 2 hours are removed.
- **One shared scoreboard.** Everyone using the same server shares it. There are no users, no authentication and no per-player statistics.
- **Single instance only.** State is per process, so the API cannot be scaled out without a shared store.
- **The computer is deliberately basic.** It follows the brief's fixed priority list and does not look ahead, so a fork beats it. For example, as X play Row 1 Col 1, Row 3 Col 3, Row 3 Col 1, then Row 2 Col 1 to win.
- **No real-time sync.** Two tabs showing the same game do not update each other until the next action or refresh.
- **No undo after a finished game** (Option A, by design).
- **No end-to-end browser tests in CI.** The UI is covered by component, store and service tests.
- The layout is built for laptop browsers and checked down to about 500 px wide. Phone widths are not fully verified.

## Future improvements

- Persist games and the scoreboard (SQLite or PostgreSQL with EF Core) behind the existing `IGameRepository`, and keep per-player or per-session scoreboards.
- Add players and authentication, plus real-time two-device play with SignalR.
- Offer a stronger computer (minimax) as a selectable difficulty, keeping the brief's rule-based mode as "Easy".
- Offer Option B as a setting (undo after completion, with the scoreboard adjusted).
- Add Playwright end-to-end tests and coverage reporting to CI.
- Add observability with OpenTelemetry traces and metrics, plus structured logs.
- Use a distributed cache (for example Redis) for game state so the API can run as several instances.

## Screenshots

> **To do before submission.** Take these screenshots with both servers running (see Quick start at the top), in a browser window about 1280×800, using **Win+Shift+S** (Snipping Tool). Save each one as PNG in `docs/screenshots/` with the exact file name below. Create the folder with `New-Item -ItemType Directory -Force docs\screenshots`. The image links below work once the files exist, on GitHub and in the review portal.

| File | What to capture |
|---|---|
| `01-overview.png` | <http://localhost:4200/>: the Overview page (hero, "How to review in 5 minutes"). |
| `02-two-player-in-progress.png` | `/play`, **Two Player**, **New Game**, then click Row 2 Col 2, Row 1 Col 1, Row 1 Col 3. The status reads "Player O's turn" and the history has 3 moves. |
| `03-x-wins-highlighted.png` | **New Game** (Two Player): Row 1 Col 1, Row 2 Col 1, Row 1 Col 2, Row 2 Col 2, Row 1 Col 3. The screenshot shows "Player X wins!", the highlighted top row, X wins = 1 and Undo disabled. |
| `04-draw.png` | **Reset Game**, then Row 1 Col 1, Row 1 Col 2, Row 1 Col 3, Row 2 Col 2, Row 3 Col 2, Row 2 Col 3, Row 2 Col 1, Row 3 Col 1, Row 3 Col 3. The screenshot shows "It's a draw!" and Draws = 1. |
| `05-vs-computer-undo.png` | Select **Vs Computer** and press **New Game**. Click Row 1 Col 1 (the computer takes Row 2 Col 2), then Row 1 Col 2 (the computer blocks at Row 1 Col 3), then **Undo Last Move**. The screenshot shows 2 moves left and "Your turn (X)". |
| `06-docs-portal.png` | <http://localhost:4200/docs/api>: the docs viewer with its sidebar and "On this page" list. |
| `07-swagger.png` | <http://localhost:5000/swagger> with `POST /api/games/{id}/moves` expanded. |

![Overview page](docs/screenshots/01-overview.png)
![Two Player game in progress](docs/screenshots/02-two-player-in-progress.png)
![X wins with the winning cells highlighted](docs/screenshots/03-x-wins-highlighted.png)
![Draw](docs/screenshots/04-draw.png)
![Vs Computer after Undo](docs/screenshots/05-vs-computer-undo.png)
![Documentation portal](docs/screenshots/06-docs-portal.png)
![Swagger UI](docs/screenshots/07-swagger.png)

---

## Review portal & documentation index

The portal (locally <http://localhost:4200>; once deployed, <https://intellectwithvivek.github.io/ABB/>) shows each document below at `/docs/<page>`. The links here open the same files on GitHub.

| Document | Portal page | What it covers |
|---|---|---|
| [README.md](README.md) | `/docs/readme` | This file: overview, how to run, tests, assumptions, limitations. |
| [PROBLEM_STATEMENT.md](docs/PROBLEM_STATEMENT.md) | `/docs/problem-statement` | The official brief, transcribed to Markdown. The original is [Round-2-Problem-Statement.docx](docs/assets/Round-2-Problem-Statement.docx). |
| [TRACEABILITY.md](docs/TRACEABILITY.md) | `/docs/traceability` | Every requirement of the brief mapped to its code and tests. |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | `/docs/architecture` | How the Angular SPA, the ASP.NET Core API and TicTacToe.Core fit together. |
| [API.md](docs/API.md) | `/docs/api` | REST endpoints, JSON contract, status codes, errors, configuration, curl smoke test. |
| [DECISIONS.md](docs/DECISIONS.md) | `/docs/decisions` | Design decisions, trade-offs and the alternatives considered. |
| [TESTING.md](docs/TESTING.md) | `/docs/testing` | What the backend and frontend suites cover and how to run them. |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | `/docs/deployment` | Docker, GitHub Pages + Render, Vercel and DigitalOcean, step by step. |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | `/docs/contributing` | Project structure, coding conventions and the checks every change must pass. |
| [AI_WORKFLOW.md](docs/AI_WORKFLOW.md) | `/docs/ai-workflow` | How AI tools were used, the prompts, and what was reviewed and changed. |
| [SPEC_PROMPT.md](docs/SPEC_PROMPT.md) | `/docs/spec-prompt` | The specification prompt I wrote, recorded verbatim. |
| [PANEL_QA.md](docs/PANEL_QA.md) | `/docs/panel-qa` | Likely panel questions with short answers grounded in this codebase. |

## Repository structure

```text
ABB/
├── README.md
├── docs/                         documentation (also rendered by the review portal); screenshots/ for the README
├── backend/
│   ├── TicTacToe.sln             global.json, nuget.config, Directory.Build.props, Directory.Packages.props, Dockerfile
│   ├── TicTacToe.Core/           game rules, no ASP.NET: Domain/ Engine/ Opponents/ Sessions/ Scoring/
│   ├── TicTacToe.Api/            REST API: Controllers/ Application/ Contracts/ Mapping/ Infrastructure/
│   │                             ErrorHandling/ Configuration/ Extensions/ Program.cs
│   └── TicTacToe.Tests/          xUnit: Core/ (mirrors Core), Api/ (Application, Infrastructure, Integration), TestSupport/
├── frontend/                     Angular 21 workspace; Dockerfile, nginx.conf, scripts/copy-docs.mjs
│   └── src/app/
│       ├── core/                 app-wide: config token, HTTP error mapping, header/footer/404, page titles
│       ├── shared/ui/            reusable UI (error toast)
│       └── features/             home/ (overview), game/ (play), docs/ (hub, viewer, Markdown rendering)
├── .github/                      CI and GitHub Pages workflows, Dependabot, pull request template
├── docker-compose.yml            API + web (nginx) on http://localhost:8080
└── vercel.json, render.yaml, .do/app.yaml, .editorconfig
```

## Deployment

The API is a standard container ([`backend/Dockerfile`](backend/Dockerfile): .NET 8, non-root, listens on `$PORT`, default 8080). The frontend is a static Angular build. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) has every step and setting.

| Option | Frontend | API | Configuration |
|---|---|---|---|
| **GitHub Pages + Render** (free, recommended) | GitHub Pages at `https://intellectwithvivek.github.io/ABB/` (`github-pages` build, base href `/ABB/`) | Render free web service built from `backend/Dockerfile` (`https://tictactoe-abb-api.onrender.com`) | `.github/workflows/deploy-pages.yml`, `render.yaml` |
| **Vercel** | Vercel static build | Any API host; Vercel rewrites `/api` and `/swagger` to it (same origin) | `vercel.json` |
| **DigitalOcean App Platform** | Static site | Docker service on the same domain (no CORS needed) | `.do/app.yaml` |
| **Docker Compose** | nginx serving the build and proxying `/api` and `/swagger` | API container | `docker-compose.yml` |

Run everything locally in containers (needs Docker Desktop):

```powershell
docker compose up --build
```

Then open <http://localhost:8080>. For a cross-origin frontend, set the API's allowed origin with an environment variable such as `Cors__AllowedOrigins__0=https://intellectwithvivek.github.io` (scheme and host only). On Render's free tier the API sleeps when idle: the first request can take about a minute, and in-memory games are lost.

## Contributing

Work on a branch and open a pull request against `main`. Keep `dotnet build` at 0 warnings, keep both test suites green, and run `npm run format` (frontend) and `dotnet format` (backend) before you commit. CI runs the same checks. Conventions, project structure and the pull request checklist are in **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)**.
