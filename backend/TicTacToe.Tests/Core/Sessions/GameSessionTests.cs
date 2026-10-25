using TicTacToe.Core.Domain;
using TicTacToe.Core.Engine;
using TicTacToe.Core.Scoring;
using TicTacToe.Core.Sessions;
using TicTacToe.Tests.TestSupport;

namespace TicTacToe.Tests.Core.Sessions;

/// <summary>
/// The product's rules in Two Player mode: undo (with the Option A policy), Reset Game and the scoreboard.
/// </summary>
public sealed class GameSessionTests
{
    private const string UndoAfterGameEndedMessage =
        "Undo is not available after the game has ended. Reset the game to play again.";

    // xUnit creates a new instance of the test class for every test (like JUnit), so each test gets
    // a fresh scoreboard.
    private readonly Scoreboard _scoreboard = new();

    [Fact]
    public void Undo_TwoPlayerMode_RemovesLastMoveAndRestoresTurn()
    {
        var session = NewTwoPlayerSession();
        session.PlayMove(Player.X, new Position(0, 0));
        session.PlayMove(Player.O, new Position(1, 1));

        session.Undo();

        Assert.Equal(["X..", "...", "..."], TestBoards.Render(session.Board));
        Assert.Equal(new Move(1, Player.X, new Position(0, 0)), Assert.Single(session.Moves));
        Assert.Equal(Player.O, session.CurrentPlayer);
        Assert.True(session.CanUndo);
    }

    [Fact]
    public void PlayMove_AfterUndo_ContinuesMoveNumbering()
    {
        var session = NewTwoPlayerSession();
        TestGames.Play(session, new(0, 0), new(1, 1));
        session.Undo();

        // O plays again in a different cell: the history stays consecutive (1, 2), with no gap and no duplicate.
        session.PlayMove(Player.O, new Position(2, 2));

        Assert.Equal(
            [new Move(1, Player.X, new Position(0, 0)), new Move(2, Player.O, new Position(2, 2))],
            session.Moves);
        Assert.Equal(["X..", "...", "..O"], TestBoards.Render(session.Board));
    }

    [Fact]
    public void Undo_NoMoves_ThrowsNothingToUndo()
    {
        var session = NewTwoPlayerSession();
        Assert.False(session.CanUndo);

        var exception = Assert.Throws<GameRuleException>(() => session.Undo());

        Assert.Equal("There are no moves to undo.", exception.Message);
        Assert.Empty(session.Moves);
        Assert.Equal(Player.X, session.CurrentPlayer);
    }

    [Fact]
    public void Undo_AfterWin_ThrowsBecauseGameEnded()
    {
        var session = NewTwoPlayerSession();
        TestGames.Play(session, TestGames.XWinsOnTopRow);
        Assert.False(session.CanUndo);

        var exception = Assert.Throws<GameRuleException>(() => session.Undo());

        Assert.Equal(UndoAfterGameEndedMessage, exception.Message);
        Assert.Equal(GameStatus.Won, session.Status);
        Assert.Equal(5, session.Moves.Count);
        Assert.Equal(["XXX", "OO.", "..."], TestBoards.Render(session.Board));
    }

    [Fact]
    public void Undo_AfterDraw_ThrowsBecauseGameEnded()
    {
        var session = NewTwoPlayerSession();
        TestGames.Play(session, TestGames.FullBoardDraw);
        Assert.False(session.CanUndo);

        var exception = Assert.Throws<GameRuleException>(() => session.Undo());

        Assert.Equal(UndoAfterGameEndedMessage, exception.Message);
        Assert.Equal(GameStatus.Draw, session.Status);
        Assert.Equal(9, session.Moves.Count);
        Assert.Equal(["XOX", "XOO", "OXX"], TestBoards.Render(session.Board));
    }

