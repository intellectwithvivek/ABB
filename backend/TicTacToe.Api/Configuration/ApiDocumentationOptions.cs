namespace TicTacToe.Api.Configuration;

/// <summary>
/// Whether Swagger UI (<c>/swagger</c>) and the OpenAPI document (<c>/swagger/v1/swagger.json</c>) are served
/// (section "Swagger" of appsettings.json).
/// </summary>
/// <remarks>
/// On in every environment by default, so the deployed API documents itself; <c>Swagger__Enabled=false</c> turns it
/// off. Not named SwaggerOptions, which Swashbuckle already uses.
/// </remarks>
public sealed class ApiDocumentationOptions
{
    public const string SectionName = "Swagger";

    public bool Enabled { get; set; }
}
