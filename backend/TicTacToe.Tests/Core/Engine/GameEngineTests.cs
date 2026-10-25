using TicTacToe.Core.Domain;
using TicTacToe.Core.Engine;
using TicTacToe.Tests.TestSupport;

namespace TicTacToe.Tests.Core.Engine;

/// <summary>The rules of Tic Tac Toe: move validation, turns, win and draw detection.</summary>
public sealed class GameEngineTests
{
    private const string GameOverMessage = "The game is already over. Reset the game or start a new one.";

    [Fact]
    public void ApplyMove_ValidMove_PlacesMarkAndRecordsMove()
    {
        var engine = new GameEngine();

        var move = engine.ApplyMove(Player.X, new Position(1, 2));

        var expectedMove = new Move(1, Player.X, new Position(1, 2));
        Assert.Equal(expectedMove, move);
        Assert.Equal(expectedMove, Assert.Single(engine.Moves));
        Assert.Equal(["...", "..X", "..."], TestBoards.Render(engine.Board));
        Assert.Equal(GameStatus.InProgress, engine.Status);
    }

    [Fact]
    public void ApplyMove_ValidMove_PassesTurnToOtherPlayer()
    {
        var engine = new GameEngine();
        Assert.Equal(Player.X, engine.CurrentPlayer);

        engine.ApplyMove(Player.X, new Position(0, 0));
        Assert.Equal(Player.O, engine.CurrentPlayer);

        engine.ApplyMove(Player.O, new Position(1, 1));
        Assert.Equal(Player.X, engine.CurrentPlayer);
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(3, 0)]
    [InlineData(0, -1)]
    [InlineData(0, 3)]
    public void ApplyMove_OutsideBoard_ThrowsAndKeepsTurn(int row, int col)
    {
        var engine = EngineWithXInCenter();

        var exception = Assert.Throws<GameRuleException>(() => engine.ApplyMove(Player.O, new Position(row, col)));

        Assert.Equal($"Row and column must be between 0 and 2 (got row {row}, col {col}).", exception.Message);
        AssertStillOnlyXInCenter(engine);
    }

    [Fact]
    public void ApplyMove_OccupiedCell_ThrowsAndKeepsTurn()
    {
        var engine = EngineWithXInCenter();

        var exception = Assert.Throws<GameRuleException>(() => engine.ApplyMove(Player.O, new Position(1, 1)));

        Assert.Equal("Cell (row 1, col 1) is already taken by X.", exception.Message);
        AssertStillOnlyXInCenter(engine);
    }

    [Fact]
    public void ApplyMove_WrongPlayer_ThrowsAndKeepsTurn()
    {
        var engine = EngineWithXInCenter();

        var exception = Assert.Throws<GameRuleException>(() => engine.ApplyMove(Player.X, new Position(0, 0)));

        Assert.Equal("It is O's turn, not X's.", exception.Message);
        AssertStillOnlyXInCenter(engine);
    }

    [Fact]
    public void ApplyMove_AfterGameWon_ThrowsGameOver()
    {
        var engine = new GameEngine();
        TestGames.Play(engine, TestGames.XWinsOnTopRow);

        // O is the right player and (2,2) is free, so the only rule broken is that the game is over.
        var exception = Assert.Throws<GameRuleException>(() => engine.ApplyMove(Player.O, new Position(2, 2)));

        Assert.Equal(GameOverMessage, exception.Message);
        Assert.Equal(GameStatus.Won, engine.Status);
        Assert.Equal(5, engine.Moves.Count);
    }

    [Fact]
    public void ApplyMove_AfterDraw_ThrowsGameOver()
    {
        var engine = new GameEngine();
        TestGames.Play(engine, TestGames.FullBoardDraw);

        // Every cell is taken too, but "game over" is checked first, so that is the message the player sees.
        var exception = Assert.Throws<GameRuleException>(() => engine.ApplyMove(Player.O, new Position(0, 0)));

        Assert.Equal(GameOverMessage, exception.Message);
        Assert.Equal(GameStatus.Draw, engine.Status);
        Assert.Equal(9, engine.Moves.Count);
    }

