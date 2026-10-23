using Azure.Data.Tables;
using Microsoft.Extensions.Hosting;

namespace TP.TableStorage.Templates;

internal sealed class TemplateStoreInitializer(TableServiceClient serviceClient) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await serviceClient.CreateTableIfNotExistsAsync(
            TemplateStoreOptions.TableName,
            cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
