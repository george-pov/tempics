using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Auth;

namespace TP.AzureFunctions.Templates;

public sealed class ListTemplates(ListTemplatesHandler handler)
{
    [Function("ListTemplates")]
    public async Task<IActionResult> RunAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "templates")]
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        request.HttpContext.Response.Headers.CacheControl = "no-store";

        var userId = TemplateCaller.GetUserId(request.HttpContext.User);
        var result = await handler.HandleAsync(
            new ListTemplatesQuery(userId),
            cancellationToken);
        return new OkObjectResult(new ListTemplatesResponse(
            result.Items.Select(item => new TemplateSummaryResponse(item.Id, item.Name)).ToArray()));
    }
}
