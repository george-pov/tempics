using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using TP.Application.Rendering;

namespace TP.AzureFunctions.Rendering;

public sealed class RenderSample(
    RenderSampleHandler handler,
    ILogger<RenderSample> logger)
{
    [Function("RenderSample")]
    public async Task<IActionResult> RunAsync(
        // BearerTokenMiddleware enforces Entra authentication instead of a Functions key.
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "renders/sample")]
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        var correlationId = request.HttpContext.TraceIdentifier;
        var started = Stopwatch.GetTimestamp();
        request.HttpContext.Response.Headers.CacheControl = "no-store";

        var result = await handler.HandleAsync(new RenderSampleQuery(), cancellationToken);
        logger.LogInformation(
            "RenderSampleSucceeded {CorrelationId} {ElapsedMs} {OutputBytes}",
            correlationId, Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            result.PngBytes.Length);

        return new FileContentResult(result.PngBytes, "image/png");
    }
}
