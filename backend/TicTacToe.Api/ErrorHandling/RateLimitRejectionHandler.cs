using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace TicTacToe.Api.ErrorHandling;

/// <summary>
/// Writes the rate limiter's 429 Too Many Requests response as problem+json, like every other API error,
/// so the frontend can show its detail.
/// </summary>
public static class RateLimitRejectionHandler
{
    private const string Message = "Too many requests. Please wait a moment and try again.";

    // The signature is the one RateLimiterOptions.OnRejected expects; the limiter has already set the 429 status code.
    public static async ValueTask WriteProblemAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        var httpContext = context.HttpContext;

        // Retry-After (in seconds) tells a well-behaved client when it may try again. Rounded up, so 0.6 seconds
        // left in the window becomes 1 instead of "retry now", which would be rejected again.
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            httpContext.Response.Headers.RetryAfter =
                ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
        }

        var problemDetailsService = httpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        var written = await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                // Set by hand: ASP.NET Core fills in "type" for 400 or 404, but has no default for 429.
                Type = "https://tools.ietf.org/html/rfc6585#section-4",
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too many requests",
                Detail = Message,
            },
        });

        // No JSON writer accepts a request whose Accept header excludes JSON (e.g. "text/plain" outside the
        // controllers). Plain text keeps it a 429; throwing here would turn it into a logged 500.
        if (!written)
        {
            await httpContext.Response.WriteAsync(Message, cancellationToken);
        }
    }
}
