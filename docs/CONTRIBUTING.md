# Contributing

How changes reach `main`, the checks every change must pass, and the conventions that keep the codebase consistent. The reasons behind these rules are in [Design decisions](DECISIONS.md).

## Branches and pull requests

- `main` is always deployable. Every push runs [CI](../.github/workflows/ci.yml) and redeploys the portal on Vercel; when `backend/` changed, Render redeploys the API once the checks pass (see [Deployment](DEPLOYMENT.md)).
- Work on a short-lived branch from an up-to-date `main`, named after the change: `feat/minimax-opponent`, `fix/undo-after-draw`, `docs/deployment-guide`.
- Open a pull request into `main` and complete the [template](../.github/pull_request_template.md) checklist. CI must be green before merging.
- Squash-merge so each pull request becomes one Conventional Commit, then delete the branch. Never force-push `main`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, imperative and lower case, no full stop. Scopes are `core`, `api` and `frontend`. Examples from this repository's history:

```text
chore: scaffold backend, frontend and docs
feat(core): add game rules engine, computer opponent, sessions and scoreboard
test(core): cover every game rule, undo mode, scoreboard and computer priority
feat(api): add REST API with validation, problem details, CORS and Swagger
ci: add GitHub Actions, Docker and deployment configuration
```

Other types: `fix`, `refactor`, `docs`, `build`, `style`. Add a body when the why is not obvious, and a `BREAKING CHANGE:` footer if the JSON contract changes incompatibly. Commits carry the author's own name; AI assistance is disclosed in [AI workflow](AI_WORKFLOW.md), not in commit trailers ([D30](DECISIONS.md#d30-commits-under-the-candidates-identity-with-ai-use-disclosed-in-writing)).

## Local quality gates

Run these in PowerShell from the repository root before pushing. CI runs the same build, test and Prettier steps; `dotnet format` is a local gate.

```powershell
cd backend
dotnet build TicTacToe.sln -c Release
dotnet test TicTacToe.sln -c Release
dotnet format TicTacToe.sln --verify-no-changes
cd ..\frontend
npm ci
npm run build
npm run test:ci
npm run format:check
```

Warnings are errors in the backend build, and the frontend build enforces its size budgets. `dotnet format` and `npm run format` fix formatting.

## Coding conventions

- **Layering.** Game rules live only in `TicTacToe.Core`, which has no ASP.NET dependency. `TicTacToe.Api` translates HTTP to Core calls and back. The frontend never computes a rule.
- **C#.** One type per file, namespaces follow folders, `sealed` classes, records for DTOs and values, nullable reference types with zero warnings. Package versions live only in `Directory.Packages.props`. Throw `GameRuleException` (400) or `GameNotFoundException` (404); controllers contain no `try`/`catch`.
- **Angular.** Standalone components with `OnPush`, signals and `inject()`. Only `data-access` services call `HttpClient`; configuration comes from the `APP_CONFIG` token. Prettier formats everything.
- **Tests.** Backend tests mirror the source folders and are named `Method_Scenario_ExpectedOutcome`, with real objects rather than mocks and `FakeTimeProvider` for time. Frontend specs sit next to their file and query the DOM by role, label or text.
- **Comments** explain why, not what. No dead code, commented-out code or debug output.

## Adding a feature end to end

Work from the inside out, with a test at each step:

1. **Core:** the rule in the right folder (`Engine/`, `Sessions/`, `Opponents/`), with xUnit tests in `TicTacToe.Tests/Core/`.
2. **API:** extend the DTOs additively, map in `ResponseMapper`, call Core from `GameService` inside `RunLocked`, and add a service test and a `WebApplicationFactory` test.
3. **Frontend:** mirror the contract in `game.models.ts`, add the call to `GameApiService`, expose it through `GameStore`, and render it in a component, each with a spec.
4. **Docs:** update [API.md](API.md), [DECISIONS.md](DECISIONS.md), [TESTING.md](TESTING.md), [TRACEABILITY.md](TRACEABILITY.md) and the README feature list as needed.

Contract changes are additive: new request fields are optional, existing fields are never renamed or removed, and enum values stay strings.

## Keeping docs in sync

The portal's **Docs** section renders `README.md` and `docs/*.md`. `scripts/copy-docs.mjs` copies them into `frontend/public/content/` on every `npm start` and `npm run build`; that folder is generated and git-ignored, so never edit it.

- **New document:** create `docs/NAME.md` and add it to [`docs.catalog.ts`](../frontend/src/app/features/docs/docs.catalog.ts) (slug, title, description, category, `sourcePath`).
- **Links:** write them relative to the file, as GitHub resolves them. The portal opens linked documents in place and source files on GitHub.
- **Same pull request:** update the document that describes a change together with the code, and check the result at <http://localhost:4200/docs>.
