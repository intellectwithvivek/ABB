using Microsoft.Extensions.Options;
using TicTacToe.Api.Application;
using TicTacToe.Api.Configuration;

namespace TicTacToe.Api.Infrastructure.Maintenance;

/// <summary>
/// Every <see cref="GameSessionOptions.CleanupInterval"/>, removes the games that no request has used for longer than
/// <see cref="GameSessionOptions.IdleTimeout"/>. Games live in memory, so without this a public deployment would keep
/// every game ever started until the process restarts.
/// </summary>
/// <remarks>
/// A BackgroundService is a hosted service: ASP.NET Core starts <see cref="ExecuteAsync"/> with the app
/// and cancels its token when the app shuts down.
/// </remarks>
public sealed class ExpiredSessionCleanupService : BackgroundService
{
    private readonly IGameRepository _games;
    private readonly GameSessionOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<ExpiredSessionCleanupService> _logger;

    public ExpiredSessionCleanupService(
        IGameRepository games,
        IOptions<GameSessionOptions> options,
        TimeProvider timeProvider,
        ILogger<ExpiredSessionCleanupService> logger)
    {
        _games = games;
        _options = options.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // PeriodicTimer waits for one tick at a time, so two cleanups never overlap. It runs on the injected
        // TimeProvider, so a test triggers a tick by advancing a fake clock instead of waiting ten minutes.
        using var timer = new PeriodicTimer(_options.CleanupInterval, _timeProvider);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                RemoveIdleGames();
            }
            catch (Exception exception)
            {
                // An exception escaping ExecuteAsync stops the whole app in .NET 8, which would take the game API
                // offline for a housekeeping failure. Log it and try again at the next tick instead.
                _logger.LogError(exception, "Removing idle games failed; retrying at the next interval.");
            }
        }
    }

    private void RemoveIdleGames()
    {
        var removed = _games.RemoveIdleSince(_timeProvider.GetUtcNow() - _options.IdleTimeout);
        if (removed > 0)
        {
            _logger.LogInformation(
                "Removed {Count} game(s) idle for longer than {IdleTimeout}.", removed, _options.IdleTimeout);
        }
    }
}
