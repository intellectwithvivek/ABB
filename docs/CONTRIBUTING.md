# Contributing

How to set up the project, which checks every change must pass, the coding conventions, and how a feature travels from a game rule to the screen. The reasons behind these rules are in [Design decisions](DECISIONS.md).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| .NET SDK | 8.0.x (any feature band) | Pinned by [`backend/global.json`](../backend/global.json) (`8.0.100`, `rollForward: latestFeature`), so a .NET 9 or 10 SDK is never used by accident. |
| Node.js | 22 LTS (CI and Docker) or 24 LTS | Angular 21 needs Node 20.19+, 22.12+ or 24. |
| npm | 10 or later | `package.json` records npm 11.9 as `packageManager`. |
| Git | any recent version | |
| Docker | optional | Only to build the images or run `docker compose` (see [Deployment](DEPLOYMENT.md)). |

Use the local Angular CLI through `npx ng …` or the npm scripts. A global `ng` is not required.

> **Windows notes.** If PowerShell says `dotnet` is not recognised, add it to the session's PATH: `$env:PATH = "C:\Program Files\dotnet;" + $env:PATH`. On machines with Smart App Control turned on, `dotnet test` can fail with `0x800711C7` ("An Application Control policy has blocked this file"). Rebuild and run it again; do not turn off the protection. CI is the authoritative test run.

### First run

```powershell
# Terminal 1 - API on http://localhost:5000 (Swagger at /swagger)
cd backend
dotnet run --project TicTacToe.Api

# Terminal 2 - UI on http://localhost:4200
cd frontend
npm ci
npm start
```

`npm start` and `npm run build` first copy `README.md` and `docs/` into `frontend/public/content/` (the script is `scripts/copy-docs.mjs`). That folder is generated and git-ignored, so never edit files there.

## Branch strategy

- `main` is always releasable. Pushing to `main` runs CI, and it also redeploys the GitHub Pages site (see [Deployment](DEPLOYMENT.md)).
- Work on a short-lived branch from an up-to-date `main`, named after the change:
  - `feat/minimax-opponent`
  - `fix/undo-after-draw`
  - `docs/deployment-guide`
  - `ci/cache-nuget`
- Open a pull request into `main`. The PR template lists the checks.
- **CI must be green before merging.** The workflow builds and tests the backend; builds, tests and format-checks the frontend; and builds both Docker images. In the repository settings, protect `main` with "Require status checks to pass".
- Squash-merge, so each pull request becomes one Conventional Commit on `main`. Delete the branch afterwards.
- Never force-push to `main`.

## Commit messages: Conventional Commits

Format: `type(optional scope): summary in the imperative, lower case, no full stop`

