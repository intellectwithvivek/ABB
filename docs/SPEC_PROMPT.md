# Prompt for Claude Code — ABB Senior Software Engineer Assessment (Tic Tac Toe)

You are working inside an empty folder that will become a GitHub repository. Build the complete solution described below, end to end, in the phases given, committing after each phase. Do not stop to ask me questions unless something would otherwise block you completely; instead make a sensible decision, record it in `docs/DECISIONS.md`, and keep going. At the end, everything must run locally with the exact commands written in the README.

I am a React/TypeScript/Java developer. I am less experienced with Angular and .NET, so write the code in a clean, idiomatic, easy-to-read style and explain non-obvious Angular/.NET choices in short code comments and in the docs so I can defend every line in a panel review.

---

## 1. The assignment (verbatim requirements)

Build a browser-based Tic Tac Toe application with an Angular frontend and a .NET backend running locally. The application must allow users to play Tic Tac Toe, track moves, undo moves, maintain a scoreboard, and support a basic computer opponent mode. The backend owns all game state. The solution must be easy for a review panel to run, review, and discuss.

**Stack (fixed, do not substitute):**
- Frontend: Angular (latest stable, standalone components) + TypeScript
- Backend: .NET 8 Web API (C#), REST
- Storage: in-memory (singleton service with thread-safe dictionary); no database
- Source control: Git, GitHub-ready

**Functional requirements:**
1. Game board — 3×3 grid; empty cells clickable; a played cell shows X or O and stays locked.
2. Player turns — Player X and Player O; UI clearly shows whose turn it is; turns alternate only after a valid move; invalid moves do not change the turn.
3. Win detection — any full row, column, or diagonal. On win: show the winner, highlight the winning cells, block further moves, update the scoreboard.
4. Draw detection — all 9 cells filled with no winner. On draw: show a draw message, block further moves, update the scoreboard.
5. Reset Game — clears board, move history, winner/draw status; sets current player back to X; starts a fresh game session; scoreboard unchanged.

**Must-haves:**
1. Move history for the current game, displayed as a table: Move number, Player, Position (e.g. "Row 1, Column 1"). Updates after every valid move.
2. Undo Last Move — restores the previous valid state: restores the board, restores the correct turn, recalculates win/draw status, keeps history accurate. Disabled when there is nothing to undo.
   - Two Player Mode: Undo removes only the most recent move (X plays, O plays, Undo → O's move removed, it is O's turn).
   - Computer Mode: Undo removes the computer's last move AND the human's previous move together (X plays, O computer plays, Undo → both removed, it is X's turn).
3. Scoreboard — session-level, served by the backend: X wins, O wins, Draws. Updates exactly once per completed game. Reset Game leaves it unchanged. Separate Reset Scoreboard action.
4. Computer Mode — two modes: Two Player, Play Against Computer. In Computer Mode the human is X, the computer is O; the computer moves automatically after each human move, makes only valid moves, and never moves after the game is complete. Priority order:
   1. If O can win, play the winning move
   2. If X can win next, block X
   3. Take center if available
   4. Take a corner if available
   5. Take any available cell

**Backend requirements:** REST APIs for all game operations; backend owns game session state, move history, game status, scoreboard; backend validates every move and rejects: move outside the board, move on an occupied cell, move after game completion, move by the wrong player (return 400 with a clear error message body).

**API (use exactly these):**
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/games | Create a new game session (body: `{ "mode": "TwoPlayer" \| "VsComputer" }`) |
| GET | /api/games/{id} | Get current game state |
| POST | /api/games/{id}/moves | Submit a move (body: `{ "player": "X"\|"O", "row": 0-2, "col": 0-2 }`) |
| POST | /api/games/{id}/undo | Undo last move (per mode rules) |
| POST | /api/games/{id}/reset | Reset the current game (same id, same mode, scoreboard untouched) |
| GET | /api/scoreboard | Get scoreboard |
| POST | /api/scoreboard/reset | Reset scoreboard |

**Game state response** must include: gameId, board (3×3 array of "X"/"O"/null), currentPlayer, mode, status (`InProgress` | `Won` | `Draw`), winner (or null), winningCells (array of {row, col}, empty if none), moveHistory (array of {moveNumber, player, row, col}), scoreboard {xWins, oWins, draws}. Every mutating endpoint returns the full updated game state so the frontend never computes rules itself.

**Frontend requirements:** clean, usable UI showing: game board, current player, selected game mode (selector before/at new game), winner or draw message, highlighted winning cells, move history table, scoreboard, Reset Game, Undo Last Move, Reset Scoreboard, and a mode selector / New Game control. The frontend calls the backend for every action and renders only the state the backend returns. Responsive enough for a laptop browser. Show API error messages (e.g. invalid move) in a small non-blocking toast/banner.

**Clarifications (decided — implement exactly this):**
- Backend is the single source of truth. Frontend holds only UI state (loading flags, selected mode, error message).
- Undo after completion: **Option A — Undo is disabled once a game is Won or Drawn.** The scoreboard is final for that game. State this in the README.
- In Computer Mode the computer's move happens inside the same `POST /moves` request, server-side, and the returned state already includes it. If the human's move ends the game, the computer does not move.
- In Computer Mode, if the human has made exactly one move and Undo is pressed (history has X then O), both are removed. Undo is disabled when history is empty.
- One game "session" = one game id. Reset keeps the same id and mode. The scoreboard is global for the server process (session-level = server lifetime).

---

## 2. Repository layout

```
tictactoe-abb/
  README.md
  .gitignore
  docs/
    API.md                 # full API contract with request/response examples
    AI_WORKFLOW.md         # see section 5
    DECISIONS.md           # design decisions and trade-offs
    PANEL_QA.md            # see section 6
  backend/
    TicTacToe.sln
    TicTacToe.Api/         # ASP.NET Core Web API (controllers, DTOs, Program.cs, CORS, Swagger)
    TicTacToe.Core/        # pure game logic: Board, GameEngine, ComputerPlayer, Scoreboard, GameSession — no ASP.NET dependencies
    TicTacToe.Tests/       # xUnit tests against TicTacToe.Core and the API service layer
  frontend/
    (Angular CLI workspace: app with components board, cell, move-history, scoreboard, status-bar, controls; a GameApiService; models/types)
```

Keep game rules entirely inside `TicTacToe.Core` so they are unit-testable without HTTP. The API project only maps HTTP ↔ Core. Use a singleton `IGameRepository` (in-memory, `ConcurrentDictionary<Guid, GameSession>`) and a singleton `IScoreboardService`. Use `lock` on a session for move/undo/reset to avoid races.

Backend runs on `http://localhost:5000` (set in `launchSettings.json` and `Properties`), Swagger at `/swagger`. Frontend runs on `http://localhost:4200`. Enable CORS for `http://localhost:4200`. Put the API base URL in Angular `environment.ts`.

---

## 3. Tests (required — all must pass)

Backend (xUnit, `TicTacToe.Tests`), one clearly named test per case, at minimum:
- Valid move is accepted and placed
- Invalid move: outside board (row/col -1 or 3) → rejected, turn unchanged
- Invalid move: occupied cell → rejected, turn unchanged
- Invalid move: wrong player → rejected, turn unchanged
- Move after game completion → rejected
- Turn switches after a valid move
- Row win detected with correct winning cells
- Column win detected with correct winning cells
- Diagonal win (both diagonals) detected with correct winning cells
- Draw detected when board full and no winner
- Reset game clears board/history/status, sets X, keeps scoreboard
- Undo in two-player mode removes one move and restores turn
- Undo in computer mode removes two moves and restores X's turn
- Undo disabled/rejected when there are no moves, and when game is complete (Option A)
- Scoreboard increments exactly once per completed game (win and draw), and not again after Reset Game
- Reset scoreboard zeroes all counters
- Computer move selection: one test per priority rule (wins when it can, blocks when X threatens, takes center, takes a corner, takes any remaining cell), plus "computer does not move after game over"

Frontend (Angular default test runner): at least component rendering tests for the board (renders 9 cells, shows X/O, highlights winning cells, disables cells when game over) and a `GameApiService` test using `HttpClientTestingModule` for create-game and submit-move.

---

## 4. Build in these phases, committing after each with a clear message

1. **Scaffold** — `.gitignore` (dotnet + node), solution/projects, Angular workspace, README skeleton, docs stubs. Commit: `chore: scaffold backend, frontend and docs`.
2. **Core game logic** — Board, GameEngine (apply move, validate, win/draw detection, undo), ComputerPlayer, Scoreboard, GameSession. Commit.
3. **Core tests** — all backend tests above; run `dotnet test` and make them green. Commit.
4. **Web API** — controllers, DTOs, mapping, error responses, CORS, Swagger, launch settings. Smoke-test with `curl` and paste the output into `docs/API.md`. Commit.
5. **Angular UI** — components, service, models, styling (simple, clean CSS, no UI library needed), error toast, loading state. Commit.
6. **Frontend tests** — as above, run and make green. Commit.
7. **Docs** — README, API.md, DECISIONS.md, AI_WORKFLOW.md, PANEL_QA.md. Commit.
8. **Final verification** — from a clean clone in a temp folder, follow only the README commands and confirm backend, frontend and both test suites work. Fix anything that fails. Commit: `docs: final verification`.

At the end print a checklist mapping every acceptance criterion from the assignment to where it is implemented and which test covers it.

---

## 5. `docs/AI_WORKFLOW.md` — required content

The reviewers will ask how I used AI. Write this file honestly in first person as me (the candidate), covering:
- How the requirement was converted into a specification (reference this prompt file: `docs/SPEC_PROMPT.md` — copy this entire prompt into that file verbatim as the record of the spec I wrote)
- The prompts used (this spec plus any follow-up prompts you needed during development — log each one you effectively acted on, in order, with a one-line purpose)
- What the AI generated (list by area: core logic, tests, API, UI, docs)
- What I changed or should change manually — list concrete places where a human must review and why (e.g. computer-player priority correctness, undo pair logic in computer mode, scoreboard double-count guard, CORS origin, error handling). Be specific with file paths.
- Which parts were reviewed most carefully and why
- Assumptions made (list every one you made while building)
- Trade-offs chosen (in-memory vs SQLite, Option A undo, computer move inside the move request vs separate endpoint, standalone components, full-state responses vs deltas, etc.) with the alternative and the reason

---

## 6. `docs/PANEL_QA.md` — required content

Write 25–35 likely panel questions with concise, accurate answers grounded in THIS codebase (quote file paths and method names). Group them:
- Architecture & state ownership (why backend is source of truth, how sessions are stored, what happens on server restart, concurrency)
- Game logic (how win detection works, how undo restores state, how the computer picks a move, how double scoreboard updates are prevented)
- API design (why full state is returned, status codes, validation, idempotency of reset)
- Angular (standalone components, service + HttpClient, change detection/signals or observables used, how errors are shown)
- .NET (DI lifetimes used and why, controller vs minimal API choice, DTO mapping)
- Testing (what is covered, what is not, how to extend)
- AI usage (the questions from section 5, answered briefly)
- "What would you do with more time" (persistence, auth/multiplayer, minimax AI, Docker compose, CI)
Also include a 60-second verbal walkthrough script I can use to open the review.

---

## 7. README.md — required sections, in this order

Project overview · Tech stack · Features implemented · Prerequisites (exact versions: .NET 8 SDK, Node LTS, Angular CLI) · How to run the backend locally · How to run the frontend locally · API endpoint summary (table + link to docs/API.md) · How to run tests (backend and frontend) · AI tools and prompt summary (short, link to docs/AI_WORKFLOW.md) · Design decisions (link to docs/DECISIONS.md) · Clarifications and assumptions (state Option A explicitly) · Known limitations · Future improvements · Screenshot placeholder section (tell me exactly which screenshots to take and where to save them).

Every command in the README must be copy-pasteable on Windows (PowerShell) — I am on Windows. Add a one-line "quick start" at the top: two terminals, two commands each.

---

## 8. Quality bar

- No warnings on `dotnet build`; `ng build` clean.
- Nullable enabled in C#; strict mode in TypeScript.
- Small files, single responsibility, meaningful names, no dead code, no commented-out code.
- Comments only where they explain *why*.
- The UI must look intentional: centered layout, clear typography, visible hover/disabled states, winning cells visibly highlighted, current player and status prominent.

Start now with Phase 1.
