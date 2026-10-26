using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Auth;
using TP.AzureFunctions.Errors;

namespace TP.AzureFunctions.Templates;

public sealed class UpdateTemplate(UpdateTemplateHandler handler)
{
    [Function("UpdateTemplate")]
    public async Task<IActionResult> RunAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "templates/{id}")]
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

        var (payload, tooLarge) = await TemplateRequestReader.ReadAsync<UpdateTemplateRequest>(
            request, cancellationToken);
        if (tooLarge)
        {
            return ApiErrorResults.TooLarge(request);
        }

        if (payload is null)
        {
            return ApiErrorResults.BadRequest(request);
        }

        var updated = await handler.HandleAsync(
            new UpdateTemplateCommand(userId, templateId, payload.Name, payload.Template),
            cancellationToken);
        return updated ? new NoContentResult() : ApiErrorResults.NotFound(request);
    }
}
