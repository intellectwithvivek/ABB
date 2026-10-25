using TicTacToe.Core.Sessions;

namespace TicTacToe.Api.Application;

/// <summary>
/// Stores game sessions by id. An interface so a database-backed store could replace the in-memory one.
/// It belongs to the application layer because GameService defines what it needs from storage (a "port").
/// </summary>
public interface IGameRepository
{
    void Add(GameSession session);

    /// <summary>
    /// Finds a game. Finding it counts as using it, so a game that is still being played is never removed as idle.
    /// </summary>
    /// <returns>The game, or null when no game has this id.</returns>
    GameSession? Find(Guid id);

    /// <summary>Removes every game that has not been added or found since <paramref name="cutoff"/>.</summary>
    /// <returns>How many games were removed.</returns>
    int RemoveIdleSince(DateTimeOffset cutoff);
}
