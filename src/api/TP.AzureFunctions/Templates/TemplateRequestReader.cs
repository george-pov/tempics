using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace TP.AzureFunctions.Templates;

internal static class TemplateRequestReader
{
    private const int MaxBodyBytes = 128 * 1024;

    private static readonly JsonSerializerOptions RequestJson = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public static async Task<(TRequest? Payload, bool TooLarge)> ReadAsync<TRequest>(
        HttpRequest request,
        CancellationToken cancellationToken)
        where TRequest : class
    {
        if (request.ContentLength > MaxBodyBytes)
        {
            return (null, true);
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
                return (null, true);
            }

            body.Write(buffer, 0, count);
        }

        body.Position = 0;
        var payload = await JsonSerializer.DeserializeAsync<TRequest>(
            body, RequestJson, cancellationToken);
        return (payload, false);
    }
}
