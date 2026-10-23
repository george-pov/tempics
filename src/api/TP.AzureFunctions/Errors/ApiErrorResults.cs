using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TP.Application.Templates;
using TP.TableStorage.Templates;

namespace TP.AzureFunctions.Errors;

public static class ApiErrorResults
{
    public static ObjectResult BadRequest(HttpRequest request) =>
        Create(request, StatusCodes.Status400BadRequest, "Invalid template request", "template_invalid");

    public static ObjectResult TooLarge(HttpRequest request) =>
        Create(request, StatusCodes.Status413PayloadTooLarge, "Template request is too large", "template_too_large");

    public static ObjectResult NotFound(HttpRequest request) =>
        Create(request, StatusCodes.Status404NotFound, "Template not found", "template_not_found");

    public static ObjectResult FromException(
        HttpRequest request, Exception exception, string functionName)
    {
        ArgumentNullException.ThrowIfNull(exception);

        if (functionName == "RenderSample")
        {
            return Create(request, StatusCodes.Status500InternalServerError,
                "Image rendering failed", "render_failed");
        }

        if (functionName is "CreateTemplate" or "ListTemplates" or "GetTemplate")
        {
            return exception switch
            {
                JsonException when functionName == "CreateTemplate" => BadRequest(request),
                TemplateInputException input when input.Error == TemplateInputError.TemplateTooLarge =>
                    TooLarge(request),
                TemplateInputException => BadRequest(request),
                UnauthorizedAccessException => Create(request, StatusCodes.Status401Unauthorized,
                    "Authentication required", "unauthorized"),
                TemplateUnavailableException => Create(request, StatusCodes.Status503ServiceUnavailable,
                    "Template storage is unavailable", "template_unavailable"),
                _ => Create(request, StatusCodes.Status500InternalServerError,
                    "Template operation failed", "template_failed")
            };
        }

        return Create(request, StatusCodes.Status500InternalServerError,
            "API request failed", "api_failed");
    }

    private static ObjectResult Create(HttpRequest request, int status, string title, string code)
    {
        var problem = new ProblemDetails { Status = status, Title = title };
        problem.Extensions["code"] = code;
        problem.Extensions["correlationId"] = request.HttpContext.TraceIdentifier;
        return new ObjectResult(problem)
        {
            StatusCode = status,
            ContentTypes = { "application/problem+json" }
        };
    }
}
