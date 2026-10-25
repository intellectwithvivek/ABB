using TicTacToe.Core.Domain;

namespace TicTacToe.Core.Engine;

/// <summary>
/// The rules of Tic Tac Toe: validates and applies moves, detects wins and draws, and undoes moves.
/// It knows nothing about game modes, the computer opponent or the scoreboard;
/// that is <see cref="Sessions.GameSession"/>'s job.
/// </summary>
public sealed class GameEngine
{
    private readonly Board _board = new();
    private readonly List<Move> _moves = [];

    public GameEngine()
    {
        // A read-only wrapper (like Java's Collections.unmodifiableList): returning _moves itself would let a caller
        // cast it back to List<Move> and change the history behind the engine's back.
        Moves = _moves.AsReadOnly();
    }

    public Board Board => _board;

    public IReadOnlyList<Move> Moves { get; }

    /// <summary>
    /// X always starts and the turn passes after every valid move, so the move count alone decides whose turn it is.
    /// Deriving it (instead of storing it) means undo can never leave a stale turn behind.
    /// </summary>
    public Player CurrentPlayer => _moves.Count % 2 == 0 ? Player.X : Player.O;

    public GameStatus Status { get; private set; } = GameStatus.InProgress;

    public Player? Winner { get; private set; }

    /// <summary>The cells of the winning line; empty unless the game is won.</summary>
    public IReadOnlyList<Position> WinningCells { get; private set; } = [];

    public bool IsOver => Status != GameStatus.InProgress;

    /// <exception cref="GameRuleException">
    /// The game is over, the cell is off the board, it is not this player's turn, or the cell is taken.
    /// </exception>
    public Move ApplyMove(Player player, Position position)
    {
        if (IsOver)
        {
            throw new GameRuleException("The game is already over. Reset the game or start a new one.");
        }

        if (!Board.IsOnBoard(position))
        {
            throw new GameRuleException(
                $"Row and column must be between 0 and {Board.Size - 1} (got row {position.Row}, col {position.Col}).");
        }

        if (player != CurrentPlayer)
        {
            throw new GameRuleException($"It is {CurrentPlayer}'s turn, not {player}'s.");
        }

        if (_board[position] is Player occupant)
        {
            throw new GameRuleException(
                $"Cell (row {position.Row}, col {position.Col}) is already taken by {occupant}.");
        }

        _board.Place(position, player);
        var move = new Move(_moves.Count + 1, player, position);
        _moves.Add(move);
        EvaluateOutcome();
        return move;
    }

    /// <exception cref="GameRuleException">There are no moves to undo.</exception>
    public Move UndoLastMove()
    {
        if (_moves.Count == 0)
        {
            throw new GameRuleException("There are no moves to undo.");
        }

        var lastMove = _moves[_moves.Count - 1];
        _moves.RemoveAt(_moves.Count - 1);
        _board.Clear(lastMove.Position);
        EvaluateOutcome();
        return lastMove;
    }

    public void Reset()
    {
        _board.ClearAll();
        _moves.Clear();
        EvaluateOutcome();
    }

    // Recomputed from the board after every change (move, undo, reset), so the outcome can never be stale.
    // The win check comes first: a ninth move that completes a line is a win, not a draw.
    private void EvaluateOutcome()
    {
        var winningLine = Board.Lines.FirstOrDefault(IsCompletedLine);
        if (winningLine is not null)
        {
            Status = GameStatus.Won;
            Winner = _board[winningLine[0]];
            WinningCells = winningLine;
        }
        else
        {
            Status = _board.IsFull ? GameStatus.Draw : GameStatus.InProgress;
            Winner = null;
            WinningCells = [];
        }
    }

    private bool IsCompletedLine(IReadOnlyList<Position> line)
    {
        var firstMark = _board[line[0]];
        return firstMark is not null && line.All(position => _board[position] == firstMark);
    }
}
