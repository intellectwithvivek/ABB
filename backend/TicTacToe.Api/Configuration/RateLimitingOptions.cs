using System.ComponentModel.DataAnnotations;

namespace TicTacToe.Api.Configuration;

/// <summary>
/// The per-client request limits (section "RateLimiting" of appsettings.json): in every window of
/// <see cref="WindowSeconds"/> seconds, each client IP address may send at most <see cref="PermitLimit"/> requests,
/// of which at most <see cref="CreateGamePermitLimit"/> may create a game.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>The name of the stricter limit applied to <c>POST /api/games</c>.</summary>
    public const string CreateGamePolicy = "create-game";

    [Range(1, int.MaxValue)]
    public int PermitLimit { get; set; }

    /// <summary>
    /// Every game stays in memory until it has been idle for <see cref="GameSessionOptions.IdleTimeout"/>, so creating
    /// games has its own, lower limit: one client cannot fill the server's memory with games nobody plays.
    /// </summary>
    [Range(1, int.MaxValue)]
    public int CreateGamePermitLimit { get; set; }

    [Range(1, 3600)]
    public int WindowSeconds { get; set; }
}
