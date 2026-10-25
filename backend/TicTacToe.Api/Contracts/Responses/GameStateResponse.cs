using TicTacToe.Core.Domain;

namespace TicTacToe.Api.Contracts.Responses;

/// <summary>
/// The full state of one game. Every game endpoint returns it, so the frontend only renders what the server decided.
/// The JSON properties appear in the order of the constructor parameters.
/// </summary>
/// <param name="Board">Rows of cells, read as <c>board[row][col]</c>; a cell is X, O or null when empty.</param>
/// <param name="WinningCells">The cells of the winning line; empty unless Status is Won.</param>
/// <param name="CanUndo">
/// Computed by the server (game in progress and at least one move) so the frontend never re-implements the rule.
/// </param>
public sealed record GameStateResponse(
    Guid GameId,
    GameMode Mode,
    IReadOnlyList<IReadOnlyList<Player?>> Board,
    Player CurrentPlayer,
    GameStatus Status,
    Player? Winner,
    IReadOnlyList<CellDto> WinningCells,
    IReadOnlyList<MoveDto> MoveHistory,
    bool CanUndo,
    ScoreboardDto Scoreboard);
