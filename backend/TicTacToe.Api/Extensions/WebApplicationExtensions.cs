using Microsoft.Extensions.Options;
using TicTacToe.Api.Configuration;

namespace TicTacToe.Api.Extensions;

/// <summary>
/// Builds the HTTP request pipeline. Middleware runs in the order it is added, so each step says why it is where it is.
/// </summary>
public static class WebApplicationExtensions
{
    public static WebApplication UseTicTacToeApi(this WebApplication app)
    {
        // First in the pipeline so it catches exceptions thrown by everything after it.
        app.UseExceptionHandler();

        // Gives a problem+json body to error responses that would otherwise be empty, e.g. 404 for an unknown path
        // or an id that is not a GUID, and 405 for a wrong HTTP method, so the frontend always has a message to show.
        app.UseStatusCodePages();

        // CORS matters only when the frontend runs on another origin, e.g. the Angular dev server; the deployed site
        // proxies /api and is same-origin. It comes before the rate limiter, so a 429 still carries the CORS header
        // the browser needs to show it, and preflight requests never use up the limit.
        var cors = app.Services.GetRequiredService<IOptions<FrontendCorsOptions>>().Value;
        app.UseCors(policy => policy.WithOrigins(cors.AllowedOrigins).AllowAnyHeader().AllowAnyMethod());

        app.UseRateLimiter();

        if (app.Services.GetRequiredService<IOptions<ApiDocumentationOptions>>().Value.Enabled)
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        // Hosting platforms call /health to check that the app is alive. It is exempt from rate limiting so that
        // a busy client can never make the platform think the app is down and restart it.
        app.MapHealthChecks("/health").DisableRateLimiting();
        app.MapControllers();
        return app;
    }
}
