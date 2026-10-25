# Deployment

How the live system is hosted, how to recreate it from this repository, which settings exist, and how to diagnose problems. Nothing in the code changes between local development and production.

## Live topology

| Part | Host | URL | Defined by |
|---|---|---|---|
| Review portal: the Angular app and the rendered docs | Vercel project at the repository root | <https://tictactoe-abb.vercel.app> | [`vercel.json`](../vercel.json) |
| API: `TicTacToe.Api` in a Docker container | Render web service `tictactoe-abb-api` (free instance) | <https://tictactoe-abb-api.onrender.com> (`/health`, `/swagger`) | [`render.yaml`](../render.yaml), [`backend/Dockerfile`](../backend/Dockerfile) |

```text
Browser ──► https://tictactoe-abb.vercel.app                Vercel: static Angular build + docs
              │  /api/*, /swagger*  (server-side rewrite)
              └──────────────────────► https://tictactoe-abb-api.onrender.com
                                         Render: Docker image of TicTacToe.Api, one instance
```

The browser only ever talks to the Vercel domain. Vercel forwards `/api` and `/swagger` to Render on the server side, so production makes no cross-origin calls and needs no CORS setting. The frontend learns where the API is from its build configuration:

| Build | Environment file | `apiBaseUrl` | Used by |
|---|---|---|---|
| `development` (`npm start`) | [`environment.ts`](../frontend/src/environments/environment.ts) | `http://localhost:5000/api` | Local development |
| `production` (`npm run build`) | [`environment.production.ts`](../frontend/src/environments/environment.production.ts) | `/api` (same origin) | Vercel |

## Deploy the API on Render

