# Design decisions and trade-offs

Each entry records what was decided, why, and what the alternative was. Entries are added as the build progresses.

## Environment and tooling

### D1. Repository root is the working folder
The brief says "you are working inside an empty folder that will become a GitHub repository", and the layout diagram names the root `tictactoe-abb/`. The working folder itself is the repository root, and `tictactoe-abb` is the intended GitHub repository name, so cloning gives `tictactoe-abb/README.md`, `tictactoe-abb/backend/...` exactly as in the layout.

### D2. Angular 21.2 (current LTS line) instead of 22.x
Angular 22.2 is the newest release, but its CLI refuses to run on Node.js below 24.15.0 / 22.22.3. The development machine has Node.js 24.14.0 and a global Angular CLI 21.2.28. Angular 21.2 is a supported stable LTS release with everything the brief asks for (standalone components, signals, zoneless change detection, Vitest as the default test runner), and it runs on any Node 20.19+/22.12+/24 LTS. Upgrading later is `ng update @angular/core@22 @angular/cli@22` after a Node.js upgrade.

### D3. Repo-local `backend/nuget.config`
The development machine had no NuGet package source configured, so `dotnet restore` failed. A repo-local `nuget.config` that `<clear/>`s sources and adds nuget.org makes restore deterministic on any machine without touching user-level configuration.

### D4. Shared build settings in `backend/Directory.Build.props`
`Nullable`, `ImplicitUsings` and `TreatWarningsAsErrors` are set once for all three projects. Treating warnings as errors enforces the "no warnings on `dotnet build`" quality bar automatically.

### D5. Test packages upgraded from the template defaults
The `dotnet new xunit` template for SDK 8 pins xunit 2.5.3 / Microsoft.NET.Test.Sdk 17.8.0, which pull in transitive packages with published high-severity advisories (`System.Net.Http` 4.3.0, `System.Text.RegularExpressions` 4.3.0). They were upgraded to xunit 2.9.3, xunit.runner.visualstudio 3.1.5, Microsoft.NET.Test.Sdk 17.14.1 and coverlet.collector 6.0.4; `dotnet list package --vulnerable --include-transitive` is clean.

### D6. HTTP only on `http://localhost:5000`
`launchSettings.json` has a single `http` profile on port 5000 (as the brief specifies), and `UseHttpsRedirection` was removed, because a local-only assessment app does not need a dev certificate and the redirect would only add a warning and a second port.

### D7. Explicit `.component` / `.service` file and class suffixes in Angular
Angular CLI 20+ generates `app.ts` / `class App` by default. The brief names `GameApiService`, and suffixed names (`BoardComponent`, `GameApiService`) are what most reviewers recognise, so the workspace is configured (`angular.json` → `schematics`) to keep suffixes and the root component was renamed to `AppComponent` for consistency. Components default to `OnPush` change detection.
