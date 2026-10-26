using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Auth;
using TP.AzureFunctions.Errors;

namespace TP.AzureFunctions.Templates;

public sealed class CreateTemplate(CreateTemplateHandler handler)
{
    [Function("CreateTemplate")]
    public async Task<IActionResult> RunAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "templates")]
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        request.HttpContext.Response.Headers.CacheControl = "no-store";

        var userId = TemplateCaller.GetUserId(request.HttpContext.User);
        var (payload, tooLarge) = await TemplateRequestReader.ReadAsync<CreateTemplateRequest>(
            request, cancellationToken);
        if (tooLarge)
        {
            return ApiErrorResults.TooLarge(request);
        }

        if (payload is null)
        {
            return ApiErrorResults.BadRequest(request);
        }

        var result = await handler.HandleAsync(
            new CreateTemplateCommand(userId, payload.Name, payload.Template),
            cancellationToken);
        var location = $"/api/templates/{result.Id:D}";
        return new CreatedResult(location, new CreateTemplateResponse(result.Id, result.Name));
    }
}
