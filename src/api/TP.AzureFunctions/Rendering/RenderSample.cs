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
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "renders/sample")]
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        var correlationId = request.HttpContext.TraceIdentifier;
        var started = Stopwatch.GetTimestamp();

        try
        {
            var result = await handler.HandleAsync(new RenderSampleQuery(), cancellationToken);
            request.HttpContext.Response.Headers.CacheControl = "no-store";

            logger.LogInformation(
                "RenderSampleSucceeded {CorrelationId} {ElapsedMs} {OutputBytes}",
                correlationId, Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                result.PngBytes.Length);

            return new FileContentResult(result.PngBytes, "image/png");
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(
                "RenderSampleFailed {CorrelationId} {ElapsedMs} {Outcome} {ExceptionType}",
                correlationId, Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                "failed", exception.GetType().Name);

            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Image rendering failed"
            };
            problem.Extensions["code"] = "render_failed";
            problem.Extensions["correlationId"] = correlationId;

            return new ObjectResult(problem)
            {
                StatusCode = StatusCodes.Status500InternalServerError,
                ContentTypes = { "application/problem+json" }
            };
        }
    }
}
