using TicTacToe.Core.Domain;

namespace TicTacToe.Api.Contracts.Responses;

/// <summary>One row of the move history. MoveNumber starts at 1; Row and Col are 0-based.</summary>
public sealed record MoveDto(int MoveNumber, Player Player, int Row, int Col);
