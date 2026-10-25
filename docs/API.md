# API contract

The Tic Tac Toe backend is a REST API (ASP.NET Core 8, controllers). It owns all game state: the frontend sends
every action to it and renders only the state it returns.

## Base URLs

| Environment | API base URL | Swagger UI | Health check |
|---|---|---|---|
| Local | `http://localhost:5000/api` | `http://localhost:5000/swagger` | `http://localhost:5000/health` |
| Live, through the site's proxy | https://tictactoe-abb.vercel.app/api | https://tictactoe-abb.vercel.app/swagger | not proxied; use the API host |
| Live API host | https://tictactoe-abb-api.onrender.com/api | https://tictactoe-abb-api.onrender.com/swagger | https://tictactoe-abb-api.onrender.com/health |

- The site on Vercel forwards `/api/*` and `/swagger*` to the API host on Render ([vercel.json](../vercel.json)), so the
  browser stays on one origin and the live site needs no CORS.
- The OpenAPI document is at `/swagger/v1/swagger.json`. Swagger UI is served in every environment while
  `Swagger:Enabled` is `true` (the default).
- The API host runs on Render's free plan: after 15 idle minutes it sleeps, and the next request takes about a
  minute. While it is waking up or unavailable, the proxy can answer 502, 503 or 504; the UI then shows "The game
  server is starting up or temporarily unavailable. Please try again in a moment." A restart or redeploy clears
  every game and the scoreboard.

## Overview

