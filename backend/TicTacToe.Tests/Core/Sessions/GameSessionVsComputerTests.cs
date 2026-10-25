using TicTacToe.Core.Domain;
using TicTacToe.Core.Engine;
using TicTacToe.Core.Scoring;
using TicTacToe.Core.Sessions;
using TicTacToe.Tests.TestSupport;

namespace TicTacToe.Tests.Core.Sessions;

/// <summary>
/// VsComputer mode: the human is X and the computer (O) replies inside the same PlayMove call.
/// The comments list the computer's replies, which follow from the priority rules in ComputerPlayer.
/// </summary>
public sealed class GameSessionVsComputerTests
{
    // xUnit creates a new instance of the test class for every test (like JUnit), so each test gets
    // a fresh scoreboard.
    private readonly Scoreboard _scoreboard = new();

    [Fact]
    public void PlayMove_HumanMoves_ComputerRepliesInSameCall()
    {
        var session = NewVsComputerSession();

        session.PlayMove(Player.X, new Position(0, 0));

        Assert.Equal(["X..", ".O.", "..."], TestBoards.Render(session.Board));
        Assert.Equal(new Move(2, Player.O, new Position(1, 1)), session.Moves[1]);
        Assert.Equal(Player.X, session.CurrentPlayer);
    }

    [Fact]
    public void PlayMove_SubmittedAsO_ThrowsAndChangesNothing()
    {
        var session = NewVsComputerSession();
        session.PlayMove(Player.X, new Position(0, 0)); // the computer takes the center

        // Between requests it is always the human's turn, so a move sent as the computer's player
        // is a wrong-player move.
        var exception = Assert.Throws<GameRuleException>(() => session.PlayMove(Player.O, new Position(2, 2)));

        Assert.Equal("It is X's turn, not O's.", exception.Message);
        Assert.Equal(["X..", ".O.", "..."], TestBoards.Render(session.Board));
        Assert.Equal(2, session.Moves.Count);
        Assert.Equal(Player.X, session.CurrentPlayer);
    }

    [Fact]
    public void PlayMove_RejectedHumanMove_ComputerDoesNotReply()
    {
        var session = NewVsComputerSession();
        session.PlayMove(Player.X, new Position(0, 0)); // the computer takes the center

        Assert.Throws<GameRuleException>(() => session.PlayMove(Player.X, new Position(1, 1)));

        Assert.Equal(["X..", ".O.", "..."], TestBoards.Render(session.Board));
        Assert.Equal(2, session.Moves.Count);
    }

