using System.ComponentModel.DataAnnotations;
using TicTacToe.Core.Domain;

namespace TicTacToe.Api.Contracts.Requests;

/// <summary>Body of <c>POST /api/games</c>.</summary>
public sealed record CreateGameRequest
{
    // `required` makes System.Text.Json reject a body without "mode" (400) instead of silently
    // defaulting to the enum's first value, TwoPlayer.
    // [EnumDataType]: on .NET 8 the enum converter also reads a numeric string such as "2" as an
    // undefined GameMode value; this check turns that into a 400 before the controller runs.
    [EnumDataType(typeof(GameMode), ErrorMessage = "mode must be \"TwoPlayer\" or \"VsComputer\".")]
    public required GameMode Mode { get; init; }
}
