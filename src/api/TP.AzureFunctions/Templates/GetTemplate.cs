using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Auth;
using TP.AzureFunctions.Errors;

namespace TP.AzureFunctions.Templates;

public sealed class GetTemplate(FindTemplateHandler handler)
{
    [Function("GetTemplate")]
    public async Task<IActionResult> RunAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "templates/{id}")]
        HttpRequest request,
        string id,
        CancellationToken cancellationToken)
    {
        request.HttpContext.Response.Headers.CacheControl = "no-store";

        var userId = TemplateCaller.GetUserId(request.HttpContext.User);
        if (!Guid.TryParse(id, out var templateId) || templateId == Guid.Empty)
        {
            return ApiErrorResults.BadRequest(request);
        }

        var template = await handler.HandleAsync(
            new FindTemplateQuery(userId, templateId), cancellationToken);
        return template is null
            ? ApiErrorResults.NotFound(request)
            : new OkObjectResult(new GetTemplateResponse(
                template.Id, template.Name, template.Template));
    }
}
