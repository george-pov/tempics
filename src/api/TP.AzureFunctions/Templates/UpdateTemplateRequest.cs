using System.Text.Json.Serialization;

namespace TP.AzureFunctions.Templates;

public sealed record UpdateTemplateRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("template")] string? Template);
