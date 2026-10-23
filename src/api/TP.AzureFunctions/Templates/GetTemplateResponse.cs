using System.Text.Json.Serialization;

namespace TP.AzureFunctions.Templates;

public sealed record GetTemplateResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("template")] string Template);
