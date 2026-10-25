using System.ComponentModel.DataAnnotations;

namespace TicTacToe.Api.Configuration;

/// <summary>When idle games are removed from memory (section "Sessions" of appsettings.json).</summary>
/// <remarks>Not named SessionOptions: ASP.NET Core already has a Microsoft.AspNetCore.Builder.SessionOptions.</remarks>
public sealed class GameSessionOptions
{
    public const string SectionName = "Sessions";

    /// <summary>A game that no request has used for longer than this is removed.</summary>
    // At least a minute, so a game cannot disappear while someone is thinking about their next move.
    [Range(typeof(TimeSpan), "00:01:00", "1.00:00:00")]
    public TimeSpan IdleTimeout { get; set; }

    /// <summary>How often the cleanup looks for idle games.</summary>
    // PeriodicTimer rejects a zero period, so a missing or zero value must stop the app at startup instead.
    [Range(typeof(TimeSpan), "00:00:01", "1.00:00:00")]
    public TimeSpan CleanupInterval { get; set; }
}
