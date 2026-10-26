using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Rendering;
using TP.AzureFunctions.Errors;

namespace TP.AzureFunctions.Rendering;

public sealed class RenderPreview(RenderPreviewHandler handler)
{
    private const int MaxBodyBytes = 2_048;

    [Function("RenderPreview")]
    public async Task<IActionResult> RunAsync(
        // BearerTokenMiddleware enforces Entra authentication instead of a Functions key.
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "renders/preview")]
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        request.HttpContext.Response.Headers.CacheControl = "no-store";
        if (request.ContentLength > MaxBodyBytes)
        {
            return ApiErrorResults.PreviewTooLarge(request);
        }

        using var body = new MemoryStream();
        var buffer = new byte[8192];
        while (true)
        {
            var count = await request.Body.ReadAsync(buffer, cancellationToken);
            if (count == 0)
            {
                break;
            }

            if (body.Length + count > MaxBodyBytes)
            {
                return ApiErrorResults.PreviewTooLarge(request);
            }

            body.Write(buffer, 0, count);
        }

        body.Position = 0;
        var payload = await ReadRequestAsync(body, cancellationToken);
        if (payload is null)
        {
            return ApiErrorResults.PreviewInvalid(request);
        }

        var result = await handler.HandleAsync(
            new RenderPreviewQuery(payload.Template), cancellationToken);
        return new FileContentResult(result.PngBytes, "image/png");
    }

    private static async Task<RenderPreviewRequest?> ReadRequestAsync(
        Stream body, CancellationToken cancellationToken)
    {
        using var json = await JsonDocument.ParseAsync(body,
            new JsonDocumentOptions { MaxDepth = 4 }, cancellationToken);
        if (json.RootElement.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (json.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new JsonException();
        }

        var fields = json.RootElement.EnumerateObject();
        if (!fields.MoveNext())
        {
            throw new JsonException();
        }

        var field = fields.Current;
        if (!string.Equals(field.Name, "template", StringComparison.Ordinal) || fields.MoveNext() ||
            field.Value.ValueKind is not (JsonValueKind.String or JsonValueKind.Null))
        {
            throw new JsonException();
        }

        return new RenderPreviewRequest(field.Value.GetString());
    }
}
