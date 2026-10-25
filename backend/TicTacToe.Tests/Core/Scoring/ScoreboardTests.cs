using TicTacToe.Core.Domain;
using TicTacToe.Core.Scoring;

namespace TicTacToe.Tests.Core.Scoring;

public sealed class ScoreboardTests
{
    // xUnit creates a new instance of the test class for every test (like JUnit), so each test gets a fresh scoreboard.
    private readonly Scoreboard _scoreboard = new();

    [Fact]
    public void GetScores_NewScoreboard_ReturnsZeroes()
    {
        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 0, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void RecordWin_PlayerX_IncrementsOnlyXWins()
    {
        _scoreboard.RecordWin(Player.X);

        Assert.Equal(new ScoreSnapshot(XWins: 1, OWins: 0, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void RecordWin_PlayerO_IncrementsOnlyOWins()
    {
        _scoreboard.RecordWin(Player.O);

        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 1, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void RecordDraw_Once_IncrementsOnlyDraws()
    {
        _scoreboard.RecordDraw();

        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 0, Draws: 1), _scoreboard.GetScores());
    }

    [Fact]
    public void Reset_AfterResults_ZeroesAllCounters()
    {
        _scoreboard.RecordWin(Player.X);
        _scoreboard.RecordWin(Player.O);
        _scoreboard.RecordDraw();

        _scoreboard.Reset();

        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 0, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void RecordResults_CalledInParallel_CountsEveryCall()
    {
        const int gamesPerResult = 10_000;

        // One scoreboard is shared by every game on the server. Without its lock, parallel ++ operations
        // overwrite each other and the totals come out short (likely, though not certain, on any single run).
        Parallel.For(0, gamesPerResult, _ =>
        {
            _scoreboard.RecordWin(Player.X);
            _scoreboard.RecordWin(Player.O);
            _scoreboard.RecordDraw();
        });

        Assert.Equal(new ScoreSnapshot(gamesPerResult, gamesPerResult, gamesPerResult), _scoreboard.GetScores());
    }
}
