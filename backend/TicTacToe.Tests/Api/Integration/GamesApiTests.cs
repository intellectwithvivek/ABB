using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using TicTacToe.Api.Application;
using TicTacToe.Core.Domain;
using TicTacToe.Core.Sessions;
using TicTacToe.Tests.TestSupport;

namespace TicTacToe.Tests.Api.Integration;

/// <summary>
/// HTTP-level tests: WebApplicationFactory starts the real app in memory (routing, JSON options, validation,
/// exception handler, CORS) and the tests send and check raw JSON, exactly as the frontend sees it.
/// </summary>
public sealed class GamesApiTests : IDisposable
{
    private const string FrontendOrigin = "http://localhost:4200";
    private const string ProblemJson = "application/problem+json";

    // The frozen JSON contract, in order.
    private static readonly string[] GameStatePropertyNames =
    [
        "gameId", "mode", "board", "currentPlayer", "status", "winner",
        "winningCells", "moveHistory", "canUndo", "scoreboard",
    ];

    // xUnit creates a new instance of this class for every test, so each test gets its own app
    // with an empty game store, a zeroed scoreboard and a fresh rate limit (a test sends far fewer
    // requests than the per-minute limit in appsettings.json; RateLimitingTests covers the limit).
    private readonly WebApplicationFactory<Program> _factory = new();
    private readonly HttpClient _client;

