# Container image for the API. Build context = the backend/ folder:
#   docker build -t tictactoe-api backend
#   docker run -p 8080:8080 tictactoe-api        -> http://localhost:8080/health, /swagger, /api/...

# ---- Build stage: the full .NET 8 SDK restores, compiles and publishes a Release build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore from the build settings and project files alone, so this slow layer stays cached until a dependency changes.
COPY global.json nuget.config Directory.Build.props Directory.Packages.props ./
COPY TicTacToe.Core/TicTacToe.Core.csproj TicTacToe.Core/
COPY TicTacToe.Api/TicTacToe.Api.csproj TicTacToe.Api/
RUN dotnet restore TicTacToe.Api/TicTacToe.Api.csproj

COPY TicTacToe.Core/ TicTacToe.Core/
COPY TicTacToe.Api/ TicTacToe.Api/
RUN dotnet publish TicTacToe.Api/TicTacToe.Api.csproj -c Release --no-restore -o /app/publish -p:UseAppHost=false

# ---- Runtime stage: only the ASP.NET Core runtime and the published files, no SDK or source code ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Hosting platforms put a proxy in front of the container. This makes ASP.NET Core read the client's address and
# scheme from the proxy's X-Forwarded-For / X-Forwarded-Proto headers, so the rate limit counts per client and the
# Location header of a created game uses https.
# Trust assumption: exactly one proxy, which appends the address it received the request from. Any sender is
# trusted and only the last X-Forwarded-For entry is used, so:
#   - do not publish port 8080 to the internet without such a proxy: a client could then pick its own rate-limit
#     bucket by sending its own X-Forwarded-For header;
#   - behind two proxies (e.g. a Vercel rewrite in front of Render) the last entry is the first proxy's address,
#     so the clients behind it share one rate-limit bucket.
ENV ASPNETCORE_FORWARDEDHEADERS_ENABLED=true

# Run as the image's built-in non-root user, not root.
USER $APP_UID

# Platforms such as Render choose the port through the PORT variable; 8080 is the default otherwise.
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet TicTacToe.Api.dll"]
