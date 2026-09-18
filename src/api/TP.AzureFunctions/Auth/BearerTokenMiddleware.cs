using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace TP.AzureFunctions.Auth;

public sealed class BearerTokenMiddleware : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var http = context.GetHttpContext();
        if (http is null)
        {
            // A missing HTTP context must never bypass authentication for an HTTP trigger.
            if (context.FunctionDefinition.InputBindings.Values.Any(binding => binding.Type == "httpTrigger"))
            {
                throw new InvalidOperationException("HTTP context is unavailable.");
            }

            await next(context);
            return;
        }

        var result = await http.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
        if (!result.Succeeded || result.Principal is null)
        {
            http.Response.StatusCode = StatusCodes.Status401Unauthorized;
            http.Response.Headers.WWWAuthenticate = "Bearer";
            return;
        }

        http.User = result.Principal;
        if (!http.User.FindAll("scp").Any(claim =>
                claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Contains(AuthOptions.RenderScope, StringComparer.Ordinal)))
        {
            http.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        await next(context);
    }
}