    public GamesApiTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Fact]
    public async Task CreateGame_TwoPlayer_Returns201WithLocationAndFullGameState()
    {
        var response = await _client.PostAsJsonAsync("/api/games", new { mode = "TwoPlayer" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var game = await ReadJsonAsync(response);
        var gameId = game.GetProperty("gameId").GetString();
        Assert.Equal($"/api/games/{gameId}", response.Headers.Location?.AbsolutePath);

        Assert.Equal(GameStatePropertyNames, game.EnumerateObject().Select(property => property.Name));
        Assert.Equal("TwoPlayer", game.GetProperty("mode").GetString());
        Assert.Equal("[[null,null,null],[null,null,null],[null,null,null]]", game.GetProperty("board").GetRawText());
        Assert.Equal("X", game.GetProperty("currentPlayer").GetString());
        Assert.Equal("InProgress", game.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, game.GetProperty("winner").ValueKind);
        Assert.Equal("[]", game.GetProperty("winningCells").GetRawText());
        Assert.Equal("[]", game.GetProperty("moveHistory").GetRawText());
        Assert.False(game.GetProperty("canUndo").GetBoolean());
        Assert.Equal("""{"xWins":0,"oWins":0,"draws":0}""", game.GetProperty("scoreboard").GetRawText());
    }

    [Theory]
    [InlineData("{}", "$")]
    [InlineData("""{ "mode": "Chess" }""", "$.mode")]
    [InlineData("""{ "mode": "2" }""", "Mode")]
    [InlineData("""{ "mode": "-1" }""", "Mode")]
    public async Task CreateGame_MissingOrUnknownMode_Returns400WithSingleErrorAndStoresNoGame(
        string body, string expectedErrorKey)
    {
        var response = await PostRawJsonAsync("/api/games", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var error = Assert.Single((await ReadJsonAsync(response)).GetProperty("errors").EnumerateObject());
        Assert.Equal(expectedErrorKey, error.Name);

        // RemoveIdleSince(MaxValue) removes, and so counts, every stored game: the rejected request stored none.
        var games = _factory.Services.GetRequiredService<IGameRepository>();
        Assert.Equal(0, games.RemoveIdleSince(DateTimeOffset.MaxValue));
    }

    [Fact]
    public async Task CreateGame_TextPlainBody_Returns415Problem()
    {
        var response = await _client.PostAsync(
            "/api/games", new StringContent("""{ "mode": "TwoPlayer" }""", Encoding.UTF8, "text/plain"));

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task SubmitMove_ValidMove_Returns200WithMarkHistoryAndNextTurn()
    {
        var gameId = await CreateGameAsync();

        var response = await PostMoveAsync(gameId, "X", 0, 0);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = await ReadJsonAsync(response);
        Assert.Equal("""[["X",null,null],[null,null,null],[null,null,null]]""", game.GetProperty("board").GetRawText());
        Assert.Equal(
            """[{"moveNumber":1,"player":"X","row":0,"col":0}]""", game.GetProperty("moveHistory").GetRawText());
        Assert.Equal("O", game.GetProperty("currentPlayer").GetString());
        Assert.True(game.GetProperty("canUndo").GetBoolean());
    }

    [Fact]
    public async Task SubmitMove_WinningMove_ReturnsWinnerAndWinningCells()
    {
        var gameId = await CreateGameAsync();

        var game = await PlayAsync(gameId, TestGames.XWinsOnTopRow);

        Assert.Equal("Won", game.GetProperty("status").GetString());
        Assert.Equal("X", game.GetProperty("winner").GetString());
        Assert.Equal(
            """[{"row":0,"col":0},{"row":0,"col":1},{"row":0,"col":2}]""",
            game.GetProperty("winningCells").GetRawText());
        Assert.False(game.GetProperty("canUndo").GetBoolean());
    }

    [Fact]
    public async Task SubmitMove_OccupiedCell_Returns400ProblemWithDetail()
    {
        var gameId = await CreateGameAsync();
        await PostMoveAsync(gameId, "X", 0, 0);

        var response = await PostMoveAsync(gameId, "O", 0, 0);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var problem = await ReadJsonAsync(response);
        Assert.Equal(400, problem.GetProperty("status").GetInt32());
        Assert.Equal("Invalid move", problem.GetProperty("title").GetString());
        Assert.Equal("Cell (row 0, col 0) is already taken by X.", problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task SubmitMove_OutsideBoard_Returns400ProblemWithDetail()
    {
        var gameId = await CreateGameAsync();

        var response = await PostMoveAsync(gameId, "X", 3, 0);

        await AssertGameRuleProblemAsync(response, "Row and column must be between 0 and 2 (got row 3, col 0).");
    }

    [Fact]
    public async Task SubmitMove_AfterWin_Returns400ProblemWithDetail()
    {
        var gameId = await CreateGameAsync();
        await PlayAsync(gameId, TestGames.XWinsOnTopRow);

        var response = await PostMoveAsync(gameId, "O", 2, 2);

        await AssertGameRuleProblemAsync(response, "The game is already over. Reset the game or start a new one.");
    }

    [Fact]
    public async Task SubmitMove_VsComputer_Returns200WithComputerReply()
    {
        var gameId = await CreateGameAsync("VsComputer");

        var response = await PostMoveAsync(gameId, "X", 0, 0);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = await ReadJsonAsync(response);
        Assert.Equal("""[["X",null,null],[null,"O",null],[null,null,null]]""", game.GetProperty("board").GetRawText());
        Assert.Equal(
            """[{"moveNumber":1,"player":"X","row":0,"col":0},{"moveNumber":2,"player":"O","row":1,"col":1}]""",
            game.GetProperty("moveHistory").GetRawText());
        Assert.Equal("X", game.GetProperty("currentPlayer").GetString());
    }

    [Fact]
    public async Task SubmitMove_PlayerAsNumericString_Returns400AndKeepsGame()
    {
        var gameId = await CreateGameAsync();

        // .NET 8's enum converter reads "7" as an undefined Player value; [EnumDataType] rejects it.
        var response = await PostRawJsonAsync(
            $"/api/games/{gameId}/moves", """{ "player": "7", "row": 0, "col": 0 }""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = Assert.Single((await ReadJsonAsync(response)).GetProperty("errors").EnumerateObject());
        Assert.Equal("Player", error.Name);
        Assert.Equal("""player must be "X" or "O".""", error.Value[0].GetString());
        Assert.Equal("[]", (await GetGameAsync(gameId)).GetProperty("moveHistory").GetRawText());
    }

    [Fact]
    public async Task SubmitMove_MissingCol_Returns400ValidationProblemAndKeepsGame()
    {
        var gameId = await CreateGameAsync();

        var response = await PostRawJsonAsync($"/api/games/{gameId}/moves", """{ "player": "X", "row": 0 }""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var error = Assert.Single((await ReadJsonAsync(response)).GetProperty("errors").EnumerateObject());

        // The key and the field name only: the rest of the sentence is System.Text.Json's wording.
        Assert.Equal("$", error.Name);
        Assert.Contains("col", error.Value[0].GetString());
        Assert.Equal("[]", (await GetGameAsync(gameId)).GetProperty("moveHistory").GetRawText());
    }

    [Theory]
    [InlineData("""{ "player": 0, "row": 0, "col": 0 }""")]
    [InlineData("""{ "player": "Z", "row": 0, "col": 0 }""")]
    public async Task SubmitMove_PlayerNotXOrO_Returns400WithSingleErrorForPlayer(string body)
    {
        var gameId = await CreateGameAsync();

        var response = await PostRawJsonAsync($"/api/games/{gameId}/moves", body);

        // A single entry naming the bad field, so a client showing the first error shows the real cause.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = Assert.Single((await ReadJsonAsync(response)).GetProperty("errors").EnumerateObject());
        Assert.Equal("$.player", error.Name);
    }

    [Fact]
    public async Task GetGame_UnknownId_Returns404Problem()
    {
        var unknownId = Guid.NewGuid();

        var response = await _client.GetAsync($"/api/games/{unknownId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var problem = await ReadJsonAsync(response);
        Assert.Equal($"Game '{unknownId}' was not found.", problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task GetGame_IdNotAGuid_Returns404Problem()
    {
        var response = await _client.GetAsync("/api/games/not-a-guid");

        // No route matches, so no controller runs; UseStatusCodePages still gives the empty 404 a problem+json body.
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(404, (await ReadJsonAsync(response)).GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task GetGame_UnexpectedServerError_Returns500ProblemWithoutExceptionDetails()
    {
        const string internalDetail = "connection string with a password";
        using var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
                services.AddSingleton<IGameRepository>(new ThrowingGameRepository(internalDetail))))
            .CreateClient();

        var response = await client.GetAsync($"/api/games/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(internalDetail, body);
        Assert.DoesNotContain(nameof(InvalidOperationException), body);
    }

    [Fact]
    public async Task Undo_NoMoves_Returns400ProblemWithDetail()
    {
        var gameId = await CreateGameAsync();

        var response = await _client.PostAsync($"/api/games/{gameId}/undo", content: null);

        await AssertGameRuleProblemAsync(response, "There are no moves to undo.");
    }

    [Fact]
    public async Task Undo_TwoPlayer_Returns200WithLastMoveRemoved()
    {
        var gameId = await CreateGameAsync();
        await PlayAsync(gameId, new Position(0, 0), new Position(1, 1));

        var response = await _client.PostAsync($"/api/games/{gameId}/undo", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = await ReadJsonAsync(response);
        Assert.Equal(
            """[{"moveNumber":1,"player":"X","row":0,"col":0}]""", game.GetProperty("moveHistory").GetRawText());
        Assert.Equal("O", game.GetProperty("currentPlayer").GetString());
    }

    [Fact]
    public async Task Undo_VsComputer_Returns200WithBothMovesRemoved()
    {
        var gameId = await CreateGameAsync("VsComputer");
        await PostMoveAsync(gameId, "X", 0, 0);

        var response = await _client.PostAsync($"/api/games/{gameId}/undo", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = await ReadJsonAsync(response);
        Assert.Equal("[[null,null,null],[null,null,null],[null,null,null]]", game.GetProperty("board").GetRawText());
        Assert.Equal("[]", game.GetProperty("moveHistory").GetRawText());
        Assert.Equal("X", game.GetProperty("currentPlayer").GetString());
        Assert.False(game.GetProperty("canUndo").GetBoolean());
    }

    [Fact]
    public async Task Undo_AfterWin_Returns400Problem()
    {
        var gameId = await CreateGameAsync();
        await PlayAsync(gameId, TestGames.XWinsOnTopRow);

        var response = await _client.PostAsync($"/api/games/{gameId}/undo", content: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            "Undo is not available after the game has ended. Reset the game to play again.",
            (await ReadJsonAsync(response)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Reset_AfterMove_Returns200WithEmptyBoardAndSameId()
    {
        var gameId = await CreateGameAsync();
        await PostMoveAsync(gameId, "X", 1, 1);

        var response = await _client.PostAsync($"/api/games/{gameId}/reset", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = await ReadJsonAsync(response);
        Assert.Equal(gameId, game.GetProperty("gameId").GetString());
        Assert.Equal("[[null,null,null],[null,null,null],[null,null,null]]", game.GetProperty("board").GetRawText());
        Assert.Equal("X", game.GetProperty("currentPlayer").GetString());
    }

    [Fact]
    public async Task Preflight_FromFrontendOrigin_IsAllowed()
    {
        var response = await SendPreflightAsync(FrontendOrigin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(FrontendOrigin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task Preflight_FromOtherOrigin_IsNotAllowed()
    {
        var response = await SendPreflightAsync("http://localhost:3000");

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task SubmitMove_RejectedMoveFromFrontendOrigin_ErrorCarriesCorsHeader()
    {
        var gameId = await CreateGameAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/games/{gameId}/moves")
        {
            Content = JsonContent.Create(new { player = "O", row = 0, col = 0 }),
        };
        request.Headers.Add("Origin", FrontendOrigin);

        var response = await _client.SendAsync(request);

        // Without this header the browser hides the error body from the frontend, which could not show the message.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(FrontendOrigin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task GetScoreboard_AfterXWins_ReturnsOneXWin()
    {
        var gameId = await CreateGameAsync();
        await PlayAsync(gameId, TestGames.XWinsOnTopRow);

        var response = await _client.GetAsync("/api/scoreboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""{"xWins":1,"oWins":0,"draws":0}""", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ResetScoreboard_AfterXWins_ReturnsAndKeepsZeroedScoreboard()
    {
        var gameId = await CreateGameAsync();
        await PlayAsync(gameId, TestGames.XWinsOnTopRow);

        var response = await _client.PostAsync("/api/scoreboard/reset", content: null);

        const string zeroed = """{"xWins":0,"oWins":0,"draws":0}""";
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(zeroed, await response.Content.ReadAsStringAsync());
        Assert.Equal(zeroed, await _client.GetStringAsync("/api/scoreboard"));
    }

    private async Task<string> CreateGameAsync(string mode = "TwoPlayer")
    {
        var response = await _client.PostAsJsonAsync("/api/games", new { mode });
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync(response)).GetProperty("gameId").GetString()!;
    }

    private async Task<JsonElement> GetGameAsync(string gameId) =>
        await _client.GetFromJsonAsync<JsonElement>($"/api/games/{gameId}");

    private Task<HttpResponseMessage> PostMoveAsync(string gameId, string player, int row, int col) =>
        _client.PostAsJsonAsync($"/api/games/{gameId}/moves", new { player, row, col });

    // Sends the body exactly as written, for JSON that an anonymous object cannot express (missing or mistyped fields).
    private Task<HttpResponseMessage> PostRawJsonAsync(string url, string json) =>
        _client.PostAsync(url, new StringContent(json, Encoding.UTF8, "application/json"));

    // Each move is made by whoever's turn the server reports, so a test only lists the cells.
    private async Task<JsonElement> PlayAsync(string gameId, params Position[] positions)
    {
        var game = await GetGameAsync(gameId);
        foreach (var position in positions)
        {
            var player = game.GetProperty("currentPlayer").GetString()!;
            var response = await PostMoveAsync(gameId, player, position.Row, position.Col);
            response.EnsureSuccessStatusCode();
            game = await ReadJsonAsync(response);
        }

        return game;
    }

    // What a browser sends before a cross-origin POST with a JSON body.
    private Task<HttpResponseMessage> SendPreflightAsync(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/games");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        return _client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task AssertGameRuleProblemAsync(HttpResponseMessage response, string expectedDetail)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var problem = await ReadJsonAsync(response);
        Assert.Equal("Invalid move", problem.GetProperty("title").GetString());
        Assert.Equal(expectedDetail, problem.GetProperty("detail").GetString());
    }

    // Stands in for a storage failure the API does not expect, such as a database that is down.
    private sealed class ThrowingGameRepository : IGameRepository
    {
        private readonly string _message;

        public ThrowingGameRepository(string message)
        {
            _message = message;
        }

        public void Add(GameSession session) => throw new InvalidOperationException(_message);

        public GameSession? Find(Guid id) => throw new InvalidOperationException(_message);

        public int RemoveIdleSince(DateTimeOffset cutoff) => 0;
    }
}
