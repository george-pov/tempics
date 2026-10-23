using System.Text.Json.Serialization;

namespace TP.AzureFunctions.Templates;

public sealed record TemplateSummaryResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("name")] string Name);
