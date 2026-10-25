using System.Collections.Concurrent;
using TicTacToe.Api.Application;
using TicTacToe.Core.Sessions;

namespace TicTacToe.Api.Infrastructure.Persistence;

/// <summary>
/// Keeps every game in memory for the lifetime of the server process; a restart loses them.
/// It also remembers when each game was last used, so idle games can be removed to keep memory bounded.
/// </summary>
public sealed class InMemoryGameRepository : IGameRepository
{
    // One instance (a DI singleton) serves all requests, which run in parallel on different threads.
    // ConcurrentDictionary makes Add and Find thread-safe without a global lock; changes to a single
    // game are serialized separately by GameService locking that game's SyncRoot.
    private readonly ConcurrentDictionary<Guid, SessionEntry> _sessions = new();
    private readonly TimeProvider _timeProvider;

    // TimeProvider (new in .NET 8) instead of DateTimeOffset.UtcNow, so tests can move the clock with FakeTimeProvider.
    public InMemoryGameRepository(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
    }

    public void Add(GameSession session)
    {
        if (!_sessions.TryAdd(session.Id, new SessionEntry(session, _timeProvider.GetUtcNow())))
        {
            throw new InvalidOperationException($"A game with id '{session.Id}' already exists.");
        }
    }

    public GameSession? Find(Guid id)
    {
        if (!_sessions.TryGetValue(id, out var entry))
        {
            return null;
        }

        // TryUpdate only replaces the entry that was just read, so it can never bring back a game removed
        // in the meantime.
        _sessions.TryUpdate(id, entry with { LastUsed = _timeProvider.GetUtcNow() }, entry);
        return entry.Session;
    }

    public int RemoveIdleSince(DateTimeOffset cutoff)
    {
        var removed = 0;
        foreach (var pair in _sessions)
        {
            // Removing the exact key/value pair that was checked: a game found after the check has a new entry
            // and stays.
            if (pair.Value.LastUsed < cutoff && _sessions.TryRemove(pair))
            {
                removed++;
            }
        }

        return removed;
    }

    // Immutable, so "last used" changes by swapping the whole entry atomically instead of editing it under a lock.
    private sealed record SessionEntry(GameSession Session, DateTimeOffset LastUsed);
}
