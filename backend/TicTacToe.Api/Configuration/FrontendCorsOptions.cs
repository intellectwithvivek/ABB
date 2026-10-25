using System.ComponentModel.DataAnnotations;

namespace TicTacToe.Api.Configuration;

/// <summary>
/// The browser origins allowed to call the API (section "Cors" of appsettings.json). The frontend runs on a different
/// origin (the Angular dev server on http://localhost:4200, a static host when deployed), so the browser only lets it
/// call the API when the API allows that origin.
/// </summary>
/// <remarks>
/// A deployment sets its own origin with an environment variable, e.g.
/// <c>Cors__AllowedOrigins__0=https://example.github.io</c>: "__" stands for ":" in environment variable names,
/// and the index replaces that item of the list in appsettings.json.
/// </remarks>
public sealed class FrontendCorsOptions : IValidatableObject
{
    public const string SectionName = "Cors";

    // An empty list would make the browser block every call from the frontend; failing at startup is easier
    // to diagnose.
    [MinLength(1)]
    public string[] AllowedOrigins { get; set; } = [];

    // Called by ValidateDataAnnotations at startup, after the attribute checks. A browser sends its origin as
    // scheme + host (+ port) only, so an entry with a path or a trailing slash (e.g. https://example.github.io/ABB)
    // would never match and would silently block every call from that site.
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        AllowedOrigins
            .Where(origin => !IsOrigin(origin))
            .Select(origin => new ValidationResult(
                $"Cors:AllowedOrigins entry '{origin}' must be scheme://host[:port], "
                + "with no path and no trailing slash.",
                [nameof(AllowedOrigins)]));

    private static bool IsOrigin(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
        && uri.PathAndQuery == "/"
        && !value.EndsWith('/');
}
