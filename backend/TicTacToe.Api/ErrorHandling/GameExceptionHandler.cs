using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TicTacToe.Api.Application;
using TicTacToe.Core.Engine;

namespace TicTacToe.Api.ErrorHandling;

/// <summary>
/// Turns the expected exceptions into RFC 7807 problem+json responses: a broken game rule becomes
/// 400 Bad Request, an unknown game id becomes 404 Not Found, and a request the server itself rejects
/// (for example a body over the size limit) keeps its own status code. The exception message is the "detail".
/// </summary>
/// <remarks>
/// IExceptionHandler (new in .NET 8) is the framework's one place for mapping exceptions to responses,
/// so the controllers contain no try/catch. It is called by the UseExceptionHandler middleware.
/// </remarks>
public sealed class GameExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;
    private readonly ILogger<GameExceptionHandler> _logger;

    public GameExceptionHandler(IProblemDetailsService problemDetailsService, ILogger<GameExceptionHandler> logger)
    {
        _problemDetailsService = problemDetailsService;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (ToStatusAndTitle(exception) is not { } problem)
        {
            // A real bug. Logged here because AddTicTacToeApi silences the middleware's own log, which would
            // otherwise report every expected 400/404 as an error too. Returning false lets the default
            // handler answer 500 without leaking details.
            _logger.LogError(
                exception,
                "Unhandled exception for {Method} {Path}",
                httpContext.Request.Method,
                httpContext.Request.Path);
            return false;
        }

        httpContext.Response.StatusCode = problem.StatusCode;
        await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = problem.StatusCode,
                Title = problem.Title,
                Detail = exception.Message,
            },
        });

        // Handled even when no body could be written (a client whose Accept header excludes JSON): the status
        // code is already right. Returning false would make the middleware treat this 400/404 as a failure.
        return true;
    }

    private static (int StatusCode, string Title)? ToStatusAndTitle(Exception exception) => exception switch
    {
        GameRuleException => (StatusCodes.Status400BadRequest, "Invalid move"),
        GameNotFoundException => (StatusCodes.Status404NotFound, "Game not found"),

        // Thrown by Kestrel when it rejects the request itself, e.g. 413 for a body over MaxRequestBodySize.
        BadHttpRequestException badRequest => (badRequest.StatusCode, "Invalid request"),
        _ => null,
    };
}