| | |
|---|---|
| Authentication | none |
| CORS | `http://localhost:4200` (the Angular dev server) is allowed for local development; configured in `backend/TicTacToe.Api/appsettings.json` under `Cors:AllowedOrigins` |
| Rate limit | 300 requests per 60 seconds per client IP address, of which at most 30 may create a game; above that, **429** (see [Rate limiting](#rate-limiting)) |
| Storage | in memory on a single instance; every game and the scoreboard are lost when the server restarts. A game nobody has used for 2 hours is removed (see [Idle games](#idle-games)). State sits behind `IGameRepository` and `IScoreboardService`, so a shared store such as Redis or SQL can replace it for multi-instance hosting |

Every setting above can be changed without code; see [Configuration](#configuration).

**JSON conventions**

- Property names are **camelCase** (`gameId`, `currentPlayer`, `xWins`).
- Enums are **strings**: `"X"` / `"O"`, `"TwoPlayer"` / `"VsComputer"`, `"InProgress"` / `"Won"` / `"Draw"`.
  Numbers are rejected for enum fields (`"player": 0` is a 400, and so is a number written as a string, `"mode": "2"`),
  so a typo can never select a value by accident.
  When reading a request the names are matched case-insensitively (`"x"` is accepted as `"X"`); responses always use the casing above.
- `row` and `col` are **0-based** (0, 1, 2). The UI shows them 1-based ("Row 1, Column 1").
- An empty board cell is `null`.
- **Every game endpoint returns the full `GameState`**, including the scoreboard, so the client never has to
  compute rules (turn, winner, whether undo is allowed) itself.
- Successful responses are `application/json`; errors are `application/problem+json` (RFC 7807).

## Endpoints

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/games` | `{ "mode": "TwoPlayer" \| "VsComputer" }` | **201** `GameState` + `Location` | 400 |
| GET | `/api/games/{id}` | none | 200 `GameState` | 404 |
| POST | `/api/games/{id}/moves` | `{ "player": "X" \| "O", "row": 0-2, "col": 0-2 }` | 200 `GameState` | 400, 404 |
| POST | `/api/games/{id}/undo` | none | 200 `GameState` | 400, 404 |
| POST | `/api/games/{id}/reset` | none | 200 `GameState` | 404 |
| GET | `/api/scoreboard` | none | 200 `Scoreboard` | none |
| POST | `/api/scoreboard/reset` | none | 200 `Scoreboard` | none |
| GET | `/health` | none | 200 `Healthy` (text/plain) | none |

`{id}` is the `gameId` GUID returned when the game was created. Every request except `GET /health` can also get **429** when its
client is over the [rate limit](#rate-limiting).

### POST /api/games — create a game

Request body:

```json
{ "mode": "VsComputer" }
```

- **201 Created** with the new game's `GameState` (empty board, X to move, `canUndo: false`, current scoreboard)
  and a `Location` header with the game's URL, e.g. `Location: http://localhost:5000/api/games/bb158153-15bb-4473-814c-696a0c7239ea`.
- **400** `ValidationProblemDetails` when `mode` is missing or is not `"TwoPlayer"` / `"VsComputer"`; no game is created.
- **429** when the client has already created 30 games in the current 60-second window (see [Rate limiting](#rate-limiting)).

### GET /api/games/{id} — get the current state

- **200 OK** with the `GameState`.
- **404** when no game has this id:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Game not found",
  "status": 404,
  "detail": "Game 'bb7efba1-bc17-4b8a-a5c2-3e67a1e601d5' was not found."
}
```

### POST /api/games/{id}/moves — submit a move

Request body (all three fields required):

```json
{ "player": "X", "row": 0, "col": 0 }
```

- **200 OK** with the updated `GameState`. In VsComputer mode the computer's reply is already applied in this
  response (see [Computer mode](#computer-mode)).
- **400** when the move breaks a rule (the game is unchanged and the turn does not change):

| Rule (checked in this order) | `detail` |
|---|---|
| The game has ended | `The game is already over. Reset the game or start a new one.` |
| Row or column outside 0-2 | `Row and column must be between 0 and 2 (got row 3, col 0).` |
| Not this player's turn | `It is X's turn, not O's.` |
| Cell already taken | `Cell (row 0, col 0) is already taken by X.` |

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Invalid move",
  "status": 400,
  "detail": "Cell (row 0, col 0) is already taken by X."
}
```

- **400** `ValidationProblemDetails` when the body is malformed: it is empty, a field is missing or `null`, `row` or
  `col` is not an integer, or `player` is not `"X"` / `"O"`. The game is unchanged. The `errors` map has one entry
  naming the problem; its message comes from ASP.NET Core / System.Text.Json, for example:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "$": ["JSON deserialization for type 'TicTacToe.Api.Contracts.Requests.SubmitMoveRequest' was missing required properties, including the following: col"]
  },
  "traceId": "00-512e315cee3404b3165095ced79cb955-7ad956439f2ff54f-00"
}
```

- **404** when no game has this id.

### POST /api/games/{id}/undo — undo the last move

No body.

- **200 OK** with the restored `GameState`: board, turn, status and history are exactly as before the undone move(s).
  Two Player mode removes one move; VsComputer mode removes the computer's reply and the human's move together.
- **400** `Undo is not available after the game has ended. Reset the game to play again.` when the game is Won or Draw (Option A).
- **400** `There are no moves to undo.` when the history is empty.
- **404** when no game has this id.

`canUndo` in the `GameState` tells the client in advance whether undo will be accepted.

### POST /api/games/{id}/reset — start the game over

No body. Clears the board, the move history and the winner/draw status and gives the turn back to X.
The game keeps its id and mode, and the scoreboard is unchanged. Resetting an already empty game returns the
same empty state, so the call is safe to repeat.

- **200 OK** with the fresh `GameState`.
- **404** when no game has this id.

### GET /api/scoreboard — get the scoreboard

- **200 OK**: `{ "xWins": 1, "oWins": 0, "draws": 0 }`

### POST /api/scoreboard/reset — reset the scoreboard

No body. Sets every counter to zero; games in progress are not touched.

- **200 OK** with the zeroed scoreboard: `{ "xWins": 0, "oWins": 0, "draws": 0 }`

### GET /health — health check

For the hosting platform to check that the app is alive (Render polls it: `healthCheckPath` in
[render.yaml](../render.yaml)). It is not under `/api` and is never rate limited, so a busy client cannot make the
platform think the app is down. On the live deployment it is served by the API host only.

- **200 OK**, `Content-Type: text/plain`, body `Healthy`

## Schemas

### GameState

Returned by every game endpoint. Properties appear in this order.

| Property | Type | Description |
|---|---|---|
| `gameId` | string (GUID) | Id of the game; stays the same across Reset. |
| `mode` | `"TwoPlayer"` \| `"VsComputer"` | Fixed when the game is created. |
| `board` | `Cell[3][3]` | Rows of cells: `board[row][col]`. |
| `currentPlayer` | `"X"` \| `"O"` | Whose turn it is. X always starts. After the final move it is still the next player in turn; check `status`. |
| `status` | `"InProgress"` \| `"Won"` \| `"Draw"` | |
| `winner` | `"X"` \| `"O"` \| `null` | Set only when `status` is `"Won"`. |
| `winningCells` | `Position[]` | The three cells of the winning line; `[]` unless `status` is `"Won"`. |
| `moveHistory` | `Move[]` | Every move of the current game, oldest first. |
| `canUndo` | boolean | `true` when the game is in progress and has at least one move. |
| `scoreboard` | `Scoreboard` | The server-wide totals at the time of the response. |

Example (a VsComputer game after X played (0,0) and the computer replied in the center):

```json
{
  "gameId": "bb158153-15bb-4473-814c-696a0c7239ea",
  "mode": "VsComputer",
  "board": [
    ["X", null, null],
    [null, "O", null],
    [null, null, null]
  ],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [
    { "moveNumber": 1, "player": "X", "row": 0, "col": 0 },
    { "moveNumber": 2, "player": "O", "row": 1, "col": 1 }
  ],
  "canUndo": true,
  "scoreboard": { "xWins": 1, "oWins": 0, "draws": 0 }
}
```

### Cell

`"X"`, `"O"` or `null` (empty).

### Position (`winningCells` items)

| Property | Type | Description |
|---|---|---|
| `row` | integer 0-2 | 0-based row |
| `col` | integer 0-2 | 0-based column |

### Move (`moveHistory` items)

| Property | Type | Description |
|---|---|---|
| `moveNumber` | integer | 1 for the first move of the game, then 2, 3, ... |
| `player` | `"X"` \| `"O"` | Who made the move |
| `row` | integer 0-2 | 0-based row |
| `col` | integer 0-2 | 0-based column |

### Scoreboard

| Property | Type | Description |
|---|---|---|
| `xWins` | integer | Games won by X |
| `oWins` | integer | Games won by O (in VsComputer mode, the computer) |
| `draws` | integer | Games that ended in a draw |

### Errors

All errors use RFC 7807 `application/problem+json`.

| Property | Present in | Description |
|---|---|---|
| `type` | all except 413 | Link to the HTTP status definition |
| `title` | all | Short summary: `"Invalid move"` (any broken game rule, undo included), `"Game not found"`, `"One or more validation errors occurred."` (malformed body), `"Too many requests"` (rate limit), `"Invalid request"` (body too large); otherwise the standard reason phrase, e.g. `"Not Found"` (unknown path), `"Method Not Allowed"`, `"Unsupported Media Type"` |
| `status` | all | The HTTP status code |
| `detail` | game-rule, not-found, rate-limit and body-too-large errors | The message to show the player |
| `errors` | malformed body only | One entry mapping the offending location to its messages: `""` for an empty or `null` body (`A non-empty request body is required.`), `"$"` when a required property is missing, `"$.mode"`, `"$.player"`, `"$.row"` or `"$.col"` when a value cannot be read. A number written as a string for an enum field is reported under the property name instead: `"Mode": ["mode must be \"TwoPlayer\" or \"VsComputer\"."]`, `"Player": ["player must be \"X\" or \"O\"."]` |
| `traceId` | malformed body, 415, 429 | Correlation id for the server log |

The frontend shows `detail`, else the first message in `errors`, else `title`.

| Status | When |
|---|---|
| 400 | A game rule is broken, or the request body is malformed |
| 404 | No game has the given id, or no route matches the path (for example an id that is not a GUID); the latter has `title` `"Not Found"` and no `detail` |
| 405 | The path exists but not for this method (for example `DELETE /api/scoreboard`) |
| 413 | The request body is larger than 4 KB (every valid body is under 100 bytes) |
| 415 | A request with a body is sent without `Content-Type: application/json` |
| 429 | The client sent more requests than the [rate limit](#rate-limiting) allows |
| 500 | Unexpected server error (logged; the response contains no internal details) |

## Rate limiting

The API is deployed as a public demo, so each client IP address may send at most **300 requests per
60-second window** (a fixed window, ASP.NET Core's built-in rate limiter). Normal play stays far below that.
At most **30** of those requests may be `POST /api/games`: every game stays in memory until it has been idle for
2 hours, so one client must not be able to fill the server's memory with games nobody plays.
`GET /health` and CORS preflight (`OPTIONS`) requests do not count. Over the limit, the request is rejected before it
reaches a controller with **429 Too Many Requests**, a `Retry-After` header (seconds, rounded up) and the usual
problem+json body (plain text if the request's `Accept` header rules out JSON, which browsers never do).
The CORS header is still present, so the frontend can read and show the message:

```text
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json; charset=utf-8
Access-Control-Allow-Origin: http://localhost:4200
Retry-After: 60

{"type":"https://tools.ietf.org/html/rfc6585#section-4","title":"Too many requests","status":429,"detail":"Too many requests. Please wait a moment and try again.","traceId":"00-…"}
```

Behind the hosting platform's proxy, the container image (`backend/Dockerfile`) sets
`ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`, so the client address is taken from the last entry of the proxy's
`X-Forwarded-For` header (one hop) instead of the proxy's own address. On the live deployment that hop is the Vercel
proxy, so visitors who reach the API through the same Vercel address share one limit; requests sent straight to the
API host are limited per client. The container must always run behind a proxy: without one, a client could choose
its own address by sending the header.

## Configuration

All settings live in `backend/TicTacToe.Api/appsettings.json` and are bound to typed classes in
`backend/TicTacToe.Api/Configuration/`. They are validated when the app starts: an invalid value (for example a
cleanup interval of `00:00:00`) stops startup with a message naming the setting, instead of failing later.

Any setting can be overridden with an environment variable: replace `:` with `__` (two underscores), and address list
items by index. For example `Cors__AllowedOrigins__0=https://app.example.com` replaces the first allowed origin, and
`Cors__AllowedOrigins__1=…` adds a second one.

| Key | Default | Meaning |
|---|---|---|
| `Cors:AllowedOrigins` | `["http://localhost:4200"]` | Browser origins allowed to call the API: scheme + host (+ port), no path, no trailing slash. At least one. |
| `Swagger:Enabled` | `true` | Serve Swagger UI at `/swagger` and the OpenAPI document at `/swagger/v1/swagger.json`, in every environment, so a deployed API documents itself. |
| `RateLimiting:PermitLimit` | `300` | Requests one client IP address may send per window (1 or more). |
| `RateLimiting:CreateGamePermitLimit` | `30` | Of those, how many may create a game (`POST /api/games`) per window (1 or more). |
| `RateLimiting:WindowSeconds` | `60` | Length of the rate-limit window in seconds (1 to 3600). |
| `Sessions:IdleTimeout` | `02:00:00` | A game no request has used for longer than this is removed (1 minute to 1 day). |
| `Sessions:CleanupInterval` | `00:10:00` | How often idle games are looked for (1 second to 1 day). |

The container image also reads `PORT` (the port to listen on, default `8080`), which platforms such as Render set.

## Rules the server enforces

All game rules live in `backend/TicTacToe.Core`; the API only translates HTTP to Core calls.

### Moves

- A move is validated in this order and the **first** failing rule is reported: game over → outside the board →
  wrong player → occupied cell. A rejected move changes nothing, so the turn stays the same.
- The turn passes after every valid move. It is derived from the number of moves (X on even counts, O on odd),
  so undo can never leave a stale turn.
- After every change the status is recalculated from the board: a completed row, column or diagonal is a win
  (checked before the draw, so a ninth move that completes a line wins); a full board without a line is a draw.

### Computer mode

- The human is X and the computer is O. X always starts, so between requests it is always X's turn; a move sent
  with `"player": "O"` is rejected with `It is X's turn, not O's.`
- The computer replies **inside the same** `POST /moves` request, and the response already contains both moves.
- If the human's move ends the game (win or draw), the computer does not move.
- The computer plays the first rule that applies: (1) complete its own line, (2) block X's line, (3) take the
  center, (4) take the first free corner in the order (0,0), (0,2), (2,0), (2,2), (5) take the first free cell
  row by row. It is deterministic.

### Undo

- **Option A: undo is rejected once a game is Won or Drawn.** The result is already on the scoreboard and stays final;
  use Reset to play again.
- Undo is rejected when there are no moves.
- Two Player mode: removes only the last move (X plays, O plays, undo → O's move removed, O's turn).
- VsComputer mode: removes the computer's reply and the human's move together (X plays, O replies, undo → both
  removed, X's turn).
- The response's `canUndo` reflects exactly these rules.

### Reset and scoreboard

- Reset keeps the game id and mode, clears everything else, gives the turn to X and leaves the scoreboard unchanged.
- The scoreboard is global for the server process and shared by every game.
- Each game's result is recorded **exactly once**, at the move that ends it: a finished game rejects further moves
  and undo, and the session also keeps an explicit "already recorded" flag that only Reset clears.
- Reset Scoreboard zeroes the counters and does not touch any game.

### Concurrency

- Requests for the same game run one at a time (a lock per game), so a double click cannot apply two moves to the
  same turn. Requests for different games run in parallel; the scoreboard is thread-safe.

### Idle games

- Games are kept in memory, so a background job removes the games that no request has used (created, read, moved,
  undone or reset) for longer than `Sessions:IdleTimeout` (2 hours), checking every `Sessions:CleanupInterval`
  (10 minutes). This keeps the memory of a public deployment bounded.
- Any request for a game counts as using it, so a game that is being played is never removed.
- A request for a removed game gets the usual **404** `Game '…' was not found.`; the scoreboard is not affected.

## Using the API from PowerShell

Windows PowerShell 5.1 has `curl` as an alias of `Invoke-WebRequest`, so either use `Invoke-RestMethod` or call the
real curl as `curl.exe`.

```powershell
$base = 'http://localhost:5000/api'   # or the live API: 'https://tictactoe-abb.vercel.app/api'

# Create a game ('TwoPlayer' or 'VsComputer') and keep its id.
$game = Invoke-RestMethod -Method Post -Uri "$base/games" -ContentType 'application/json' -Body (@{ mode = 'VsComputer' } | ConvertTo-Json)
$id = $game.gameId

# Play X at row 0, col 0. In VsComputer mode the computer's reply is already in the response.
$game = Invoke-RestMethod -Method Post -Uri "$base/games/$id/moves" -ContentType 'application/json' -Body (@{ player = 'X'; row = 0; col = 0 } | ConvertTo-Json)
$game.moveHistory | Format-Table

Invoke-RestMethod -Uri "$base/games/$id"
Invoke-RestMethod -Method Post -Uri "$base/games/$id/undo"
Invoke-RestMethod -Method Post -Uri "$base/games/$id/reset"
Invoke-RestMethod -Uri "$base/scoreboard"
Invoke-RestMethod -Method Post -Uri "$base/scoreboard/reset"
```

`Invoke-RestMethod` throws on a 4xx response. In Windows PowerShell 5.1 the problem+json body is read from the
response stream:

```powershell
try {
    Invoke-RestMethod -Method Post -Uri "$base/games/$id/moves" -ContentType 'application/json' -Body (@{ player = 'O'; row = 0; col = 0 } | ConvertTo-Json)
} catch {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    ($reader.ReadToEnd() | ConvertFrom-Json).detail   # e.g. It is X's turn, not O's.
}
```

With `curl.exe` in Windows PowerShell 5.1, escape the quotes inside the JSON body as `\"`
(PowerShell 7.3 and later pass them through without the backslashes):

```powershell
curl.exe -s -i -X POST http://localhost:5000/api/games -H "Content-Type: application/json" -d '{\"mode\":\"TwoPlayer\"}'
```

## Smoke test (curl)

Recorded on 2026-10-25 against the API running locally in the Development environment on `http://localhost:5000`,
as `dotnet run --project backend/TicTacToe.Api` starts it. The commands are shown in Bash syntax with
`BASE=http://localhost:5000`; in PowerShell, use `curl.exe` and escape the JSON quotes as shown above.

Game ids, the random unknown id and `traceId` values differ on every run. Each response shows the status line and
the `Content-Type`, `Location` and `Access-Control-*` headers; other headers, such as `Date` and `Server`, are left
out, and JSON bodies are pretty-printed. Rate limiting is covered by `RateLimitingTests` rather than this session.

```text
### 1. Swagger document is served (status code only)
$ curl -s -o /dev/null -w "%{http_code}\n" $BASE/swagger/v1/swagger.json
200

### 2. Create a Two Player game
$ curl -s -i -X POST $BASE/api/games -H "Content-Type: application/json" -d '{"mode":"TwoPlayer"}'
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: http://localhost:5000/api/games/5e2fb5c7-f6c7-46ff-92b3-149401b506d6

{
  "gameId": "5e2fb5c7-f6c7-46ff-92b3-149401b506d6",
  "mode": "TwoPlayer",
  "board": [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [],
  "canUndo": false,
  "scoreboard": { "xWins": 0, "oWins": 0, "draws": 0 }
}
$ GAME=5e2fb5c7-f6c7-46ff-92b3-149401b506d6   # gameId from the response above

### 3. X plays (0,0)
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":0,"col":0}'
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "5e2fb5c7-f6c7-46ff-92b3-149401b506d6",
  "mode": "TwoPlayer",
  "board": [
    ["X", null, null],
    [null, null, null],
    [null, null, null]
  ],
  "currentPlayer": "O",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [
    { "moveNumber": 1, "player": "X", "row": 0, "col": 0 }
  ],
  "canUndo": true,
  "scoreboard": { "xWins": 0, "oWins": 0, "draws": 0 }
}

### 4. O plays (1,1)
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"O","row":1,"col":1}'
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "5e2fb5c7-f6c7-46ff-92b3-149401b506d6",
  "mode": "TwoPlayer",
  "board": [
    ["X", null, null],
    [null, "O", null],
    [null, null, null]
  ],
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

### 5. X plays the occupied cell (0,0) -> 400
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":0,"col":0}'
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Invalid move",
  "status": 400,
  "detail": "Cell (row 0, col 0) is already taken by X."
}

### 6. O plays although it is X's turn -> 400
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"O","row":2,"col":2}'
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Invalid move",
  "status": 400,
  "detail": "It is X's turn, not O's."
}

### 7. Row 3 is outside the board -> 400
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":3,"col":0}'
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Invalid move",
  "status": 400,
  "detail": "Row and column must be between 0 and 2 (got row 3, col 0)."
}

### 8. Body without "col" -> 400 validation problem
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":0}'
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "$": ["JSON deserialization for type 'TicTacToe.Api.Contracts.Requests.SubmitMoveRequest' was missing required properties, including the following: col"]
  },
  "traceId": "00-512e315cee3404b3165095ced79cb955-7ad956439f2ff54f-00"
}

### 9. Undo (Two Player): O's move is removed and it is O's turn again
$ curl -s -i -X POST $BASE/api/games/$GAME/undo
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "5e2fb5c7-f6c7-46ff-92b3-149401b506d6",
  "mode": "TwoPlayer",
  "board": [
    ["X", null, null],
    [null, null, null],
    [null, null, null]
  ],
  "currentPlayer": "O",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [
    { "moveNumber": 1, "player": "X", "row": 0, "col": 0 }
  ],
  "canUndo": true,
  "scoreboard": { "xWins": 0, "oWins": 0, "draws": 0 }
}

### 10. Reset the game: same id and mode, empty board, X to move
$ curl -s -i -X POST $BASE/api/games/$GAME/reset
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "5e2fb5c7-f6c7-46ff-92b3-149401b506d6",
  "mode": "TwoPlayer",
  "board": [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [],
  "canUndo": false,
  "scoreboard": { "xWins": 0, "oWins": 0, "draws": 0 }
}

### 11. Get the game
$ curl -s -i $BASE/api/games/$GAME
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "5e2fb5c7-f6c7-46ff-92b3-149401b506d6",
  "mode": "TwoPlayer",
  "board": [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [],
  "canUndo": false,
  "scoreboard": { "xWins": 0, "oWins": 0, "draws": 0 }
}

### 12. X wins on row 0: X(0,0) O(1,0) X(0,1) O(1,1), then X(0,2)
$ curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":0,"col":0}'
200
$ curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"O","row":1,"col":0}'
200
$ curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":0,"col":1}'
200
$ curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"O","row":1,"col":1}'
200
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":0,"col":2}'
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "5e2fb5c7-f6c7-46ff-92b3-149401b506d6",
  "mode": "TwoPlayer",
  "board": [
    ["X", "X", "X"],
    ["O", "O", null],
    [null, null, null]
  ],
  "currentPlayer": "O",
  "status": "Won",
  "winner": "X",
  "winningCells": [
    { "row": 0, "col": 0 },
    { "row": 0, "col": 1 },
    { "row": 0, "col": 2 }
  ],
  "moveHistory": [
    { "moveNumber": 1, "player": "X", "row": 0, "col": 0 },
    { "moveNumber": 2, "player": "O", "row": 1, "col": 0 },
    { "moveNumber": 3, "player": "X", "row": 0, "col": 1 },
    { "moveNumber": 4, "player": "O", "row": 1, "col": 1 },
    { "moveNumber": 5, "player": "X", "row": 0, "col": 2 }
  ],
  "canUndo": false,
  "scoreboard": { "xWins": 1, "oWins": 0, "draws": 0 }
}

### 13. Move after the win -> 400
$ curl -s -i -X POST $BASE/api/games/$GAME/moves -H "Content-Type: application/json" -d '{"player":"O","row":2,"col":2}'
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Invalid move",
  "status": 400,
  "detail": "The game is already over. Reset the game or start a new one."
}

### 14. Undo after the win -> 400 (Option A)
$ curl -s -i -X POST $BASE/api/games/$GAME/undo
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Invalid move",
  "status": 400,
  "detail": "Undo is not available after the game has ended. Reset the game to play again."
}

### 15. Create a Vs Computer game
$ curl -s -i -X POST $BASE/api/games -H "Content-Type: application/json" -d '{"mode":"VsComputer"}'
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: http://localhost:5000/api/games/bb158153-15bb-4473-814c-696a0c7239ea

{
  "gameId": "bb158153-15bb-4473-814c-696a0c7239ea",
  "mode": "VsComputer",
  "board": [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [],
  "canUndo": false,
  "scoreboard": { "xWins": 1, "oWins": 0, "draws": 0 }
}
$ CPU_GAME=bb158153-15bb-4473-814c-696a0c7239ea   # gameId from the response above

### 16. X plays (0,0); the response already contains the computer's reply (O takes the center)
$ curl -s -i -X POST $BASE/api/games/$CPU_GAME/moves -H "Content-Type: application/json" -d '{"player":"X","row":0,"col":0}'
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "bb158153-15bb-4473-814c-696a0c7239ea",
  "mode": "VsComputer",
  "board": [
    ["X", null, null],
    [null, "O", null],
    [null, null, null]
  ],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [
    { "moveNumber": 1, "player": "X", "row": 0, "col": 0 },
    { "moveNumber": 2, "player": "O", "row": 1, "col": 1 }
  ],
  "canUndo": true,
  "scoreboard": { "xWins": 1, "oWins": 0, "draws": 0 }
}

### 17. Undo (Vs Computer): both moves are removed and it is X's turn
$ curl -s -i -X POST $BASE/api/games/$CPU_GAME/undo
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "gameId": "bb158153-15bb-4473-814c-696a0c7239ea",
  "mode": "VsComputer",
  "board": [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ],
  "currentPlayer": "X",
  "status": "InProgress",
  "winner": null,
  "winningCells": [],
  "moveHistory": [],
  "canUndo": false,
  "scoreboard": { "xWins": 1, "oWins": 0, "draws": 0 }
}

### 18. Get the scoreboard
$ curl -s -i $BASE/api/scoreboard
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{ "xWins": 1, "oWins": 0, "draws": 0 }

### 19. Reset the scoreboard
$ curl -s -i -X POST $BASE/api/scoreboard/reset
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{ "xWins": 0, "oWins": 0, "draws": 0 }

### 20. Unknown game id -> 404
$ UNKNOWN=bb7efba1-bc17-4b8a-a5c2-3e67a1e601d5   # a random GUID
$ curl -s -i $BASE/api/games/$UNKNOWN
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Game not found",
  "status": 404,
  "detail": "Game 'bb7efba1-bc17-4b8a-a5c2-3e67a1e601d5' was not found."
}

### 21. CORS preflight from the Angular dev server
$ curl -s -i -X OPTIONS $BASE/api/games -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
HTTP/1.1 204 No Content
Access-Control-Allow-Headers: content-type
Access-Control-Allow-Methods: POST
Access-Control-Allow-Origin: http://localhost:4200

### 22. Health check
$ curl -s -i $BASE/health
HTTP/1.1 200 OK
Content-Type: text/plain

Healthy
```
