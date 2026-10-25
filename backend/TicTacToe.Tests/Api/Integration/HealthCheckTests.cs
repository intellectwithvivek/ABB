using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TicTacToe.Tests.Api.Integration;

/// <summary>GET /health, which hosting platforms call to check that the app is alive.</summary>
public sealed class HealthCheckTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory = new();
    private readonly HttpClient _client;

    public HealthCheckTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Fact]
    public async Task Health_AppRunning_Returns200Healthy()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }
}
