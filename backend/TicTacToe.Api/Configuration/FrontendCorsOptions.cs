using System.ComponentModel.DataAnnotations;

namespace TicTacToe.Api.Configuration;

/// <summary>
/// The browser origins allowed to call the API cross-origin (section "Cors" of appsettings.json), e.g. the Angular
/// dev server on http://localhost:4200. A site that proxies /api to the API is same-origin and needs no entry.
/// </summary>
/// <remarks>
/// A deployment can set an origin with an environment variable, e.g.
/// <c>Cors__AllowedOrigins__0=https://app.example.com</c>: "__" stands for ":" in environment variable names,
/// and the index replaces that item of the list in appsettings.json.
/// </remarks>
public sealed class FrontendCorsOptions : IValidatableObject
{
    public const string SectionName = "Cors";

    // An empty list would make the browser block every cross-origin call; failing at startup is easier to diagnose.
    [MinLength(1)]
    public string[] AllowedOrigins { get; set; } = [];

    // Called by ValidateDataAnnotations at startup. A browser sends its origin as scheme + host (+ port) only, so an
    // entry with a path or a trailing slash (e.g. https://app.example.com/play) would never match.
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
