using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Options;
using TicTacToe.Api.Application;
using TicTacToe.Api.Configuration;
using TicTacToe.Api.ErrorHandling;
using TicTacToe.Api.Infrastructure.Maintenance;
using TicTacToe.Api.Infrastructure.Persistence;
using TicTacToe.Core.Scoring;

namespace TicTacToe.Api.Extensions;

/// <summary>
/// Registers everything the API needs in the dependency injection container. Program.cs calls
/// <see cref="AddTicTacToeApi"/> once; each private method below covers one concern.
/// </summary>
public static class ServiceCollectionExtensions
{
    // The largest valid body is about 40 bytes ({ "player": "X", "row": 0, "col": 0 }).
    private const int MaxRequestBodyBytes = 4 * 1024;

    public static IServiceCollection AddTicTacToeApi(this IServiceCollection services, IConfiguration configuration)
    {
        AddSettings(services, configuration);
        AddControllersWithJsonConventions(services);
        AddErrorHandling(services);
        AddGameServices(services);
        AddRateLimiting(services);

        // Kestrel's default is 30 MB; a body over MaxRequestBodyBytes is rejected with 413 (GameExceptionHandler).
        services.Configure<KestrelServerOptions>(kestrel => kestrel.Limits.MaxRequestBodySize = MaxRequestBodyBytes);

        // The CORS policy is applied in UseTicTacToeApi, from FrontendCorsOptions.
        services.AddCors();
        services.AddSwaggerGen();
        services.AddHealthChecks();
        return services;
    }

    // Typed settings (the Options pattern): each class is bound from its appsettings.json section and checked against
    // its [Range]/[MinLength] attributes when the app starts, so a bad value stops startup with a clear message.
    private static void AddSettings(IServiceCollection services, IConfiguration configuration)
    {
        AddValidatedOptions<FrontendCorsOptions>(services, configuration.GetSection(FrontendCorsOptions.SectionName));
        AddValidatedOptions<GameSessionOptions>(services, configuration.GetSection(GameSessionOptions.SectionName));
        AddValidatedOptions<RateLimitingOptions>(services, configuration.GetSection(RateLimitingOptions.SectionName));
        AddValidatedOptions<ApiDocumentationOptions>(
            services, configuration.GetSection(ApiDocumentationOptions.SectionName));
    }

    private static void AddValidatedOptions<TOptions>(IServiceCollection services, IConfigurationSection section)
        where TOptions : class =>
        services.AddOptions<TOptions>()
            .Bind(section)
            .ValidateDataAnnotations()
            .ValidateOnStart();

    private static void AddControllersWithJsonConventions(IServiceCollection services)
    {
        services
            .AddControllers(options =>
            {
                // When a body cannot be read, the JSON error already says why. Without this, nullable reference
                // types make MVC add a second, vaguer "The request field is required." error that can come first.
                options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;

                // No action returns a string; without this, Swagger lists text/plain first for every JSON response.
                options.OutputFormatters.RemoveType<StringOutputFormatter>();
            })
            .AddJsonOptions(options =>
            {
                // Enums travel as their names ("X", "VsComputer"); numbers such as "player": 1 are rejected.
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false));
            });
    }

    private static void AddErrorHandling(IServiceCollection services)
    {
        // Every error is RFC 7807 problem+json: AddProblemDetails covers the framework's own (e.g. the default 500),
        // and GameExceptionHandler maps the game's exceptions to 400 and 404.
        services.AddProblemDetails();
        services.AddExceptionHandler<GameExceptionHandler>();

        // In .NET 8 the exception middleware logs every exception as unhandled, even an expected 400/404.
        // GameExceptionHandler logs the unexpected ones itself, so real server errors are still recorded.
        services.AddLogging(logging =>
            logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware", LogLevel.None));
    }

    private static void AddGameServices(IServiceCollection services)
    {
        // Singletons: they hold the server's in-memory state, which every request must share.
        services.AddSingleton<IGameRepository, InMemoryGameRepository>();
        services.AddSingleton<IScoreboardService, Scoreboard>();

        // Scoped: GameService keeps no state of its own; it works on the singletons above.
        services.AddScoped<GameService>();

        // The clock is injected (not read from DateTimeOffset.UtcNow) so tests can use a fake one.
        services.AddSingleton(TimeProvider.System);
        services.AddHostedService<ExpiredSessionCleanupService>();
    }

    private static void AddRateLimiting(IServiceCollection services)
    {
        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.OnRejected = RateLimitRejectionHandler.WriteProblemAsync;

            // One fixed window per client IP address for every request, so a client flooding the public demo is
            // slowed down without affecting anyone else.
            limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                PerClientWindow(httpContext, settings => settings.PermitLimit));

            // A lower, additional limit for the actions marked [EnableRateLimiting(CreateGamePolicy)].
            limiter.AddPolicy(RateLimitingOptions.CreateGamePolicy, httpContext =>
                PerClientWindow(httpContext, settings => settings.CreateGamePermitLimit));
        });
    }

    // Runs for every request; IOptions<T> is a singleton that caches its value, so the lookup is cheap.
    private static RateLimitPartition<string> PerClientWindow(
        HttpContext httpContext, Func<RateLimitingOptions, int> permitLimit)
    {
        var settings = httpContext.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value;

        // The address is missing only without a real connection, e.g. on the in-memory test server.
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit(settings),
            Window = TimeSpan.FromSeconds(settings.WindowSeconds),
        });
    }
}
