# Deployment

How to put the Tic Tac Toe app (the Angular review portal and the .NET 8 API) online, or run the whole stack with one command. Every option builds from this repository, and nothing has to be changed in the code.

## Overview

The app has two parts:

- **The frontend** is static files: the Angular build, plus the Markdown docs it renders. Any static host can serve it.
- **The API** is a long-running .NET 8 process, packaged as a Docker image by [`backend/Dockerfile`](../backend/Dockerfile). It needs a host that runs containers.

The frontend finds the API through its build configuration, so the API URL is never hard-coded in a service ([D51](DECISIONS.md#d51-configuration-through-an-app_config-injection-token-with-one-environment-file-per-target)):

| Build configuration | Environment file | `apiBaseUrl` | Used by |
|---|---|---|---|
| `development` (`npm start`) | `environment.ts` | `http://localhost:5000/api` | Local development |
| `production` (`npm run build`) | `environment.production.ts` | `/api` (same origin, proxied by the host) | Vercel, DigitalOcean, Docker Compose |
| `github-pages` | `environment.github-pages.ts` | `https://tictactoe-abb-api.onrender.com/api` (cross-origin) | GitHub Pages |

| Option | Frontend | API | Browser calls the API | CORS setting needed | Cost | Files |
|---|---|---|---|---|---|---|
| **1. GitHub Pages + Render** (recommended) | GitHub Pages | Render free web service | Directly, cross-origin | Yes | Free | `.github/workflows/deploy-pages.yml`, `render.yaml`, `environment.github-pages.ts` |
| 2. Vercel + Render | Vercel | Render free web service | Via a Vercel rewrite, same origin | No | Free (Hobby plan) | `vercel.json`, `render.yaml` |
| 3. DigitalOcean App Platform | Static site component | Service component | Via App Platform ingress rules, same origin | No | Static site free; the API service is paid | `.do/app.yaml` |
| 4. Docker Compose | nginx container | API container | Via the nginx proxy, same origin | No | Your own machine or droplet | `docker-compose.yml`, both Dockerfiles, `frontend/nginx.conf` |

Why there are four options, and why Option 1 is recommended: see [D62](DECISIONS.md#d62-deployment-targets-github-pages--render-recommended-three-alternatives-supported).

> **State is in memory.** Games and the scoreboard live in the API process ([D39](DECISIONS.md#d39-in-memory-storage-behind-a-repository-interface)). A restart, a redeploy or a free instance going to sleep clears them. The UI recovers by itself: it starts a new game when its saved game no longer exists.

## Option 1 (recommended): GitHub Pages + Render

Everything deploys from GitHub. GitHub Pages hosts the frontend. GitHub cannot run a .NET process, so the API runs on Render's free tier. Render builds it from `backend/Dockerfile` and redeploys it from `main` once CI has passed.

```text
Browser ──► https://intellectwithvivek.github.io/ABB/          (GitHub Pages: Angular app + docs)
   │
   └──────► https://tictactoe-abb-api.onrender.com/api/...    (Render: Docker image of TicTacToe.Api)
            CORS allows https://intellectwithvivek.github.io
```

Deploy the API first: its URL is what the frontend calls.

### Step 1: Deploy the API on Render

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with your GitHub account.
2. Click **New +** → **Blueprint**.
3. Under **Connect a repository**, pick `intellectwithvivek/ABB`. If it is not listed, click **Configure account** and give Render access to the repository.
4. Render reads [`render.yaml`](../render.yaml) and shows one web service, **`tictactoe-abb-api`**:
   - runtime Docker, built from `./backend/Dockerfile` with `./backend` as the build context;
   - plan Free, branch `main`;
   - health check `/health`;
   - environment variable `Cors__AllowedOrigins__0` = `https://intellectwithvivek.github.io`. An origin is the scheme and host only: no `/ABB` path and no trailing slash.
5. Render asks for `Cors__AllowedOrigins__1`, the one variable the Blueprint leaves open (`sync: false`). It is an optional second origin. Option 2 does not need it, because its rewrite keeps the browser on Vercel's own origin. Leave it empty unless a second site calls the API directly.
6. Click **Apply**. The first Docker build takes a few minutes. When it is done, the service is live at `https://tictactoe-abb-api.onrender.com`.
   - If that name was already taken, Render adds a suffix. Copy the URL shown on the service page; you will need it in Step 2.
7. Check the deployment:
   - `https://tictactoe-abb-api.onrender.com/health` returns `Healthy`.
   - `https://tictactoe-abb-api.onrender.com/swagger` shows the API reference.

After the first deployment, the Blueprint controls when Render redeploys:

- `autoDeployTrigger: checksPass` makes Render deploy a commit on `main` only after its GitHub checks (the [CI workflow](../.github/workflows/ci.yml)) have passed. A failing build never goes live.
- `buildFilter` limits rebuilds to commits that change `backend/**`. A docs-only or frontend-only change does not restart the API, so it does not clear the games held in memory.

To change a setting later, go to the service → **Environment**, edit the value and click **Save Changes**. Render restarts the service.

> **Without a Blueprint:** click **New +** → **Web Service**, pick the repository, and choose **Docker** as the language. Set the Dockerfile path and Docker build context to the values in `render.yaml`. Set the health check path to `/health`, the instance type to **Free**, and add the same `Cors__AllowedOrigins__0` variable.

### Step 2: Deploy the frontend on GitHub Pages

The workflow **Deploy to GitHub Pages** ([`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml)) builds and publishes the site. It runs on every push to `main`, and on demand with **Run workflow**. Only one deployment runs at a time.

The `build` job:

1. Checks out the repository and sets up Node.js 22, with the npm cache.
2. Runs `npm ci` in `frontend/`.
3. If the repository variable **`API_BASE_URL`** is set, it rewrites `src/environments/environment.github-pages.ts` with that value. It also derives the Swagger URL (`…/api` → `…/swagger`) and the repository URL. The value reaches the script through an environment variable, never inline, so it cannot be executed as shell code.
4. Runs `npm run build -- --configuration github-pages`:
   - The `prebuild` script copies `README.md` and `docs/` into the site, so the portal can render them.
   - The `github-pages` configuration uses the Render API URL and sets the base href to `/ABB/`, because a project site is served from a sub-path.
5. Copies `index.html` to `404.html`. GitHub Pages serves `404.html` for unknown paths, so deep links and refreshes such as `/ABB/docs/api` still load the app.
6. Uploads `frontend/dist/tictactoe-web/browser` with `actions/upload-pages-artifact`.

The `deploy` job then publishes the uploaded files with `actions/deploy-pages`. It has the `pages: write` and `id-token: write` permissions and uses the `github-pages` environment.

One-time setup:

1. The repository must be **public**. GitHub Pages on the Free plan only publishes public repositories.
2. On GitHub, go to **Settings** → **Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. This step is only needed if your API URL is **not** `https://tictactoe-abb-api.onrender.com`:
   1. Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab → **New repository variable**.
   2. Set **Name** to `API_BASE_URL`.
   3. Set **Value** to `https://<your-service>.onrender.com/api`, with `https`, ending in `/api`, and no trailing slash.
4. Open the **Actions** tab, select **Deploy to GitHub Pages**, and click **Run workflow** on `main`. Pushing a commit to `main` also starts it.
5. When the run is green, the **deploy** job shows the site URL: **`https://intellectwithvivek.github.io/ABB/`**.

### Cold starts on Render's free plan

A free Render web service goes to sleep after about 15 minutes without traffic. The next request wakes it, which takes up to about a minute. During that time the UI shows "Loading game…" or the request is slow.

When it wakes, the in-memory games and scoreboard are empty and the UI starts a new game by itself. Before a review, open `https://tictactoe-abb-api.onrender.com/health` once to wake the API. Free instances also have a monthly limit on running hours, which is ample for a demo.

### Verification checklist

- [ ] `https://tictactoe-abb-api.onrender.com/health` returns `Healthy`.
- [ ] `https://tictactoe-abb-api.onrender.com/swagger` loads, and `GET /api/scoreboard` → **Try it out** returns 200.
- [ ] `https://intellectwithvivek.github.io/ABB/` shows the Overview page, with styles and the icon loaded (no 404s in DevTools → Network).
- [ ] **Play**: a Two Player game accepts moves and highlights a win; in **Vs Computer** mode the computer replies at once; **Undo** works; the scoreboard updates.
- [ ] Refreshing `https://intellectwithvivek.github.io/ABB/play` keeps the page and resumes the same game.
- [ ] `https://intellectwithvivek.github.io/ABB/docs/api` renders the API document, and refreshing it still works.
- [ ] DevTools → Console shows no CORS errors. In DevTools → Network, the calls to `onrender.com` return `Access-Control-Allow-Origin: https://intellectwithvivek.github.io`.
- [ ] The header's **API ↗** link opens the Render Swagger UI, and **GitHub ↗** opens the repository.

## Option 2: Vercel + Render

Vercel serves the frontend and forwards `/api/*` and `/swagger*` to the Render API, using server-side rewrites in [`vercel.json`](../vercel.json). The browser only ever talks to the Vercel domain, so no CORS setting is needed. The build uses the `production` configuration (`apiBaseUrl: '/api'`).

1. Deploy the API on Render as in [Option 1, Step 1](#step-1-deploy-the-api-on-render). No CORS variable is needed for Vercel.
2. `vercel.json` already forwards to `https://tictactoe-abb-api.onrender.com`:
   - `/api/:path*` → `…/api/:path*`
   - `/swagger` and `/swagger/:path*` → the same paths on Render

   If Render gave your service a different URL, change these three destinations and push.
3. Sign in at [vercel.com](https://vercel.com) with GitHub, then click **Add New…** → **Project**.
4. Next to `intellectwithvivek/ABB`, click **Import**.
5. Leave **Root Directory** as the repository root. `vercel.json` provides the install command (`npm ci --prefix frontend`), the build command (`npm run build --prefix frontend`) and the output directory (`frontend/dist/tictactoe-web/browser`). Leave **Framework Preset** as **Other**, and do not override the build settings.
6. Click **Deploy**. Vercel shows the site URL, for example `https://tictactoe-abb.vercel.app`, and redeploys on every push to `main`.
7. Verify as in Option 1, using the Vercel URL. The API link (`/swagger`) is proxied too.

Vercel serves existing files first and applies the rewrites only to the rest. The last rewrite, `/(.*)` → `/index.html`, therefore covers client-side routes such as `/play` and `/docs/api`, so deep links work. A document that is missing from the build also gets `index.html`, but the docs viewer recognises an HTML answer and shows "not available".

Note that requests reach Render from Vercel's servers, so the API's rate limit counts per Vercel address rather than per visitor (see [Troubleshooting](#troubleshooting)).

## Option 3: DigitalOcean App Platform

One App Platform app, `tictactoe-abb`, runs two components on one domain, defined in [`.do/app.yaml`](../.do/app.yaml). Both deploy from `intellectwithvivek/ABB`, branch `main`, on every push.

| Component | Kind | Built from | Serves |
|---|---|---|---|
| `api` | Service | `backend/Dockerfile`, with `backend/` as the build context. HTTP port 8080, health check `/health`. `instance_count: 1`, because games live in one process's memory and a second instance would not know them. | `/api` and `/swagger`. `preserve_path_prefix: true` keeps the prefix, because the API's own routes start with it. |
| `web` | Static site | `source_dir: frontend`. App Platform runs `npm ci` itself, then `npm run build`, whose `prebuild` step copies `../README.md` and `../docs`. Output: `dist/tictactoe-web/browser`. | Everything else (`/`). `catchall_document: index.html` makes deep links work. |

The ingress rules route by path on a single domain, so the browser never makes a cross-origin call and no CORS setting is needed.

**Cost:** static sites are free on App Platform. A service (the API container) is **not**: even the smallest instance is billed monthly. Check DigitalOcean's current pricing before you deploy, and destroy the app after the review if you do not need it.

Steps:

1. In the [DigitalOcean control panel](https://cloud.digitalocean.com/apps), connect your GitHub account to App Platform and give it access to the repository. App Platform needs this access to build from the repository, even when you create the app from the command line.
2. Create the app from the spec. Either:
   - with the CLI: install `doctl`, run `doctl auth init`, then from the repository root run `doctl apps create --spec .do/app.yaml`; or
   - in the control panel: **Create App** → **GitHub** → `intellectwithvivek/ABB`, branch `main`. Before creating the resources, open the app spec editor, replace its contents with `.do/app.yaml`, and save.
3. Review the plan (the `api` service's size determines the cost) and confirm.
4. When the deployment is done, open the app URL (`https://<app-name>.ondigitalocean.app`). Check `/api/scoreboard`, `/swagger`, `/play` and `/docs/api`, and run the same checks as in Option 1. No CORS error can occur here.

If you fork the repository, change `github.repo` for both components in `.do/app.yaml`.

## Option 4: Docker Compose on any machine or droplet

[`docker-compose.yml`](../docker-compose.yml) builds and runs both images:

- **`api`** is built from `backend/` and listens on port 8080 (`PORT: "8080"`) inside the Compose network only. Its port is not published to the host. `Cors__AllowedOrigins__0` is set to `http://localhost:8080`, the origin the page loads from.
- **`web`** is built from the repository root with `frontend/Dockerfile`, because the portal needs `docs/` and `README.md`. nginx serves the Angular build and proxies `/api/` and `/swagger` to `http://api:8080` ([`frontend/nginx.conf`](../frontend/nginx.conf)). It is published on host port **8080** (`8080:80`), and starts after `api`.

```powershell
# From the repository root (Docker Desktop on Windows/macOS, Docker Engine on Linux)
docker compose up --build
```

Open **http://localhost:8080**. Everything is on one origin:

- `http://localhost:8080/play` is the game;
- `http://localhost:8080/docs` holds the docs;
- `http://localhost:8080/swagger` is the API reference, proxied by nginx.

Press `Ctrl+C` to stop, and run `docker compose down` to remove the containers.

**On a droplet or any Linux server:**

1. Create an Ubuntu droplet. The smallest size is enough.
2. Install Docker Engine with its Compose plugin.
3. Run `git clone https://github.com/intellectwithvivek/ABB.git && cd ABB`.
4. Run `docker compose up -d --build`.
5. Open port 8080 in the firewall, then browse to `http://<droplet-ip>:8080`.

For a public site, put a TLS-terminating reverse proxy (for example Caddy or nginx with Let's Encrypt) in front of port 8080. Without one, browsers mark the site as not secure.

You can also build and run the images one at a time:

```powershell
docker build -t tictactoe-api backend                    # context = backend/
docker run --rm -p 8080:8080 tictactoe-api               # http://localhost:8080/health, /swagger, /api/...
docker build -t tictactoe-web -f frontend/Dockerfile .   # context = repository root
```

The `web` image expects to reach the API at the host name `api`, so run it through Compose.

## Environment variables and configuration

### API (runtime)

ASP.NET Core reads every `appsettings.json` key from environment variables as well. Replace `:` with `__` (two underscores), and address list items by index. Values are validated at startup: an invalid value stops the app with a message that names the setting.

| Variable | Default | Meaning |
|---|---|---|
| `Cors__AllowedOrigins__0` | `http://localhost:4200` | First browser origin allowed to call the API. Setting it **replaces** the localhost default. Use scheme + host (+ port) only: `https://intellectwithvivek.github.io`. |
| `Cors__AllowedOrigins__1`, `__2`, … | not set | More allowed origins, for example a Vercel domain. |
| `Swagger__Enabled` | `true` | Serve Swagger UI at `/swagger` and the OpenAPI document at `/swagger/v1/swagger.json`. Set to `false` to hide them. |
| `RateLimiting__PermitLimit` | `300` | Requests per client IP address per window. Exceeding it returns 429. |
| `RateLimiting__WindowSeconds` | `60` | Length of the rate-limit window, from 1 to 3600 seconds. |
| `Sessions__IdleTimeout` | `02:00:00` | A game unused for this long is removed from memory. Allowed range: `00:01:00` to `1.00:00:00`. |
| `Sessions__CleanupInterval` | `00:10:00` | How often idle games are looked for. Allowed range: `00:00:01` to `1.00:00:00`. |
| `PORT` | `8080` | The port the container listens on. Render and other platforms set it themselves. |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` (set in the image) | Trust `X-Forwarded-For` and `X-Forwarded-Proto` from the platform's proxy, so the rate limit counts real clients and links use `https`. |

The full list of keys, with their `appsettings.json` form, is in [API → Configuration](API.md#configuration).

### Frontend (build time)

| Setting | Where | Meaning |
|---|---|---|
| `API_BASE_URL` | GitHub → **Settings** → **Secrets and variables** → **Actions** → **Variables** | Used only by the GitHub Pages workflow. It overrides the API URL baked into the `github-pages` build, for example `https://my-api.onrender.com/api`. The Swagger link is derived from it. If it is not set, the URL in `environment.github-pages.ts` is used. |
| `baseHref` | `angular.json` → `configurations.github-pages` | `/ABB/`, the repository name. Change it if the repository is renamed or forked under another name. |
| Rewrite destinations | `vercel.json` | The Render host that Vercel forwards `/api` and `/swagger` to. |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Console shows *"blocked by CORS policy: No 'Access-Control-Allow-Origin' header"*, and the UI says *"Cannot reach the game server at …"* | The page's origin is not in `Cors:AllowedOrigins` | On Render, set `Cors__AllowedOrigins__0` to the exact origin shown in the address bar: scheme and host only, no `/ABB`, no trailing slash. Save; Render restarts the service. Test with `curl.exe -i -X OPTIONS https://tictactoe-abb-api.onrender.com/api/games -H "Origin: https://intellectwithvivek.github.io" -H "Access-Control-Request-Method: POST"`, which must return `Access-Control-Allow-Origin`. |
| *"Cannot reach the game server"* and no CORS message | The API is asleep, still deploying, or down | Open `/health` on the API. On Render's free plan, wait up to a minute for the service to wake. Check the service's **Logs** on Render. |
| Refreshing `/ABB/play` or opening `/docs/api` directly gives a 404 page | The static host has no SPA fallback | GitHub Pages: the workflow must copy `index.html` to `404.html`. Vercel: keep the final catch-all rewrite to `/index.html` in `vercel.json`. DigitalOcean: `catchall_document: index.html`. Docker: `try_files … /index.html` in `nginx.conf`. |
| A blank page on GitHub Pages, with 404s for `main-*.js` and `styles-*.css` | Wrong base href: the app was built without `--configuration github-pages`, or the repository name changed | Build with `--configuration github-pages`. If the repository is not named `ABB`, change `baseHref` in `angular.json` to `/<repo-name>/`. Use `/` for a user site (`<user>.github.io`) or a custom domain. |
| The Pages workflow fails at *deploy*, with "Get Pages site failed" or "not enabled" | GitHub Pages is not set to deploy from Actions, or the repository is private on a free plan | **Settings** → **Pages** → **Source** = **GitHub Actions**. Make the repository public. Then re-run the workflow. |
| The first request after a while takes 30–60 seconds, and the game or scoreboard has reset | Render's free instance went to sleep, and memory was cleared | This is expected on the free plan (see [Cold starts](#cold-starts-on-renders-free-plan)). Wake the API before a demo, or use a paid instance that does not sleep. |
| Console shows *"Mixed Content: … requested an insecure resource 'http://…'"* | An HTTPS page is calling an `http://` API URL | Use an `https://` API URL in `API_BASE_URL` or `environment.github-pages.ts`. Render and Vercel provide HTTPS automatically. |
| The API returns `429 Too Many Requests` | More than `RateLimiting__PermitLimit` requests came from one IP address in one window. Behind a proxy such as Vercel, many users can share the proxy's addresses. | Wait for the `Retry-After` seconds, or raise `RateLimiting__PermitLimit`. |
| A document shows *"not available"* in the portal | The file is not in `docs/`, or the build did not run the copy step | Add the file to `docs/` and to `docs.catalog.ts`. Build with `npm run build`, which runs `copy-docs` first, rather than calling `ng build` alone. |
| `docker build` fails at `COPY docs/` or `COPY README.md` | The web image was built with `frontend/` as the build context | Build from the repository root: `docker build -f frontend/Dockerfile .`, or use `docker compose`. |
| The API container exits at startup with `OptionsValidationException` | An environment variable has an invalid value (for example `Sessions__CleanupInterval=0`) | The message names the setting. Fix the value using the ranges in the table above. |
