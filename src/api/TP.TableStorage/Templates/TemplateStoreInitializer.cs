using Azure.Data.Tables;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace TP.TableStorage.Templates;

internal sealed class TemplateStoreInitializer(
    TableServiceClient serviceClient,
    IOptions<TemplateStoreOptions> options) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!options.Value.CreateResourcesIfMissing)
        {
            return;
        }

        await serviceClient.CreateTableIfNotExistsAsync(
            TemplateStoreOptions.TableName,
            cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
