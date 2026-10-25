namespace TicTacToe.Core.Domain;

/// <summary>A cell on the board. Row and Col are 0-based, matching the API.</summary>
/// <remarks>
/// A readonly record struct is a small immutable value type with value equality,
/// so new Position(1, 1) == new Position(1, 1).
/// </remarks>
public readonly record struct Position(int Row, int Col);
