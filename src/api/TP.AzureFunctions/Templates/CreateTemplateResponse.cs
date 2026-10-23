using System.Text.Json.Serialization;

namespace TP.AzureFunctions.Templates;

public sealed record CreateTemplateResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("name")] string Name);
