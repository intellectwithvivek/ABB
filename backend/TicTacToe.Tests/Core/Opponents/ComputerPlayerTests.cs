using TicTacToe.Core.Domain;
using TicTacToe.Core.Opponents;
using TicTacToe.Tests.TestSupport;

namespace TicTacToe.Tests.Core.Opponents;

/// <summary>
/// One test per rule of the computer's priority order. Each board is chosen so that the rule under test
/// gives a different cell than the rules after it would, so the test fails if the rule is skipped.
/// </summary>
public sealed class ComputerPlayerTests
{
    [Fact]
    public void ChooseMove_ComputerCanCompleteLine_PlaysWinningCell()
    {
        // O completes the main diagonal at (2,2); the corner rule alone would pick (2,0).
        var board = TestBoards.Parse(
            "OXX",
            "XO.",
            "...");

        Assert.Equal(new Position(2, 2), ComputerPlayer.ChooseMove(board, Player.O));
    }

    [Fact]
    public void ChooseMove_OpponentThreatensLine_BlocksThreat()
    {
        // X threatens column 0 at (1,0); the corner rule alone would pick (0,2).
        var board = TestBoards.Parse(
            "X..",
            ".O.",
            "X..");

        Assert.Equal(new Position(1, 0), ComputerPlayer.ChooseMove(board, Player.O));
    }

    [Fact]
    public void ChooseMove_CanWinAndMustBlock_PrefersWinning()
    {
        // O wins at (1,2); blocking X's top row would be (0,2).
        var board = TestBoards.Parse(
            "XX.",
            "OO.",
            "X..");

        Assert.Equal(new Position(1, 2), ComputerPlayer.ChooseMove(board, Player.O));
    }

    [Fact]
    public void ChooseMove_CenterFree_TakesCenter()
    {
        var board = TestBoards.Parse(
            "X..",
            "...",
            "...");

        Assert.Equal(new Position(1, 1), ComputerPlayer.ChooseMove(board, Player.O));
    }

    [Fact]
    public void ChooseMove_CenterTaken_TakesFirstFreeCorner()
    {
        // (0,0) is taken, so the next corner in order is (0,2); the any-cell rule alone would pick (0,1).
        var board = TestBoards.Parse(
            "O..",
            ".X.",
            "..X");

        Assert.Equal(new Position(0, 2), ComputerPlayer.ChooseMove(board, Player.O));
    }

    [Fact]
    public void ChooseMove_CenterAndCornersTaken_TakesFirstFreeCell()
    {
        // No line can be won or blocked, and the center and every corner are taken: (0,1) is the first free cell.
        var board = TestBoards.Parse(
            "X.O",
            "OXX",
            "X.O");

        Assert.Equal(new Position(0, 1), ComputerPlayer.ChooseMove(board, Player.O));
    }

    [Fact]
    public void ChooseMove_FullBoard_ThrowsInvalidOperationException()
    {
        // GameSession only asks while the game is in progress, so a full board here means a bug.
        var board = TestBoards.Parse(
            "XOX",
            "XOO",
            "OXX");

        Assert.Throws<InvalidOperationException>(() => ComputerPlayer.ChooseMove(board, Player.O));
    }
}
