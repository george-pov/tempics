using System.Text.Json.Serialization;

namespace TP.AzureFunctions.Templates;

public sealed record ListTemplatesResponse(
    [property: JsonPropertyName("items")] IReadOnlyList<TemplateSummaryResponse> Items);
