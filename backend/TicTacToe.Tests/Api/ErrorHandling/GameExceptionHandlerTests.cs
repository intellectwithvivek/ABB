using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using TicTacToe.Api.Application;
using TicTacToe.Api.ErrorHandling;

namespace TicTacToe.Tests.Api.ErrorHandling;

/// <summary>
/// The exception handler on its own, for cases an in-memory test server cannot produce: Kestrel rejecting a request
/// body, and a client that does not accept JSON.
/// </summary>
public sealed class GameExceptionHandlerTests : IDisposable
{
    private readonly ServiceProvider _services =
        new ServiceCollection().AddOptions().AddProblemDetails().BuildServiceProvider();
    private readonly GameExceptionHandler _handler;

    public GameExceptionHandlerTests()
    {
        _handler = new GameExceptionHandler(
            _services.GetRequiredService<IProblemDetailsService>(), NullLogger<GameExceptionHandler>.Instance);
    }

    public void Dispose()
    {
        _services.Dispose();
    }

    [Fact]
    public async Task TryHandleAsync_RequestBodyTooLarge_Writes413ProblemWithKestrelMessage()
    {
        var httpContext = NewHttpContext();
        const string kestrelMessage = "Request body too large. The max request body size is 4096 bytes.";

        var handled = await _handler.TryHandleAsync(
            httpContext, new BadHttpRequestException(kestrelMessage, StatusCodes.Status413PayloadTooLarge), default);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, httpContext.Response.StatusCode);
        httpContext.Response.Body.Position = 0;
        var problem = await JsonSerializer.DeserializeAsync<JsonElement>(httpContext.Response.Body);
        Assert.Equal(kestrelMessage, problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task TryHandleAsync_ClientDoesNotAcceptJson_HandlesWithStatusCodeAndNoBody()
    {
        var httpContext = NewHttpContext();
        httpContext.Request.Headers.Accept = "text/plain";

        var handled = await _handler.TryHandleAsync(httpContext, new GameNotFoundException(Guid.NewGuid()), default);

        // Reporting "not handled" here would make the .NET 8 middleware treat the 404 as a configuration error.
        Assert.True(handled);
        Assert.Equal(StatusCodes.Status404NotFound, httpContext.Response.StatusCode);
        Assert.Equal(0, httpContext.Response.Body.Length);
    }

    private DefaultHttpContext NewHttpContext() =>
        new() { RequestServices = _services, Response = { Body = new MemoryStream() } };
}
