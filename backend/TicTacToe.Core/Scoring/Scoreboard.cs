using TicTacToe.Core.Domain;

namespace TicTacToe.Core.Scoring;

/// <summary>
/// In-memory scoreboard. It must be thread-safe because one instance (a DI singleton)
/// is shared by every game, and requests for different games run in parallel.
/// </summary>
public sealed class Scoreboard : IScoreboardService
{
    // One private lock guards all three counters, so GetScores always returns a consistent snapshot.
    // It is private (never `this`) so no outside code can take the same lock.
    private readonly object _lock = new();
    private int _xWins;
    private int _oWins;
    private int _draws;

    public ScoreSnapshot GetScores()
    {
        lock (_lock)
        {
            return new ScoreSnapshot(_xWins, _oWins, _draws);
        }
    }

    public void RecordWin(Player winner)
    {
        lock (_lock)
        {
            if (winner == Player.X)
            {
                _xWins++;
            }
            else
            {
                _oWins++;
            }
        }
    }

    public void RecordDraw()
    {
        lock (_lock)
        {
            _draws++;
        }
    }

    public void Reset()
    {
        lock (_lock)
        {
            _xWins = 0;
            _oWins = 0;
            _draws = 0;
        }
    }
}