    [Fact]
    public void Reset_AfterWin_ClearsGameStartsWithXAndKeepsScoreboard()
    {
        var session = NewTwoPlayerSession();
        TestGames.Play(session, TestGames.XWinsOnTopRow);

        // After X's fifth move it would be O's turn, so Reset really has to hand the turn back to X.
        session.Reset();

        Assert.Equal(["...", "...", "..."], TestBoards.Render(session.Board));
        Assert.Empty(session.Moves);
        Assert.Equal(GameStatus.InProgress, session.Status);
        Assert.Null(session.Winner);
        Assert.Empty(session.WinningCells);
        Assert.Equal(Player.X, session.CurrentPlayer);
        Assert.Equal(new ScoreSnapshot(XWins: 1, OWins: 0, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void Reset_GameInProgress_KeepsIdAndMode()
    {
        var id = Guid.NewGuid();
        // VsComputer, because TwoPlayer is the enum's default value and would pass even if Reset wiped the mode.
        var session = new GameSession(id, GameMode.VsComputer, _scoreboard);
        session.PlayMove(Player.X, new Position(0, 0));

        session.Reset();

        Assert.Equal(id, session.Id);
        Assert.Equal(GameMode.VsComputer, session.Mode);
    }

    [Fact]
    public void PlayMove_GameWon_RecordsWinExactlyOnce()
    {
        var session = NewTwoPlayerSession();
        var oneXWin = new ScoreSnapshot(XWins: 1, OWins: 0, Draws: 0);

        TestGames.Play(session, TestGames.XWinsOnTopRow);
        Assert.Equal(oneXWin, _scoreboard.GetScores());

        Assert.Throws<GameRuleException>(() => session.PlayMove(Player.O, new Position(2, 2)));
        Assert.Equal(oneXWin, _scoreboard.GetScores());

        Assert.Throws<GameRuleException>(() => session.Undo());
        Assert.Equal(oneXWin, _scoreboard.GetScores());

        session.Reset();
        Assert.Equal(oneXWin, _scoreboard.GetScores());
    }

    [Fact]
    public void PlayMove_OCompletesRow_RecordsOWin()
    {
        var session = NewTwoPlayerSession();

        // O completes the middle row on the sixth move.
        TestGames.Play(session, new(0, 0), new(1, 0), new(0, 1), new(1, 1), new(2, 2), new(1, 2));

        Assert.Equal(Player.O, session.Winner);
        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 1, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void PlayMove_ScoreboardResetMidGame_RecordsResultOnce()
    {
        var session = NewTwoPlayerSession();
        TestGames.Play(session, TestGames.XWinsOnTopRow[..4]);

        // Reset Scoreboard does not touch games in progress: this game's result still counts, once.
        _scoreboard.Reset();
        TestGames.Play(session, TestGames.XWinsOnTopRow[4]);

        Assert.Equal(new ScoreSnapshot(XWins: 1, OWins: 0, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void PlayMove_GameDrawn_RecordsDrawExactlyOnce()
    {
        var session = NewTwoPlayerSession();
        var oneDraw = new ScoreSnapshot(XWins: 0, OWins: 0, Draws: 1);

        TestGames.Play(session, TestGames.FullBoardDraw);
        Assert.Equal(oneDraw, _scoreboard.GetScores());

        Assert.Throws<GameRuleException>(() => session.PlayMove(Player.O, new Position(0, 0)));
        Assert.Equal(oneDraw, _scoreboard.GetScores());

        Assert.Throws<GameRuleException>(() => session.Undo());
        Assert.Equal(oneDraw, _scoreboard.GetScores());

        session.Reset();
        Assert.Equal(oneDraw, _scoreboard.GetScores());
    }

    [Fact]
    public void Reset_ThenNextGameEnds_RecordsNextResultToo()
    {
        var session = NewTwoPlayerSession();
        TestGames.Play(session, TestGames.XWinsOnTopRow);

        session.Reset();
        TestGames.Play(session, TestGames.FullBoardDraw);

        Assert.Equal(new ScoreSnapshot(XWins: 1, OWins: 0, Draws: 1), _scoreboard.GetScores());
    }

    private GameSession NewTwoPlayerSession() => new(Guid.NewGuid(), GameMode.TwoPlayer, _scoreboard);
}
