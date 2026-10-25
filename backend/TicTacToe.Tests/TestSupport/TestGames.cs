using TicTacToe.Core.Domain;
using TicTacToe.Core.Engine;
using TicTacToe.Core.Sessions;

namespace TicTacToe.Tests.TestSupport;

/// <summary>
/// Plays a list of cells, each one by whoever's turn it is, so a test only has to list the cells.
/// Also holds the move sequences that several tests share (moves alternate X, O, X, ...).
/// </summary>
internal static class TestGames
{
    /// <summary>X completes the top row on the fifth move. Final board: XXX / OO. / ...</summary>
    public static Position[] XWinsOnTopRow =>
    [
        new(0, 0), new(1, 0), new(0, 1), new(1, 1), new(0, 2),
    ];

    /// <summary>All nine cells are filled and nobody has a line. Final board: XOX / XOO / OXX</summary>
    public static Position[] FullBoardDraw =>
    [
        new(0, 0), new(0, 1), new(0, 2), new(1, 1), new(1, 0),
        new(1, 2), new(2, 1), new(2, 0), new(2, 2),
    ];

    public static void Play(GameEngine engine, params Position[] positions)
    {
        foreach (var position in positions)
        {
            engine.ApplyMove(engine.CurrentPlayer, position);
        }
    }

    /// <remarks>
    /// In VsComputer mode the computer replies inside each PlayMove call, so pass only the human's (X's) cells.
    /// </remarks>
    public static void Play(GameSession session, params Position[] positions)
    {
        foreach (var position in positions)
        {
            session.PlayMove(session.CurrentPlayer, position);
        }
    }
}