| Type | Use for | Example |
|---|---|---|
| `feat` | A new capability | `feat(core): add rule-based computer opponent` |
| `fix` | A bug fix | `fix(api): return 404 problem details for unknown game ids` |
| `test` | Tests only | `test(core): cover undo in computer mode` |
| `refactor` | Restructuring that does not change behaviour | `refactor(api): move service registration into AddTicTacToeApi` |
| `docs` | Documentation only | `docs: add deployment guide` |
| `build` | Build system, packages | `build(deps): bump marked` (the prefix Dependabot uses) |
| `ci` | Workflows | `ci: build docker images after backend and frontend jobs` |
| `chore` | Housekeeping | `chore: scaffold backend, frontend and docs` (this repository's first commit) |
| `style` | Formatting only | `style(web): apply prettier` |

Scopes used in this repository:

- `core` for `TicTacToe.Core`
- `api` for `TicTacToe.Api`
- `web` for the Angular app
- `portal` for the docs portal
- `deploy` for the hosting configuration
- `deps` for dependency updates

Add a body when the *why* is not obvious, and `BREAKING CHANGE:` in the footer if the JSON contract changes in a way that is not backwards compatible.

Commits are authored under your own name and email. When an AI assistant helped, say so in [AI workflow](AI_WORKFLOW.md) rather than in a commit trailer (see [D65](DECISIONS.md#d65-commits-are-authored-under-the-candidates-identity-and-ai-use-is-disclosed-in-writing)).

## Local quality gates

Run these in PowerShell before you push. CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs the same build, test and Prettier checks, so a green local run means a green pipeline. `dotnet format` is a local gate only.

```powershell
# Backend - from backend/
dotnet build TicTacToe.sln -c Release          # warnings are errors (Directory.Build.props)
dotnet test TicTacToe.sln -c Release           # Core, application and HTTP integration tests
dotnet format TicTacToe.sln --verify-no-changes  # style follows .editorconfig; run without the flag to fix

# Frontend - from frontend/
npm ci
npm run build          # production build: no warnings, style budgets enforced
npm run test:ci        # Vitest, single run
npm run format:check   # Prettier; `npm run format` fixes it
```

Optional, if Docker is installed: run `docker compose build` from the repository root to check both images.

## Coding conventions

The audience is a reviewer who reads every line, so code is written to be explained. In both stacks:

- Use small files with one responsibility and names that say what things are.
- Leave no dead code and no commented-out code.
- Comments explain **why**, never what. Short notes on Angular or .NET choices that are not obvious are welcome.

### Backend (C#, .NET 8)

**Layering**

- `TicTacToe.Core` holds every game rule and has **no ASP.NET dependency**.
- `TicTacToe.Api` only translates HTTP to Core calls and back.
- If a rule appears in a controller, a DTO attribute or the frontend, it is in the wrong place.

**Folders and namespaces**

- Namespaces follow folders.
- Each file holds one type, and the file is named after the type.

| Project | Folder | Holds |
|---|---|---|
| Core | `Domain/` | Value types and the board |
| Core | `Engine/` | Rules |
| Core | `Opponents/` | Computer players |
| Core | `Sessions/` | Product policy: modes, undo, scoring |
| Core | `Scoring/` | The scoreboard |
| API | `Controllers/` | HTTP endpoints only |
| API | `Contracts/Requests`, `Contracts/Responses` | Wire types |
| API | `Mapping/` | Core → DTO |
| API | `Application/` | Use cases and the ports they need |
| API | `Infrastructure/` | Implementations of the ports, and background jobs |
| API | `ErrorHandling/` | Exception and rate-limit responses |
| API | `Configuration/` | Typed settings |
| API | `Extensions/` | DI and pipeline setup |

**Style**

- Classes are `sealed` unless they are designed for inheritance.
- Use records for DTOs and immutable values.
- Use classic constructors with `private readonly` fields named `_camelCase`, not primary constructors.
- Keep nullable reference types on, with zero warnings.
- The root [`.editorconfig`](../.editorconfig) sets the remaining style rules, and `dotnet format` applies them:
  - 4-space indentation;
  - file-scoped namespaces;
  - `using` directives outside the namespace, with `System` first;
  - braces always;
  - interfaces named `IPascalCase`;
  - private constants and `static readonly` fields in `PascalCase`.

**Errors**

- Throw `GameRuleException` for a broken rule (→ 400) and `GameNotFoundException` for an unknown id (→ 404).
- Messages are written for the player and use 0-based coordinates.
- Controllers contain no `try`/`catch`: `GameExceptionHandler` maps exceptions to `problem+json`.

**Validation**

- Request DTOs use `required` members.
- Do not copy domain rules into `[Range]` or other attributes.

**Settings**

- Add an options class in `Configuration/` with data-annotation validation, register it through `AddValidatedOptions`, and add a default to `appsettings.json`.
- Document the key and its environment-variable form in [API → Configuration](API.md#configuration) and [Deployment](DEPLOYMENT.md#environment-variables-and-configuration).

**Packages**

- Versions live only in [`Directory.Packages.props`](../backend/Directory.Packages.props). A `PackageReference` has no `Version`.

**Concurrency**

- A change to a game runs through `GameService.RunLocked`, which locks that game and maps the response inside the lock.
- Shared singletons must be thread-safe.

**Tests**

- Test folders mirror the source folders: `Core/Engine/`, `Api/Integration/` and so on.
- Name tests `Method_Scenario_ExpectedOutcome`.
- Use plain xUnit `Assert`, and real objects rather than mocks.
- Use `TestSupport/TestBoards.Parse("XO.", ".X.", "..O")` to set up boards.
- Use `WebApplicationFactory<Program>` for HTTP tests and `FakeTimeProvider` for anything time-based.

### Frontend (Angular 21, TypeScript strict)

**Modern Angular only**

- Standalone components (the default; do not write `standalone: true`), with no NgModules and no zone.js.
- Use `inject()`, signal `input()`/`input.required()`/`output()`, `signal`/`computed`, and `@if`/`@for`/`@switch`.
- Set `ChangeDetectionStrategy.OnPush` on every component.

**Folders**

| Folder | Holds |
|---|---|
| `core/` | App-wide pieces: `config/` (the `APP_CONFIG` token), `http/` (error mapping), `layout/` (header, footer, not-found page), `routing/` |
| `shared/ui/` | Reusable presentational components that know nothing about a feature, such as the error toast |
| `features/<feature>/` | One folder per feature (`home`, `game`, `docs`). Inside, use the subfolders you need: `components/` (presentational, inputs and outputs only), `data-access/` (the only place that calls `HttpClient`), `state/` (signal stores), `models/` (types that mirror the API contract) |

**Files**

- Use `.component.ts` and `.service.ts` suffixes.
- Each component has its own folder with `.ts`, `.html`, `.css` and `.spec.ts`.
- Pages are named `*-page.component.ts` and are lazy-loaded with `loadComponent` in `app.routes.ts`, with a route `title`.

**State and rules**

- The backend is the source of truth. A store keeps the latest server snapshot plus UI-only state (loading, errors, selections), and never computes a game rule.
- Components get read-only signals and call store methods.

**Configuration**

- Inject `APP_CONFIG`. Only `app.config.ts` imports `environment`.
- URLs for published content are **relative** (`content/docs/API.md`), so the app works under a sub-path base href such as GitHub Pages' `/ABB/`.

**Styling**

- Design tokens and shared classes live in `src/styles.css`.
- Keep each component stylesheet under the 4 kB budget.
- Use no UI library.
- Every interactive element needs visible hover, `:focus-visible` and disabled states.

**Accessibility**

- Use real `<button>`s for actions.
- Add an `aria-label` only where there is no visible text.
- Announce status changes with `aria-live`.

**Formatting**

- Prettier handles formatting (`.prettierrc`: width 100, single quotes, Angular HTML parser). Do not format by hand.

**Tests**

- Put each `*.spec.ts` next to the file it tests, and run them with Vitest through `ng test`.
- Mock HTTP with `provideHttpClient()` + `provideHttpClientTesting()` + `HttpTestingController`; `HttpClientTestingModule` is deprecated.
- Set signal inputs with `fixture.componentRef.setInput(...)`.
- Find elements the way users and the template already identify them (role, label, text, existing classes). Do not add attributes just for tests.

## Adding a feature end to end

Work from the inside out. Each step is small, has its own test, and builds on the step before it. As a running example, the table follows a hypothetical "hard" computer opponent that uses minimax.

| Step | Where | What to do | Example |
|---|---|---|---|
| 1. Rule | `backend/TicTacToe.Core/<folder>/` | Put the behaviour in the right Core layer: a rule in `Engine/`, a policy in `Sessions/`, an opponent in `Opponents/`. Throw `GameRuleException` with a player-facing message for anything the caller can get wrong. | `Opponents/MinimaxComputerPlayer.cs` |
| 2. Core test | `backend/TicTacToe.Tests/Core/<same folder>/` | One clearly named test per behaviour, including the rejection paths. Build boards with `TestBoards.Parse`. | `ChooseMove_ForkAvailable_BlocksFork` |
| 3. API | `backend/TicTacToe.Api/` | Extend the request or response DTO (only by adding fields, see below), map it in `ResponseMapper`, call Core from `GameService` inside `RunLocked`, and keep the controller action to one line with `[ProducesResponseType]`. | An optional `difficulty` on `CreateGameRequest` |
| 4. API test | `backend/TicTacToe.Tests/Api/` | A service test for the logic, and a `WebApplicationFactory` test for the status code and JSON shape. | `CreateGame_HardDifficulty_Returns201WithDifficulty` |
| 5. Frontend data | `frontend/src/app/features/<feature>/models`, `data-access`, `state` | Mirror the contract in `models`, add the call to the API service, and expose it through the store. Add specs with `HttpTestingController` and a stubbed API. | `GameMode` union, `createGame(mode, difficulty)` |
| 6. Frontend UI | `features/<feature>/components/` | A presentational component, or new inputs and outputs, wired up in the page component. Add a component spec. | A difficulty picker next to the mode picker |
| 7. Docs | `docs/` | Update [API.md](API.md) (contract, examples, rules), [DECISIONS.md](DECISIONS.md) (add the next `Dn` entry), [TRACEABILITY.md](TRACEABILITY.md) if it meets a requirement, [TESTING.md](TESTING.md) for new tests, and the README's feature list. | |

**Contract changes.** The JSON contract in [API.md](API.md) is what the frontend and any other client rely on.

- Add fields; never rename or remove one in the same change.
- New request fields must be optional, or have a default, so existing clients keep working.
- Enums are strings: add a value at the end, and update the TypeScript union type in `game.models.ts` in the same pull request.

## Pull request checklist

- [ ] The branch is up to date with `main`, and the PR title is a Conventional Commit.
- [ ] All local quality gates pass: build with 0 warnings, tests green, `dotnet format --verify-no-changes` and `npm run format:check` clean.
- [ ] New behaviour has tests at the lowest layer that can prove it (Core before API before UI).
- [ ] No game rule was added to the API's attributes or to the frontend.
- [ ] Any contract change is additive and documented in [API.md](API.md), with the TypeScript models updated.
- [ ] Any new setting has a validated options class, a default in `appsettings.json`, and a row in the configuration tables.
- [ ] Docs are updated (see below), and links work both on GitHub and in the portal.
- [ ] There is no dead code, no commented-out code, and no leftover `console.log` or debugging output.
- [ ] UI changes were checked at laptop width and on a narrow window, using the keyboard only.
- [ ] Screenshots are attached for visible UI changes.

## Keeping the docs in sync

The frontend's **Docs** section renders the Markdown files in this repository. `scripts/copy-docs.mjs` copies `README.md` and `docs/` into the build, so the file you edit on GitHub is exactly what reviewers read in the portal. There is no second copy to update.

- **Edit only `README.md` and `docs/*.md`.** Never edit `frontend/public/content/`: it is regenerated on every `npm start` and `npm run build`.
- **Adding a document:**
  1. Create `docs/NAME.md`.
  2. Add an entry to [`docs.catalog.ts`](../frontend/src/app/features/docs/docs.catalog.ts) with a slug, title, description, category and `sourcePath`. The sidebar, the hub, and the previous/next links follow the catalog's order.
  3. Link the new document from the README if reviewers need to find it.
- **Links:** write them the way GitHub resolves them, relative to the file. The portal rewrites them:
  - another document: `[API](API.md#errors)` opens in the portal at that heading;
  - source code: `[GameEngine](../backend/TicTacToe.Core/Engine/GameEngine.cs)` opens on GitHub in a new tab;
  - files under `docs/assets/` download;
  - absolute `https://` links open in a new tab.
- **Anchors** follow GitHub's slug rules: lower case, punctuation removed, spaces become `-`. So `## Rate limiting` is `#rate-limiting`. Keep a heading's wording stable once other documents link to it.
- **Images and attachments** go in `docs/assets/` and are referenced relatively, for example `assets/diagram.png`.
- **When code changes, update the doc that describes it in the same pull request:**
  - endpoints, status codes, settings → [API.md](API.md)
  - structure → [ARCHITECTURE.md](ARCHITECTURE.md)
  - a new trade-off → [DECISIONS.md](DECISIONS.md)
  - hosting → [DEPLOYMENT.md](DEPLOYMENT.md)
  - tests → [TESTING.md](TESTING.md)
  - requirement coverage → [TRACEABILITY.md](TRACEABILITY.md)

  Before you merge, check the result in the portal with `npm start`.
