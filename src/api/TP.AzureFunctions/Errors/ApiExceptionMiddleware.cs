using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Logging;

namespace TP.AzureFunctions.Errors;

public sealed class ApiExceptionMiddleware(ILogger<ApiExceptionMiddleware> logger)
    : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var http = context.GetHttpContext();
        if (http is null)
        {
            await next(context);
            return;
        }

        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            if (http.Response.HasStarted)
            {
                throw;
            }

            var functionName = context.FunctionDefinition.Name;
            var result = ApiErrorResults.FromException(http.Request, exception, functionName);
            http.Response.Headers.CacheControl = "no-store";

            if (result.StatusCode >= StatusCodes.Status500InternalServerError)
            {
                logger.LogError(
                    "ApiInvocationFailed {FunctionName} {CorrelationId} {ElapsedMs} {ExceptionType}",
                    functionName, http.TraceIdentifier,
                    Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                    exception.GetType().Name);
            }
            else
            {
                logger.LogWarning(
                    "ApiInvocationRejected {FunctionName} {CorrelationId} {ElapsedMs} {ExceptionType}",
                    functionName, http.TraceIdentifier,
                    Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                    exception.GetType().Name);
            }

            context.GetInvocationResult().Value = result;
        }
    }
}
