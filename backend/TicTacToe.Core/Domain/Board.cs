namespace TicTacToe.Core.Domain;

/// <summary>
/// The 3x3 grid. Anyone can read it, but only code in TicTacToe.Core can change it,
/// so the board can never get out of sync with the move history kept by <see cref="Engine.GameEngine"/>.
/// </summary>
public sealed class Board
{
    public const int Size = 3;

    /// <summary>Every cell in row-major order (left to right, top to bottom).</summary>
    public static IReadOnlyList<Position> AllPositions { get; } =
    [
        new(0, 0), new(0, 1), new(0, 2),
        new(1, 0), new(1, 1), new(1, 2),
        new(2, 0), new(2, 1), new(2, 2),
    ];

    /// <summary>Every line that wins the game: the 3 rows, the 3 columns, then the 2 diagonals.</summary>
    public static IReadOnlyList<IReadOnlyList<Position>> Lines { get; } =
    [
        [new(0, 0), new(0, 1), new(0, 2)],
        [new(1, 0), new(1, 1), new(1, 2)],
        [new(2, 0), new(2, 1), new(2, 2)],
        [new(0, 0), new(1, 0), new(2, 0)],
        [new(0, 1), new(1, 1), new(2, 1)],
        [new(0, 2), new(1, 2), new(2, 2)],
        [new(0, 0), new(1, 1), new(2, 2)],
        [new(0, 2), new(1, 1), new(2, 0)],
    ];

    // null means the cell is empty.
    private readonly Player?[,] _cells = new Player?[Size, Size];

    public static bool IsOnBoard(Position position) =>
        position.Row is >= 0 and < Size && position.Col is >= 0 and < Size;

    /// <summary>The mark in a cell, or null when the cell is empty.</summary>
    public Player? this[Position position] => _cells[position.Row, position.Col];

    public bool IsEmpty(Position position) => this[position] is null;

    public bool IsFull => !EmptyPositions.Any();

    public IEnumerable<Position> EmptyPositions => AllPositions.Where(IsEmpty);

    // The mutators are internal (visible to this assembly and, via InternalsVisibleTo, the tests):
    // the API project can read a board but cannot change it behind the engine's back.
    internal void Place(Position position, Player player)
    {
        if (!IsEmpty(position))
        {
            // GameEngine validates every move first, so reaching this line means a bug, not a bad request.
            throw new InvalidOperationException(
                $"Cell (row {position.Row}, col {position.Col}) is already occupied.");
        }

        _cells[position.Row, position.Col] = player;
    }

    internal void Clear(Position position) => _cells[position.Row, position.Col] = null;

    internal void ClearAll() => Array.Clear(_cells);
}
