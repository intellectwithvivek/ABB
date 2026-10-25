using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Options;

namespace TicTacToe.Tests.Api.Integration;

/// <summary>
/// Settings from appsettings.json that change how the app starts: the Swagger switch and startup validation.
/// </summary>
public sealed class ConfigurationTests : IDisposable
{
    private const string SwaggerDocumentUrl = "/swagger/v1/swagger.json";

    private readonly WebApplicationFactory<Program> _factory = new();

    public void Dispose()
    {
        _factory.Dispose();
    }

    [Fact]
    public async Task SwaggerDocument_DefaultSettings_IsServed()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync(SwaggerDocumentUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SwaggerDocument_DefaultSettings_ListsApplicationJsonFirstForResponses()
    {
        using var client = _factory.CreateClient();

        var document = await client.GetStringAsync(SwaggerDocumentUrl);

        // Swagger UI preselects the first media type of a response; text/plain would be misleading for JSON.
        Assert.DoesNotContain("text/plain", document);
    }

    [Fact]
    public async Task SwaggerDocument_SwaggerDisabled_Returns404()
    {
        using var client = WithSetting("Swagger:Enabled", "false").CreateClient();

        var response = await client.GetAsync(SwaggerDocumentUrl);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public void Startup_ZeroCleanupInterval_FailsWithValidationError()
    {
        var factory = WithSetting("Sessions:CleanupInterval", "00:00:00");

        var exception = Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
        Assert.Contains("CleanupInterval", exception.Message);
    }

    [Theory]
    [InlineData("https://intellectwithvivek.github.io/ABB")]
    [InlineData("https://example.vercel.app/")]
    [InlineData("example.com")]
    public void Startup_CorsOriginNotSchemeAndHost_FailsWithValidationError(string origin)
    {
        // A browser sends its origin without a path or trailing slash, so such an entry would never match.
        var factory = WithSetting("Cors:AllowedOrigins:0", origin);

        var exception = Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
        Assert.Contains(origin, exception.Message);
    }

    // The derived factory is disposed together with _factory.
    private WebApplicationFactory<Program> WithSetting(string key, string value) =>
        _factory.WithWebHostBuilder(builder => builder.UseSetting(key, value));
}
