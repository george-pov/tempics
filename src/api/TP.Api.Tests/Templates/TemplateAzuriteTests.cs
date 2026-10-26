using System.Runtime.CompilerServices;
using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TP.Application.Templates;
using TP.TableStorage.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class TemplateAzuriteTests
{
    [AzuriteFact]
    public async Task AddTemplateStore_ConnectionStringAzurite_RoundTripsSavedTemplate()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["TemplateStore:ConnectionString"] = "UseDevelopmentStorage=true",
                ["TemplateStore:CreateResourcesIfMissing"] = "true"
            }).Build();
        var services = new ServiceCollection();
        services.AddTemplateStore(configuration);
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

        try
        {
            await repository.CreateAsync(saved, CancellationToken.None);

            var summaries = await repository.ListAsync(saved.UserId, CancellationToken.None);
            Assert.Equal(new TemplateSummary(saved.Id, saved.Name), Assert.Single(summaries));

            var found = Assert.IsType<ImageTemplate>(
                await repository.FindAsync(saved.UserId, saved.Id, CancellationToken.None));
            Assert.Equal(saved, found);
        }
        finally
        {
            await CleanupRowAsync(provider, saved);
        }
    }

    [AzuriteFact]
    public async Task UpdateAsync_DevelopmentAzurite_ReplacesExistingOwnerRow()
    {
        using var provider = await CreateAzuriteProviderAsync();
        var repository = provider.GetRequiredService<ITemplateRepository>();
        var original = new ImageTemplate(
            Guid.NewGuid(), Guid.NewGuid(), "Before", "<TextBlock Text=\"before\" />");
        var replacement = original with
        {
            Name = "After",
            Template = " <TextBlock Text=\"after\" />\r\n"
        };

        try
        {
            await repository.CreateAsync(original, CancellationToken.None);
            Assert.True(await repository.UpdateAsync(replacement, CancellationToken.None));
            Assert.Equal(replacement,
                await repository.FindAsync(original.UserId, original.Id, CancellationToken.None));
            Assert.Equal(new TemplateSummary(original.Id, "After"),
                Assert.Single(await repository.ListAsync(original.UserId, CancellationToken.None)));
            Assert.False(await repository.UpdateAsync(
                replacement with { UserId = Guid.NewGuid() }, CancellationToken.None));
        }
        finally
        {
            await CleanupRowAsync(provider, original);
        }
    }

    [AzuriteFact]
    public async Task DeleteAsync_DevelopmentAzurite_RemovesOnlyOwnerRow()
    {
        using var provider = await CreateAzuriteProviderAsync();
        var repository = provider.GetRequiredService<ITemplateRepository>();
        var saved = new ImageTemplate(
            Guid.NewGuid(), Guid.NewGuid(), "Delete me", "<TextBlock />");

        try
        {
            await repository.CreateAsync(saved, CancellationToken.None);
            Assert.False(await repository.DeleteAsync(
                Guid.NewGuid(), saved.Id, CancellationToken.None));
            Assert.True(await repository.DeleteAsync(
                saved.UserId, saved.Id, CancellationToken.None));
            Assert.Null(await repository.FindAsync(saved.UserId, saved.Id, CancellationToken.None));
            Assert.Empty(await repository.ListAsync(saved.UserId, CancellationToken.None));
            Assert.False(await repository.DeleteAsync(
                saved.UserId, saved.Id, CancellationToken.None));
        }
        finally
        {
            await CleanupRowAsync(provider, saved);
        }
    }

    private static async Task<ServiceProvider> CreateAzuriteProviderAsync()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["TemplateStore:ConnectionString"] = "UseDevelopmentStorage=true",
                ["TemplateStore:CreateResourcesIfMissing"] = "true"
            }).Build();
        var services = new ServiceCollection();
        services.AddTemplateStore(configuration);
        var provider = services.BuildServiceProvider();
        try
        {
            await Assert.Single(provider.GetServices<IHostedService>())
                .StartAsync(CancellationToken.None);
            return provider;
        }
        catch
        {
            provider.Dispose();
            throw;
        }
    }

    private static async Task CleanupRowAsync(ServiceProvider provider, ImageTemplate saved)
    {
        try
        {
            await provider.GetRequiredService<TableClient>().DeleteEntityAsync(
                saved.UserId.ToString("D"), saved.Id.ToString("D"),
                cancellationToken: CancellationToken.None);
        }
        catch (RequestFailedException exception) when (
            exception.Status == 404 && exception.ErrorCode == "EntityNotFound")
        {
            // The delete contract already removed this test-created row.
        }
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
