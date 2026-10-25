using TicTacToe.Core.Domain;

namespace TicTacToe.Core.Scoring;

/// <summary>
/// Totals of finished games for the lifetime of the server, shared by every game.
/// An interface so a persistent store could replace the in-memory <see cref="Scoreboard"/>.
/// </summary>
public interface IScoreboardService
{
    ScoreSnapshot GetScores();

    void RecordWin(Player winner);

    void RecordDraw();

    void Reset();
}