Deploy the API first: its URL is the rewrite destination in `vercel.json`.

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with GitHub.
2. Click **New** → **Blueprint** and connect the repository `intellectwithvivek/ABB`.
3. Render reads [`render.yaml`](../render.yaml) and proposes one web service, `tictactoe-abb-api`:
   - runtime Docker, built from `./backend/Dockerfile` with `./backend` as the build context;
   - plan Free, branch `main`, health check `/health`;
   - `autoDeployTrigger: checksPass` and a `buildFilter` on `backend/**` (see [Operational notes](#operational-notes)).
4. Click **Apply**. The first Docker build takes a few minutes. No environment variables are needed: the defaults in `appsettings.json` suit production.
5. Check the service:

   ```powershell
   curl.exe https://tictactoe-abb-api.onrender.com/health
   ```

   It returns `Healthy`; <https://tictactoe-abb-api.onrender.com/swagger> shows the API reference.

The service name becomes the subdomain. If Render assigns a different URL (for example with a suffix), change the three Render destinations in `vercel.json` and push.

## Deploy the web app on Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub, then click **Add New…** → **Project**.
2. Next to `intellectwithvivek/ABB`, click **Import**.
3. Set **Root Directory** to `./` (the repository root, where `vercel.json` lives) and **Framework Preset** to **Other**. Do not override the build settings; `vercel.json` provides them:

   | Setting | Value |
   |---|---|
   | Install command | `npm ci --prefix frontend` |
   | Build command | `npm run build --prefix frontend` (its `prebuild` step copies `README.md` and `docs/` into the site) |
   | Output directory | `frontend/dist/tictactoe-web/browser` |

4. Click **Deploy**. The production URL is <https://tictactoe-abb.vercel.app>, and every push to `main` redeploys it.
5. Check the site: open `/`, `/play` (play a game), `/docs/api` (a deep link) and `/swagger`, then:

   ```powershell
   curl.exe https://tictactoe-abb.vercel.app/api/scoreboard
   ```

The rewrites in `vercel.json`:

| Source | Destination | Purpose |
|---|---|---|
| `/api/:path*` | `https://tictactoe-abb-api.onrender.com/api/:path*` | API calls |
| `/swagger`, `/swagger/:path*` | the same paths on Render | Swagger UI and the OpenAPI document |
| `/(.*)` | `/index.html` | SPA fallback, so deep links and refreshes such as `/docs/api` load the app |

Vercel serves existing build files first and applies rewrites only to other paths, so the catch-all never hides a real asset.

## Configuration reference

The API reads every `appsettings.json` key from environment variables as well: replace `:` with `__` (two underscores) and address list items by index. Values are validated at startup; an invalid value stops the app with a message that names the setting. On Render, set variables under the service's **Environment** tab; saving restarts the service.

| Variable | Default | Meaning |
|---|---|---|
| `Cors__AllowedOrigins__N` | `http://localhost:4200` (index 0) | **Local development only.** Browser origins allowed to call the API cross-origin, as `scheme://host[:port]` with no path or trailing slash. Production needs none, because the Vercel proxy keeps the browser on one origin. |
| `Swagger__Enabled` | `true` | Serve Swagger UI at `/swagger` and the OpenAPI document at `/swagger/v1/swagger.json`. |
| `RateLimiting__PermitLimit` | `300` | Requests per client address per window; above it the API returns 429. |
| `RateLimiting__CreateGamePermitLimit` | `30` | Of those, how many may create a game (`POST /api/games`). |
| `RateLimiting__WindowSeconds` | `60` | Window length in seconds (1 to 3600). |
| `Sessions__IdleTimeout` | `02:00:00` | A game unused for this long is removed from memory (1 minute to 1 day). |
| `Sessions__CleanupInterval` | `00:10:00` | How often idle games are looked for (1 second to 1 day). |
| `PORT` | `8080` | Port the container listens on. Render sets it. |

The full key list in `appsettings.json` form is in [API → Configuration](API.md#configuration). The frontend has no runtime settings: the API URL is fixed per build configuration (above), and the rewrite destinations live in `vercel.json`.

## Operational notes

- **Cold starts.** Render's free instance sleeps after 15 minutes without traffic. The next request wakes it, which takes about a minute. Open `/health` once before a demo.
- **State is in memory.** A sleep, restart or redeploy clears all games and the scoreboard. The UI recovers by itself: when the server no longer knows its game, it starts a new one in the same mode.
- **Proxy timeout.** Vercel waits up to 120 seconds for a proxied response, which covers a normal wake-up. If the API does not answer in time, Vercel returns a 502 or 504 and the UI shows "The game server is starting up or temporarily unavailable. Please try again in a moment."
- **CI-gated deploys.** `autoDeployTrigger: checksPass` makes Render deploy a commit on `main` only after its GitHub checks ([ci.yml](../.github/workflows/ci.yml)) pass, so a failing build never goes live.
- **Build filter.** Only changes under `backend/**` rebuild the API, so docs-only or frontend-only commits do not restart it or clear its state. Vercel redeploys the portal on every push to `main`, which publishes documentation changes.
- **Rate limiting behind the proxy.** The image enables forwarded headers and trusts one proxy hop, so the API counts requests per address that Render's proxy reports. For traffic through Vercel that is a Vercel address, so visitors routed through the same address share one bucket.

## Why the API is not on Vercel

Vercel's container runtime scales an idle service to zero after 5 minutes and may run several instances at once. The API keeps games and the scoreboard in process memory, so each scale-down would wipe them, and a game created on one instance would be unknown to another. A single long-running Render instance matches the in-memory design that the brief allows ([D28](DECISIONS.md#d28-vercel-serves-the-site-and-proxies-the-api-render-runs-the-api-container)).

The state already sits behind `IGameRepository` and `IScoreboardService`. Moving to Vercel, or running more than one instance anywhere, means registering Redis or SQL implementations of those interfaces (with the per-game lock replaced by a version check in the store). Controllers, `TicTacToe.Core` and the frontend stay unchanged.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A request is slow, then the toast "The game server is starting up or temporarily unavailable…" appears (HTTP 502 or 504 on `/api`) | Render is waking up or redeploying | Wait a moment and retry. Open <https://tictactoe-abb-api.onrender.com/health>, and check the service's **Logs** on Render. |
| The toast "That game expired on the server, so a new game was started." (the API answered 404 "Game not found") | The API restarted, redeployed or slept, or the game was idle for 2 hours | Expected with in-memory storage. The UI has already started a new game in the same mode; no action needed. |
| Refreshing `/play` or opening `/docs/api` directly shows a 404 | The SPA fallback rewrite is missing | Keep the final `/(.*)` → `/index.html` rewrite in `vercel.json`. |
| `/swagger` shows the portal's "page not found" page | The `/swagger` rewrites are missing from `vercel.json`, so the SPA fallback answers | Restore both `/swagger` rewrites. |
| `/swagger` returns a 404 problem response from the API | `Swagger__Enabled` is `false` on Render | Remove the variable or set it to `true`. |
| 429 Too Many Requests | More than `RateLimiting__PermitLimit` requests from one address in a window | Wait for the `Retry-After` seconds, or raise the limit on Render. |
| The API stops at startup with `OptionsValidationException` | An environment variable has an invalid value | The message names the setting; fix it using the ranges above. |
