using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Auth;
using TP.AzureFunctions.Errors;

namespace TP.AzureFunctions.Templates;

public sealed class DeleteTemplate(DeleteTemplateHandler handler)
{
    [Function("DeleteTemplate")]
    public async Task<IActionResult> RunAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "templates/{id}")]
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

        if (request.ContentLength > 0 ||
            request.ContentLength is null &&
            await request.Body.ReadAsync(new byte[1], cancellationToken) != 0)
        {
            return ApiErrorResults.BadRequest(request);
        }

        var deleted = await handler.HandleAsync(
            new DeleteTemplateCommand(userId, templateId), cancellationToken);
        return deleted ? new NoContentResult() : ApiErrorResults.NotFound(request);
    }
}