    [Fact]
    public void PlayMove_HumanCompletesLine_ComputerDoesNotMove()
    {
        var session = NewVsComputerSession();

        // The computer takes the center, then corner (0,2), then blocks row 2 at (2,1),
        // which leaves column 0 open for the human's winning move (1,0).
        TestGames.Play(session, new(0, 0), new(2, 2), new(2, 0), new(1, 0));

        Assert.Equal(GameStatus.Won, session.Status);
        Assert.Equal(Player.X, session.Winner);
        Assert.Equal(7, session.Moves.Count);
        Assert.Equal(new Move(7, Player.X, new Position(1, 0)), session.Moves.Last());
        Assert.Equal(["X.O", "XO.", "XOX"], TestBoards.Render(session.Board));
        Assert.Equal(new ScoreSnapshot(XWins: 1, OWins: 0, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void PlayMove_HumanFillsLastCell_ComputerDoesNotMove()
    {
        var session = NewVsComputerSession();

        // The computer takes corner (0,0), then blocks at (2,0), (1,2) and (0,1);
        // the human's fifth move fills the board.
        TestGames.Play(session, new(1, 1), new(0, 2), new(1, 0), new(2, 1), new(2, 2));

        Assert.Equal(GameStatus.Draw, session.Status);
        Assert.Equal(9, session.Moves.Count);
        Assert.Equal(new Move(9, Player.X, new Position(2, 2)), session.Moves.Last());
        Assert.Equal(["OOX", "XXO", "OXX"], TestBoards.Render(session.Board));
        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 0, Draws: 1), _scoreboard.GetScores());
    }

    [Fact]
    public void PlayMove_ComputerCompletesLine_RecordsComputerWin()
    {
        var session = NewVsComputerSession();

        // The computer takes the center, blocks the top row at (0,2), then completes the anti-diagonal at (2,0).
        TestGames.Play(session, new(0, 0), new(0, 1), new(2, 2));

        Assert.Equal(GameStatus.Won, session.Status);
        Assert.Equal(Player.O, session.Winner);
        Assert.Equal([new Position(0, 2), new Position(1, 1), new Position(2, 0)], session.WinningCells);
        Assert.Equal(6, session.Moves.Count);
        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 1, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void PlayMove_EveryPossibleGame_ComputerRepliesOnlyWhileInProgressAndResultIsRecordedOnce()
    {
        // The computer is deterministic, so trying every free cell for every human move plays every game
        // that can happen in this mode. The rules are checked after each human move.
        var finishedGames = 0;
        PlayEveryContinuation([]);
        Assert.Equal(489, finishedGames);

        void PlayEveryContinuation(Position[] humanMoves)
        {
            var scoreboard = new Scoreboard();
            var session = new GameSession(Guid.NewGuid(), GameMode.VsComputer, scoreboard);
            TestGames.Play(session, humanMoves);

            if (session.Status == GameStatus.InProgress)
            {
                // The computer has replied to every human move, and nothing is recorded yet.
                Assert.Equal(humanMoves.Length * 2, session.Moves.Count);
                Assert.Equal(new ScoreSnapshot(0, 0, 0), scoreboard.GetScores());
                foreach (var cell in session.Board.EmptyPositions)
                {
                    PlayEveryContinuation([.. humanMoves, cell]);
                }

                return;
            }

            finishedGames++;

            // The computer never moves after the game has ended: the last move is the winner's (X's on a draw).
            Assert.Equal(session.Winner ?? Player.X, session.Moves[^1].Player);
            var expectedScores = session.Winner switch
            {
                Player.X => new ScoreSnapshot(XWins: 1, OWins: 0, Draws: 0),
                Player.O => new ScoreSnapshot(XWins: 0, OWins: 1, Draws: 0),
                _ => new ScoreSnapshot(XWins: 0, OWins: 0, Draws: 1),
            };
            Assert.Equal(expectedScores, scoreboard.GetScores());

            // Option A: the finished game rejects undo, so its result can never be counted again.
            Assert.Throws<GameRuleException>(() => session.Undo());
            Assert.Equal(expectedScores, scoreboard.GetScores());
        }
    }

    [Fact]
    public void Undo_ComputerWon_ThrowsAndKeepsResult()
    {
        var session = NewVsComputerSession();
        TestGames.Play(session, new(0, 0), new(0, 1), new(2, 2)); // the computer completes the anti-diagonal

        var exception = Assert.Throws<GameRuleException>(() => session.Undo());

        Assert.Equal(
            "Undo is not available after the game has ended. Reset the game to play again.", exception.Message);
        Assert.Equal(6, session.Moves.Count);
        Assert.Equal(new ScoreSnapshot(XWins: 0, OWins: 1, Draws: 0), _scoreboard.GetScores());
    }

    [Fact]
    public void Undo_RepeatedUntilEmpty_RemovesOnePairEachTimeThenThrows()
    {
        var session = NewVsComputerSession();

        // The computer takes the center, then corner (0,2), then blocks row 2 at (2,1).
        TestGames.Play(session, new(0, 0), new(2, 2), new(2, 0));

        foreach (var movesLeft in new[] { 4, 2, 0 })
        {
            session.Undo();
            Assert.Equal(movesLeft, session.Moves.Count);
            Assert.Equal(Player.X, session.CurrentPlayer);
        }

        var exception = Assert.Throws<GameRuleException>(() => session.Undo());
        Assert.Equal("There are no moves to undo.", exception.Message);
    }

    [Fact]
    public void Undo_AfterHumanAndComputerMoved_RemovesBothAndRestoresXTurn()
    {
        var session = NewVsComputerSession();
        session.PlayMove(Player.X, new Position(0, 0)); // the computer takes the center

        session.Undo();

        Assert.Equal(["...", "...", "..."], TestBoards.Render(session.Board));
        Assert.Empty(session.Moves);
        Assert.Equal(Player.X, session.CurrentPlayer);
        Assert.False(session.CanUndo);
    }

    [Fact]
    public void Undo_AfterTwoRounds_RemovesOnlyLastPair()
    {
        var session = NewVsComputerSession();
        TestGames.Play(session, new(0, 0), new(2, 2)); // the computer takes the center, then corner (0,2)

        session.Undo();

        Assert.Equal(["X..", ".O.", "..."], TestBoards.Render(session.Board));
        Assert.Equal(2, session.Moves.Count);
        Assert.Equal(Player.X, session.CurrentPlayer);
    }

    private GameSession NewVsComputerSession() => new(Guid.NewGuid(), GameMode.VsComputer, _scoreboard);
}
