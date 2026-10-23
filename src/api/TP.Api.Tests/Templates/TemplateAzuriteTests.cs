using System.Runtime.CompilerServices;
using Azure.Data.Tables;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using TP.Application.Templates;
using TP.TableStorage.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class TemplateAzuriteTests
{
    [AzuriteFact]
    public async Task AddTemplateStore_DevelopmentAzurite_RoundTripsSavedTemplate()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["AZURE_FUNCTIONS_ENVIRONMENT"] = "Development",
                ["TemplateStore:ConnectionString"] = "UseDevelopmentStorage=true",
                ["TemplateStore:CreateResourcesIfMissing"] = "true"
            }).Build();
        var services = new ServiceCollection();
        services.AddTemplateStore(configuration, new HostEnvironmentStub());
        using var provider = services.BuildServiceProvider();

        var initializer = Assert.Single(provider.GetServices<IHostedService>());
        await initializer.StartAsync(CancellationToken.None);

        var tableNames = new List<string>();
        var serviceClient = provider.GetRequiredService<TableServiceClient>();
        await foreach (var table in serviceClient.QueryAsync(
            cancellationToken: CancellationToken.None))
        {
            tableNames.Add(table.Name);
        }

        Assert.Contains(TemplateStoreOptions.TableName, tableNames);

        var repository = provider.GetRequiredService<ITemplateRepository>();
        var saved = new ImageTemplate(
            Guid.NewGuid(), Guid.NewGuid(), "Azurite test", "<TextBlock Text=\"saved\" />");
        Assert.Empty(await repository.ListAsync(saved.UserId, CancellationToken.None));

        var created = false;
        try
        {
            await repository.CreateAsync(saved, CancellationToken.None);
            created = true;

            var summaries = await repository.ListAsync(saved.UserId, CancellationToken.None);
            Assert.Equal(new TemplateSummary(saved.Id, saved.Name), Assert.Single(summaries));

            var found = Assert.IsType<ImageTemplate>(
                await repository.FindAsync(saved.UserId, saved.Id, CancellationToken.None));
            Assert.Equal(saved, found);
        }
        finally
        {
            if (created)
            {
                var tableClient = provider.GetRequiredService<TableClient>();
                await tableClient.DeleteEntityAsync(
                    saved.UserId.ToString("D"), saved.Id.ToString("D"),
                    cancellationToken: CancellationToken.None);
            }
        }
    }

    private sealed class HostEnvironmentStub : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";

        public string ApplicationName { get; set; } = "Tempics.Tests";

        public string ContentRootPath { get; set; } = string.Empty;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

internal sealed class AzuriteFactAttribute : FactAttribute
{
    public AzuriteFactAttribute(
        [CallerFilePath] string sourceFilePath = "",
        [CallerLineNumber] int sourceLineNumber = 0)
        : base(sourceFilePath, sourceLineNumber)
    {
        if (!string.Equals(
            Environment.GetEnvironmentVariable("TEMPICS_RUN_AZURITE_TESTS"),
            "1",
            StringComparison.Ordinal))
        {
            Skip = "Set TEMPICS_RUN_AZURITE_TESTS=1 to run Azurite contracts.";
        }
    }
}
