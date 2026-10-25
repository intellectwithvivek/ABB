using System.ComponentModel.DataAnnotations;
using TicTacToe.Core.Domain;

namespace TicTacToe.Api.Contracts.Requests;

/// <summary>Body of <c>POST /api/games/{id}/moves</c>. Row and Col are 0-based.</summary>
/// <remarks>
/// There is deliberately no [Range] on Row and Col: the board-range rule lives in TicTacToe.Core,
/// so there is one source of truth and one error message for it.
/// </remarks>
public sealed record SubmitMoveRequest
{
    // `required` makes System.Text.Json reject a body with a missing field (400) instead of
    // silently using the default value: a missing "col" would otherwise become column 0.
    // [EnumDataType]: on .NET 8 the enum converter also reads a numeric string such as "7" as an
    // undefined Player value; this check turns that into a 400 before the controller runs.
    [EnumDataType(typeof(Player), ErrorMessage = "player must be \"X\" or \"O\".")]
    public required Player Player { get; init; }

    public required int Row { get; init; }

    public required int Col { get; init; }
}
