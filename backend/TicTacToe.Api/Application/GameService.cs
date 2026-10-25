using TicTacToe.Api.Contracts.Responses;
using TicTacToe.Api.Mapping;
using TicTacToe.Core.Domain;
using TicTacToe.Core.Engine;
using TicTacToe.Core.Scoring;
using TicTacToe.Core.Sessions;

namespace TicTacToe.Api.Application;

/// <summary>
/// The application layer between the controllers and TicTacToe.Core: finds the game, runs one action on it
/// under that game's lock and returns the resulting state. The game rules themselves stay in Core.
/// </summary>
/// <remarks>
/// It returns the response DTO (not a Core object) on purpose: the response must be built while the game's lock
/// is held, so it is a consistent snapshot, and this class is the only one that holds that lock.
/// GameStateResponse is an immutable copy, safe to serialize after the lock is released.
/// </remarks>
public sealed class GameService
{
    private readonly IGameRepository _games;
    private readonly IScoreboardService _scoreboard;

    public GameService(IGameRepository games, IScoreboardService scoreboard)
    {
        _games = games;
        _scoreboard = scoreboard;
    }

    public GameStateResponse CreateGame(GameMode mode)
    {
        var session = new GameSession(Guid.NewGuid(), mode, _scoreboard);

        // Mapped before Add, while no other request can see the game yet, so no lock is needed.
        var state = ResponseMapper.ToGameState(session, _scoreboard.GetScores());
        _games.Add(session);
        return state;
    }

    /// <summary>
    /// Reads under the game's lock like every other action, so it never sees a half-finished request,
    /// e.g. the human's move applied but not yet the computer's reply.
    /// </summary>
    /// <exception cref="GameNotFoundException">No game has this id.</exception>
    public GameStateResponse GetGame(Guid id) =>
        RunLocked(id, _ => { });

    /// <exception cref="GameNotFoundException">No game has this id.</exception>
    /// <exception cref="GameRuleException">The move breaks a game rule; the game is unchanged.</exception>
    public GameStateResponse SubmitMove(Guid id, Player player, Position position) =>
        RunLocked(id, session => session.PlayMove(player, position));

    /// <exception cref="GameNotFoundException">No game has this id.</exception>
    /// <exception cref="GameRuleException">There is nothing to undo, or the game has ended.</exception>
    public GameStateResponse Undo(Guid id) =>
        RunLocked(id, session => session.Undo());

    /// <exception cref="GameNotFoundException">No game has this id.</exception>
    public GameStateResponse Reset(Guid id) =>
        RunLocked(id, session => session.Reset());

    // GameSession is not thread-safe, and two requests for the same game can arrive at once (e.g. a double click).
    // Locking the game's own SyncRoot runs them one at a time while requests for other games still run in parallel.
    // Mapping inside the lock makes the response a consistent snapshot of the state this action produced.
    private GameStateResponse RunLocked(Guid id, Action<GameSession> action)
    {
        var session = _games.Find(id) ?? throw new GameNotFoundException(id);
        lock (session.SyncRoot)
        {
            action(session);
            return ResponseMapper.ToGameState(session, _scoreboard.GetScores());
        }
    }
}
