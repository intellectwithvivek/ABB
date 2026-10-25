using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TicTacToe.Api.Application;

namespace TicTacToe.Tests.Api.Integration;

/// <summary>The per-client rate limits, lowered to a few requests so a test can reach them.</summary>
public sealed class RateLimitingTests : IDisposable
{
    private const int PermitLimit = 3;
    private const string FrontendOrigin = "http://localhost:4200";
    private const string TooManyRequestsMessage = "Too many requests. Please wait a moment and try again.";

    private readonly WebApplicationFactory<Program> _baseFactory = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public RateLimitingTests()
    {
        // WithWebHostBuilder derives a factory with one setting overridden; disposing _baseFactory disposes it too.
        _factory = WithSettings(("RateLimiting:PermitLimit", PermitLimit));
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _baseFactory.Dispose();
    }

    [Fact]
    public async Task Request_OverPermitLimit_Returns429ProblemWithCorsHeader()
    {
        await UseUpPermitLimitAsync();

        var response = await GetScoreboardFromFrontendAsync();

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("https://tools.ietf.org/html/rfc6585#section-4", problem.GetProperty("type").GetString());
        Assert.Equal(429, problem.GetProperty("status").GetInt32());
        Assert.Equal(TooManyRequestsMessage, problem.GetProperty("detail").GetString());

        // Rounded up, so it never tells the client to retry at once while the window is still full.
        Assert.True(response.Headers.RetryAfter?.Delta >= TimeSpan.FromSeconds(1));

        // Without this header the browser hides the 429 from the frontend, which could not show the message.
        Assert.Equal(FrontendOrigin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task Request_OverPermitLimitWithoutJsonInAccept_Returns429PlainText()
    {
        await UseUpPermitLimitAsync();

        // Outside the controllers no problem+json writer accepts this request; it must still be a 429, not a 500.
        var request = new HttpRequestMessage(HttpMethod.Get, "/swagger/v1/swagger.json");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/plain"));
        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(TooManyRequestsMessage, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_OverPermitLimit_IsNotRateLimited()
    {
        await UseUpPermitLimitAsync();

        Assert.Equal(HttpStatusCode.TooManyRequests, (await GetScoreboardFromFrontendAsync()).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/health")).StatusCode);
    }

    [Fact]
    public async Task Preflight_MoreThanPermitLimit_DoesNotUseUpLimit()
    {
        for (var i = 0; i < PermitLimit + 2; i++)
        {
            var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/games");
            preflight.Headers.Add("Origin", FrontendOrigin);
            preflight.Headers.Add("Access-Control-Request-Method", "POST");
            Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(preflight)).StatusCode);
        }

        // The preflights used none of the limit: each of the PermitLimit requests that follow is still allowed.
        await UseUpPermitLimitAsync();
    }

    [Fact]
    public async Task SubmitMove_OverPermitLimit_LeavesGameUnchanged()
    {
        var created = await _client.PostAsJsonAsync("/api/games", new { mode = "TwoPlayer" });
        var gameId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("gameId").GetGuid();
        await _client.PostAsJsonAsync($"/api/games/{gameId}/moves", new { player = "X", row = 0, col = 0 });
        await _client.PostAsJsonAsync($"/api/games/{gameId}/moves", new { player = "O", row = 1, col = 1 });

        var response = await _client.PostAsJsonAsync(
            $"/api/games/{gameId}/moves", new { player = "X", row = 2, col = 2 });

        // The limiter rejects the request before it reaches a controller, so the game keeps its two moves.
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        var game = _factory.Services.GetRequiredService<IGameRepository>().Find(gameId);
        Assert.Equal(2, game?.Moves.Count);
    }

    [Fact]
    public async Task CreateGame_OverCreateGameLimit_Returns429WhileOtherRequestsStillWork()
    {
        const int createGameLimit = 2;
        using var client = WithSettings(
                ("RateLimiting:PermitLimit", 10),
                ("RateLimiting:CreateGamePermitLimit", createGameLimit))
            .CreateClient();
        for (var i = 0; i < createGameLimit; i++)
        {
            var created = await client.PostAsJsonAsync("/api/games", new { mode = "TwoPlayer" });
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        }

        var response = await client.PostAsJsonAsync("/api/games", new { mode = "TwoPlayer" });

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/scoreboard")).StatusCode);
    }

    private WebApplicationFactory<Program> WithSettings(params (string Key, int Value)[] settings) =>
        _baseFactory.WithWebHostBuilder(builder =>
        {
            foreach (var (key, value) in settings)
            {
                builder.UseSetting(key, value.ToString());
            }
        });

    private async Task UseUpPermitLimitAsync()
    {
        for (var i = 0; i < PermitLimit; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await GetScoreboardFromFrontendAsync()).StatusCode);
        }
    }

    private Task<HttpResponseMessage> GetScoreboardFromFrontendAsync()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/scoreboard");
        request.Headers.Add("Origin", FrontendOrigin);
        return _client.SendAsync(request);
    }
}
