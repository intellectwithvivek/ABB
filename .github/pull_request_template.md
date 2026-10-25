## What and why

<!-- What does this change do, and which requirement or issue does it address? -->

## How it was tested

<!-- Commands you ran and scenarios you checked by hand. -->

## Checklist

- [ ] Backend: `dotnet build` has 0 warnings and `dotnet test` passes (run in `backend/`)
- [ ] Frontend: `npm run build` has no warnings; `npm run test:ci` and `npm run format:check` pass (run in `frontend/`)
- [ ] New or changed behaviour is covered by tests (game rules in `TicTacToe.Tests`, UI in `*.spec.ts`)
- [ ] The JSON contract is unchanged, or `docs/API.md` and the frontend models change with it
- [ ] Docs are updated where behaviour or setup changed (`README.md`, `docs/`, `docs/TRACEABILITY.md`)
- [ ] No dead or commented-out code; comments explain why, not what
