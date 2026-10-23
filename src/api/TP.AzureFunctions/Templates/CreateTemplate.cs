using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Auth;
using TP.AzureFunctions.Errors;

namespace TP.AzureFunctions.Templates;

public sealed class CreateTemplate(CreateTemplateHandler handler)
{
    private const int MaxBodyBytes = 128 * 1024;

    private static readonly JsonSerializerOptions RequestJson = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    [Function("CreateTemplate")]
    public async Task<IActionResult> RunAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "templates")]
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        request.HttpContext.Response.Headers.CacheControl = "no-store";

        var userId = TemplateCaller.GetUserId(request.HttpContext.User);
        if (request.ContentLength > MaxBodyBytes)
        {
            return ApiErrorResults.TooLarge(request);
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
                return ApiErrorResults.TooLarge(request);
            }

            body.Write(buffer, 0, count);
        }

        body.Position = 0;
        var payload = await JsonSerializer.DeserializeAsync<CreateTemplateRequest>(
            body, RequestJson, cancellationToken);
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
