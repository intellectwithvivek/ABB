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

        // Kestrel accepts 30 MB bodies by default, which a public client could send only to make the server read
        // and parse them. A larger body is rejected with 413 (mapped by GameExceptionHandler).
        services.Configure<KestrelServerOptions>(kestrel => kestrel.Limits.MaxRequestBodySize = MaxRequestBodyBytes);

        // The CORS policy itself is applied in UseTicTacToeApi, from FrontendCorsOptions.
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
        // JSON properties are camelCase by default; enums are sent and read as their names ("X", "VsComputer"),
        // and allowIntegerValues: false rejects numbers such as "player": 1 instead of mapping them to a value.
        // SuppressImplicitRequired...: when a body cannot be read, the JSON error already says why. Without it,
        // MVC adds a second, vaguer "The request field is required." error (nullable reference types make every
        // non-nullable parameter implicitly [Required]), and that one can come first in the "errors" list the
        // client shows.
        // The text/plain formatter is removed because no action returns a string: Swagger would otherwise list
        // text/plain as the first (default) media type of every JSON response.
        services
            .AddControllers(options =>
            {
                options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
                options.OutputFormatters.RemoveType<StringOutputFormatter>();
            })
            .AddJsonOptions(options =>
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));
    }

    private static void AddErrorHandling(IServiceCollection services)
    {
        // Errors are written as RFC 7807 problem+json: AddProblemDetails covers the framework's own (e.g. the
        // default 500), and GameExceptionHandler maps the game's exceptions to 400 and 404 in the same format.
        services.AddProblemDetails();
        services.AddExceptionHandler<GameExceptionHandler>();

        // In .NET 8 the exception middleware logs every exception as "unhandled" (with a stack trace) before
        // GameExceptionHandler turns it into a normal 400/404. That log is switched off here; GameExceptionHandler
        // logs the exceptions it does not expect, so real server errors are still recorded.
        services.AddLogging(logging =>
            logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware", LogLevel.None));
    }

    private static void AddGameServices(IServiceCollection services)
    {
        // Singletons: these hold the server's in-memory state, so every request must share the same instance.
        services.AddSingleton<IGameRepository, InMemoryGameRepository>();
        services.AddSingleton<IScoreboardService, Scoreboard>();

        // Scoped (one per request): GameService keeps no state of its own; it works on the singletons above.
        services.AddScoped<GameService>();

        // The real clock, injected (instead of read from DateTimeOffset.UtcNow) so tests can use a fake one.
        services.AddSingleton(TimeProvider.System);

        // A hosted service: started and stopped together with the app.
        services.AddHostedService<ExpiredSessionCleanupService>();
    }

    private static void AddRateLimiting(IServiceCollection services)
    {
        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.OnRejected = RateLimitRejectionHandler.WriteProblemAsync;

            // One fixed window per client IP address, so a client flooding the public demo is slowed down without
            // affecting anyone else. It applies to every request.
            limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                PerClientWindow(httpContext, settings => settings.PermitLimit));

            // A second, lower limit, which only the actions marked [EnableRateLimiting(CreateGamePolicy)]
            // also have to pass.
            limiter.AddPolicy(RateLimitingOptions.CreateGamePolicy, httpContext =>
                PerClientWindow(httpContext, settings => settings.CreateGamePermitLimit));
        });
    }

    // Runs for every request. The validated settings are read from the request's services; IOptions<T> is a
    // singleton that caches its value, so the lookup is cheap.
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
