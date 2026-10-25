using TicTacToe.Api.Contracts.Responses;
using TicTacToe.Core.Domain;
using TicTacToe.Core.Scoring;
using TicTacToe.Core.Sessions;

namespace TicTacToe.Api.Mapping;

/// <summary>
/// Maps TicTacToe.Core types to response DTOs, so the JSON contract stays stable
/// even if the Core types change shape.
/// </summary>
public static class ResponseMapper
{
    public static GameStateResponse ToGameState(GameSession session, ScoreSnapshot scores) => new(
        GameId: session.Id,
        Mode: session.Mode,
        Board: ToRows(session.Board),
        CurrentPlayer: session.CurrentPlayer,
        Status: session.Status,
        Winner: session.Winner,
        WinningCells: session.WinningCells.Select(ToCell).ToList(),
        MoveHistory: session.Moves.Select(ToMove).ToList(),
        CanUndo: session.CanUndo,
        Scoreboard: ToScoreboard(scores));

    public static ScoreboardDto ToScoreboard(ScoreSnapshot scores) =>
        new(scores.XWins, scores.OWins, scores.Draws);

    private static IReadOnlyList<IReadOnlyList<Player?>> ToRows(Board board) =>
        Enumerable.Range(0, Board.Size)
            .Select(row => Enumerable.Range(0, Board.Size)
                .Select(col => board[new Position(row, col)])
                .ToList())
            .ToList();

    private static CellDto ToCell(Position position) => new(position.Row, position.Col);

    private static MoveDto ToMove(Move move) =>
        new(move.MoveNumber, move.Player, move.Position.Row, move.Position.Col);
}
