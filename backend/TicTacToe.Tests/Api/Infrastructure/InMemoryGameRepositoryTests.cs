using Microsoft.Extensions.Time.Testing;
using TicTacToe.Api.Infrastructure.Persistence;
using TicTacToe.Core.Domain;
using TicTacToe.Core.Scoring;
using TicTacToe.Core.Sessions;

namespace TicTacToe.Tests.Api.Infrastructure;

/// <summary>The store's idle tracking, on a fake clock: adding or finding a game counts as using it.</summary>
public sealed class InMemoryGameRepositoryTests
{
    private readonly FakeTimeProvider _clock = new();
    private readonly InMemoryGameRepository _repository;

    public InMemoryGameRepositoryTests()
    {
        _repository = new InMemoryGameRepository(_clock);
    }

    [Fact]
    public void RemoveIdleSince_GamesUsedBeforeAndAfterCutoff_RemovesOnlyTheIdleOne()
    {
        var addedAt = _clock.GetUtcNow();
        var idleGame = AddGame();
        var foundGame = AddGame();
        _clock.Advance(TimeSpan.FromHours(1));
        _repository.Find(foundGame.Id);

        var removed = _repository.RemoveIdleSince(addedAt + TimeSpan.FromMinutes(30));

        Assert.Equal(1, removed);
        Assert.Null(_repository.Find(idleGame.Id));
        Assert.Same(foundGame, _repository.Find(foundGame.Id));
    }

    private GameSession AddGame()
    {
        var session = new GameSession(Guid.NewGuid(), GameMode.TwoPlayer, new Scoreboard());
        _repository.Add(session);
        return session;
    }
}
