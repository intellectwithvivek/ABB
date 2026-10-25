# Container image for the API. Build context: the backend/ folder.
#   docker build -t tictactoe-api backend
#   docker run -p 8080:8080 tictactoe-api        -> http://localhost:8080/health, /swagger, /api/...

# ---- Build stage: the .NET 8 SDK restores, compiles and publishes a Release build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore from the build settings and project files alone, so this layer stays cached until a dependency changes.
COPY global.json nuget.config Directory.Build.props Directory.Packages.props ./
COPY TicTacToe.Core/TicTacToe.Core.csproj TicTacToe.Core/
COPY TicTacToe.Api/TicTacToe.Api.csproj TicTacToe.Api/
RUN dotnet restore TicTacToe.Api/TicTacToe.Api.csproj

COPY TicTacToe.Core/ TicTacToe.Core/
COPY TicTacToe.Api/ TicTacToe.Api/
RUN dotnet publish TicTacToe.Api/TicTacToe.Api.csproj -c Release --no-restore -o /app/publish -p:UseAppHost=false

# ---- Runtime stage: the ASP.NET Core runtime and the published files only (no SDK, no source code) ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Read the client address and scheme from Render's proxy (X-Forwarded-For / X-Forwarded-Proto), so rate limiting is
# per client and the Location header of a created game uses https. Only the last (one-hop) entry is used: through the
# Vercel site that is Vercel's address, so visitors behind the same Vercel address share a rate-limit bucket.
# Never expose port 8080 without a proxy in front: a client could then pick its own bucket with X-Forwarded-For.
ENV ASPNETCORE_FORWARDEDHEADERS_ENABLED=true

# Run as the image's built-in non-root user.
USER $APP_UID

# Render sets the port through the PORT variable; 8080 otherwise.
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet TicTacToe.Api.dll"]
