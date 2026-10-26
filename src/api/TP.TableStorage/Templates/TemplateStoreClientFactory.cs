using Azure.Data.Tables;
using Azure.Identity;

namespace TP.TableStorage.Templates;

internal static class TemplateStoreClientFactory
{
    internal static TableServiceClient CreateTableServiceClient(TemplateStoreOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (!string.IsNullOrWhiteSpace(options.ConnectionString))
        {
            return new TableServiceClient(options.ConnectionString);
        }

        return new TableServiceClient(
            new Uri(options.TableServiceUri?.Trim() ?? string.Empty, UriKind.Absolute),
            new DefaultAzureCredential());
    }
}
