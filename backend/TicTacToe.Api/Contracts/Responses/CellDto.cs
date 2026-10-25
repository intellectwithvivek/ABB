namespace TicTacToe.Api.Contracts.Responses;

/// <summary>A board cell in a response, e.g. one of the winning cells. 0-based.</summary>
public sealed record CellDto(int Row, int Col);
