using TicTacToe.Core.Domain;

namespace TicTacToe.Tests.TestSupport;

/// <summary>
/// Converts between a <see cref="Board"/> and three strings, one per row, using 'X', 'O' and '.' for an empty cell,
/// e.g. <c>Parse("XO.", ".X.", "..O")</c>, so a test can set up or check a whole board at a glance.
/// </summary>
internal static class TestBoards
{
    public static Board Parse(params string[] rows)
    {
        if (rows.Length != Board.Size || rows.Any(row => row.Length != Board.Size))
        {
            throw new ArgumentException("A test board needs 3 rows of 3 characters.", nameof(rows));
        }

        var board = new Board();
        foreach (var position in Board.AllPositions)
        {
            if (ToMark(rows[position.Row][position.Col]) is Player mark)
            {
                // Board.Place is internal; InternalsVisibleTo in TicTacToe.Core.csproj lets the tests call it.
                board.Place(position, mark);
            }
        }

        return board;
    }

    // AllPositions is in row-major order, so every Board.Size consecutive cells form one row.
    public static string[] Render(Board board) =>
        Board.AllPositions
            .Select(position => board[position]?.ToString() ?? ".")
            .Chunk(Board.Size)
            .Select(row => string.Concat(row))
            .ToArray();

    private static Player? ToMark(char cell) => cell switch
    {
        'X' => Player.X,
        'O' => Player.O,
        '.' => null,
        _ => throw new ArgumentException($"Unexpected cell '{cell}'; use 'X', 'O' or '.'.", nameof(cell)),
    };
}
