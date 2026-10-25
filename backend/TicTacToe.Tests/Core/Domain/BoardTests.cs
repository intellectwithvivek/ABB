using TicTacToe.Core.Domain;
using TicTacToe.Tests.TestSupport;

namespace TicTacToe.Tests.Core.Domain;

/// <summary>The 3x3 grid on its own: its boundaries, its invariant guard and the order of its cells.</summary>
public sealed class BoardTests
{
    [Theory]
    [InlineData(0, 0, true)]
    [InlineData(2, 2, true)]
    [InlineData(-1, 0, false)]
    [InlineData(0, -1, false)]
    [InlineData(3, 0, false)]
    [InlineData(0, 3, false)]
    public void IsOnBoard_Position_TrueOnlyForRowsAndColumnsZeroToTwo(int row, int col, bool expected)
    {
        Assert.Equal(expected, Board.IsOnBoard(new Position(row, col)));
    }

    [Fact]
    public void Place_OccupiedCell_ThrowsInvalidOperationException()
    {
        var board = TestBoards.Parse(
            "X..",
            "...",
            "...");

        // GameEngine rejects such a move first, so this guard only catches a bug: it is not a GameRuleException.
        Assert.Throws<InvalidOperationException>(() => board.Place(new Position(0, 0), Player.O));
        Assert.Equal(["X..", "...", "..."], TestBoards.Render(board));
    }

    [Fact]
    public void IsFull_EightMarksThenNine_TrueOnlyWhenEveryCellIsTaken()
    {
        var board = TestBoards.Parse(
            "XOX",
            "XOO",
            "OX.");
        Assert.False(board.IsFull);

        board.Place(new Position(2, 2), Player.X);

        Assert.True(board.IsFull);
        Assert.Empty(board.EmptyPositions);
    }

    [Fact]
    public void EmptyPositions_PartialBoard_ReturnsFreeCellsInRowMajorOrder()
    {
        var board = TestBoards.Parse(
            "X.O",
            ".X.",
            "O..");

        Assert.Equal(
            [new Position(0, 1), new Position(1, 0), new Position(1, 2), new Position(2, 1), new Position(2, 2)],
            board.EmptyPositions);
    }
}
