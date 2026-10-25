namespace TicTacToe.Core.Domain;

/// <summary>One entry of the move history. MoveNumber starts at 1.</summary>
public sealed record Move(int MoveNumber, Player Player, Position Position);
