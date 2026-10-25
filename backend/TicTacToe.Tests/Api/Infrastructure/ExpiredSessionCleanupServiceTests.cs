using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using TicTacToe.Api.Application;
using TicTacToe.Api.Configuration;
using TicTacToe.Api.Infrastructure.Maintenance;
using TicTacToe.Api.Infrastructure.Persistence;
using TicTacToe.Core.Domain;
using TicTacToe.Core.Scoring;
using TicTacToe.Core.Sessions;

namespace TicTacToe.Tests.Api.Infrastructure;

/// <summary>
/// The background cleanup with the real repository on a fake clock: advancing FakeTimeProvider fires the
/// cleanup timer immediately, so hours of idle time pass in milliseconds.
/// </summary>
public sealed class ExpiredSessionCleanupServiceTests
{
    private static readonly GameSessionOptions Settings = new()
    {
        IdleTimeout = TimeSpan.FromHours(2),
        CleanupInterval = TimeSpan.FromMinutes(10),
    };

    private readonly FakeTimeProvider _clock = new();
    private readonly InMemoryGameRepository _games;

    public ExpiredSessionCleanupServiceTests()
    {
        _games = new InMemoryGameRepository(_clock);
    }

    [Fact]
    public async Task CleanupTick_IdleAndRecentlyUsedGames_RemovesOnlyTheIdleOne()
    {
        var idleGame = AddGame();
        var activeGame = AddGame();
        _clock.Advance(Settings.IdleTimeout);
        _games.Find(activeGame.Id);
        var service = new ExpiredSessionCleanupService(
            _games, Options.Create(Settings), _clock, NullLogger<ExpiredSessionCleanupService>.Instance);

        await service.StartAsync(CancellationToken.None);
        _clock.Advance(Settings.CleanupInterval);

        // StopAsync waits for the service's loop to end. The tick has already completed the loop's wait,
        // so the loop runs that cleanup before it notices the stop request.
        await service.StopAsync(CancellationToken.None);

        Assert.Null(_games.Find(idleGame.Id));
        Assert.Same(activeGame, _games.Find(activeGame.Id));
    }

    [Fact]
    public async Task CleanupTick_RepositoryThrows_KeepsRunningAndRetriesAtNextTick()
    {
        var games = new FailingOnceGameRepository();
        var service = new ExpiredSessionCleanupService(
            games, Options.Create(Settings), _clock, NullLogger<ExpiredSessionCleanupService>.Instance);
        await service.StartAsync(CancellationToken.None);

        // Each tick is awaited before the next one, so two ticks can never merge into one.
        _clock.Advance(Settings.CleanupInterval);
        await games.WaitForNextCallAsync();
        _clock.Advance(Settings.CleanupInterval);
        await games.WaitForNextCallAsync();
        await service.StopAsync(CancellationToken.None);

        // Without the catch, the first exception would have ended the loop (and, in .NET 8, stopped the app).
        Assert.Equal(2, games.Calls);
    }

    private GameSession AddGame()
    {
        var session = new GameSession(Guid.NewGuid(), GameMode.TwoPlayer, new Scoreboard());
        _games.Add(session);
        return session;
    }

    // Fails on the first cleanup, as a database-backed store might when its connection drops.
    private sealed class FailingOnceGameRepository : IGameRepository
    {
        private readonly SemaphoreSlim _called = new(0);

        public int Calls { get; private set; }

        public void Add(GameSession session) => throw new NotSupportedException();

        public GameSession? Find(Guid id) => throw new NotSupportedException();

        public int RemoveIdleSince(DateTimeOffset cutoff)
        {
            Calls++;
            _called.Release();
            if (Calls == 1)
            {
                throw new InvalidOperationException("Storage unavailable.");
            }

            return 0;
        }

        // With a time limit, so a loop that has stopped fails the test instead of hanging it.
        public async Task WaitForNextCallAsync() =>
            Assert.True(await _called.WaitAsync(TimeSpan.FromSeconds(5)), "The cleanup did not run.");
    }
}
