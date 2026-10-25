using TicTacToe.Core.Domain;

namespace TicTacToe.Core.Opponents;

/// <summary>
/// The rule-based computer opponent. It plays the first rule that applies, in the order given by the brief.
/// It is deterministic (no randomness), so every choice can be predicted and tested.
/// </summary>
public static class ComputerPlayer
{
    private static readonly Position Center = new(1, 1);

    private static readonly IReadOnlyList<Position> Corners = [new(0, 0), new(0, 2), new(2, 0), new(2, 2)];

    /// <exception cref="InvalidOperationException">
    /// The board is full (callers only ask while the game is in progress).
    /// </exception>
    public static Position ChooseMove(Board board, Player computer)
    {
        return FindLineCompletingMove(board, computer)              // 1. win
            ?? FindLineCompletingMove(board, computer.Opponent())   // 2. block the opponent's win
            ?? FindFirstEmpty(board, [Center])                      // 3. center
            ?? FindFirstEmpty(board, Corners)                       // 4. corner
            ?? FindFirstEmpty(board, Board.AllPositions)            // 5. any free cell
            ?? throw new InvalidOperationException("The computer cannot move on a full board.");
    }

    /// <summary>
    /// The empty cell of the first line holding two of <paramref name="player"/>'s marks and one empty cell,
    /// i.e. the cell where that player would complete three in a row.
    /// </summary>
    private static Position? FindLineCompletingMove(Board board, Player player)
    {
        foreach (var line in Board.Lines)
        {
            var marksOfPlayer = line.Count(position => board[position] == player);
            var emptyCells = line.Where(board.IsEmpty).ToList();
            if (marksOfPlayer == 2 && emptyCells.Count == 1)
            {
                return emptyCells[0];
            }
        }

        return null;
    }

    // Returns Position? rather than using FirstOrDefault: Position is a struct, so FirstOrDefault
    // would return default(Position) = (0,0), a real cell, when no candidate is free.
    private static Position? FindFirstEmpty(Board board, IEnumerable<Position> candidates)
    {
        foreach (var position in candidates)
        {
            if (board.IsEmpty(position))
            {
                return position;
            }
        }

        return null;
    }
}