    [Fact]
    public void ApplyMove_SeveralRulesBroken_ReportsFirstRuleInValidationOrder()
    {
        // Game over is checked before the board range: (9,9) is off the board, but the player hears the game is over.
        var finished = new GameEngine();
        TestGames.Play(finished, TestGames.XWinsOnTopRow);
        var gameOver = Assert.Throws<GameRuleException>(() => finished.ApplyMove(Player.X, new Position(9, 9)));
        Assert.Equal(GameOverMessage, gameOver.Message);

        // The board range is checked before the turn: it is O's turn, and X sends an off-board cell.
        var engine = EngineWithXInCenter();
        var offBoard = Assert.Throws<GameRuleException>(() => engine.ApplyMove(Player.X, new Position(3, 3)));
        Assert.Equal("Row and column must be between 0 and 2 (got row 3, col 3).", offBoard.Message);

        // The turn is checked before the cell: X sends the taken center on O's turn.
        var wrongPlayer = Assert.Throws<GameRuleException>(() => engine.ApplyMove(Player.X, new Position(1, 1)));
        Assert.Equal("It is O's turn, not X's.", wrongPlayer.Message);
        AssertStillOnlyXInCenter(engine);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void ApplyMove_CompletesRow_WinsWithRowCells(int row)
    {
        var engine = new GameEngine();
        var otherRow = (row + 1) % Board.Size;

        TestGames.Play(engine, new(row, 0), new(otherRow, 0), new(row, 1), new(otherRow, 1), new(row, 2));

        AssertWonBy(engine, Player.X, [new(row, 0), new(row, 1), new(row, 2)]);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void ApplyMove_CompletesColumn_WinsWithColumnCells(int col)
    {
        var engine = new GameEngine();
        var otherCol = (col + 1) % Board.Size;

        TestGames.Play(engine, new(0, col), new(0, otherCol), new(1, col), new(1, otherCol), new(2, col));

        AssertWonBy(engine, Player.X, [new(0, col), new(1, col), new(2, col)]);
    }

    [Fact]
    public void ApplyMove_CompletesMainDiagonal_WinsWithDiagonalCells()
    {
        var engine = new GameEngine();

        TestGames.Play(engine, new(0, 0), new(0, 1), new(1, 1), new(0, 2), new(2, 2));

        AssertWonBy(engine, Player.X, [new(0, 0), new(1, 1), new(2, 2)]);
    }

    [Fact]
    public void ApplyMove_CompletesAntiDiagonal_WinsWithDiagonalCells()
    {
        var engine = new GameEngine();

        // This time O completes the line, on the sixth move.
        TestGames.Play(engine, new(0, 0), new(0, 2), new(0, 1), new(1, 1), new(2, 2), new(2, 0));

        AssertWonBy(engine, Player.O, [new(0, 2), new(1, 1), new(2, 0)]);
    }

    [Fact]
    public void ApplyMove_FillsBoardWithoutLine_EndsInDraw()
    {
        var engine = new GameEngine();

        TestGames.Play(engine, TestGames.FullBoardDraw);

        Assert.Equal(GameStatus.Draw, engine.Status);
        Assert.Null(engine.Winner);
        Assert.Empty(engine.WinningCells);
        Assert.True(engine.IsOver);
    }

    [Fact]
    public void ApplyMove_NinthMoveCompletesLine_WinsInsteadOfDraw()
    {
        var engine = new GameEngine();

        // Final board: XOX / OXO / OXX. The ninth move (2,2) fills the board and completes the main diagonal.
        TestGames.Play(engine,
            new(0, 0), new(0, 1), new(0, 2), new(1, 0), new(1, 1),
            new(2, 0), new(2, 1), new(1, 2), new(2, 2));

        Assert.True(engine.Board.IsFull);
        AssertWonBy(engine, Player.X, [new(0, 0), new(1, 1), new(2, 2)]);
    }

    [Fact]
    public void ApplyMove_NinthMoveCompletesTwoLines_ReportsFirstLineInBoardOrder()
    {
        // Final board: XXX / OOX / OOX. The ninth move (0,2) completes both the top row and the right column.
        // This can only happen on X's ninth move; the documented choice is the first line in Board.Lines order.
        var engine = new GameEngine();

        TestGames.Play(engine,
            new(0, 0), new(1, 0), new(0, 1), new(1, 1), new(1, 2),
            new(2, 0), new(2, 2), new(2, 1), new(0, 2));

        Assert.Equal(["XXX", "OOX", "OOX"], TestBoards.Render(engine.Board));
        AssertWonBy(engine, Player.X, [new(0, 0), new(0, 1), new(0, 2)]);
    }

    [Fact]
    public void UndoLastMove_AfterWinningMove_RecalculatesStatusToInProgress()
    {
        var engine = new GameEngine();
        TestGames.Play(engine, TestGames.XWinsOnTopRow);

        // GameSession forbids this (Option A); the engine allows it, which shows the status is recalculated
        // from the board.
        var undoneMove = engine.UndoLastMove();

        Assert.Equal(new Move(5, Player.X, new Position(0, 2)), undoneMove);
        Assert.Equal(["XX.", "OO.", "..."], TestBoards.Render(engine.Board));
        Assert.Equal(GameStatus.InProgress, engine.Status);
        Assert.Null(engine.Winner);
        Assert.Empty(engine.WinningCells);
        Assert.Equal(Player.X, engine.CurrentPlayer);
    }

    // Starting point for the rejection tests: X has taken the center, so it is O's turn.
    private static GameEngine EngineWithXInCenter()
    {
        var engine = new GameEngine();
        engine.ApplyMove(Player.X, new Position(1, 1));
        return engine;
    }

    // A rejected move must leave everything as it was: same turn, same board, same history.
    private static void AssertStillOnlyXInCenter(GameEngine engine)
    {
        Assert.Equal(Player.O, engine.CurrentPlayer);
        Assert.Equal(["...", ".X.", "..."], TestBoards.Render(engine.Board));
        Assert.Equal(new Move(1, Player.X, new Position(1, 1)), Assert.Single(engine.Moves));
        Assert.Equal(GameStatus.InProgress, engine.Status);
    }

    private static void AssertWonBy(GameEngine engine, Player winner, Position[] winningCells)
    {
        Assert.Equal(GameStatus.Won, engine.Status);
        Assert.Equal(winner, engine.Winner);
        Assert.Equal(winningCells, engine.WinningCells);
        Assert.True(engine.IsOver);
    }
}
