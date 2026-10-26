using Azure;
using Azure.Data.Tables;
using Azure.Data.Tables.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TP.Application.Templates;
using TP.TableStorage.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class TemplateStoreOptionsTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void AddTemplateStore_EitherMode_RegistersSameRepository(bool useUri)
    {
        var services = new ServiceCollection();
        services.AddTemplateStore(Configuration(
            uri: useUri ? "https://tables.example.test/" : null,
            connectionString: useUri ? null : "UseDevelopmentStorage=true"));
        using var provider = services.BuildServiceProvider();

        var table = provider.GetRequiredService<TableClient>();
        Assert.Equal(TemplateStoreOptions.TableName, table.Name);
        Assert.Equal(useUri ? "tables.example.test" : "127.0.0.1", table.Uri.Host);
        Assert.IsType<TableTemplateRepository>(provider.GetRequiredService<ITemplateRepository>());
        Assert.Single(provider.GetServices<IHostedService>());
    }

    [Fact]
    public void AddTemplateStore_ConnectionStringWithHostedMarkers_UsesConfiguredMode()
    {
        var services = new ServiceCollection();
        services.AddTemplateStore(Configuration(
            connectionString: "UseDevelopmentStorage=true",
            functionsEnvironment: "Production",
            siteName: "tempics-api"));
        using var provider = services.BuildServiceProvider();

        Assert.Equal("127.0.0.1", provider.GetRequiredService<TableClient>().Uri.Host);
    }

    [Fact]
    public void AddTemplateStore_BothSettings_UsesConnectionString()
    {
        var services = new ServiceCollection();
        services.AddTemplateStore(Configuration(
            uri: "https://tables.example.test/",
            connectionString: "UseDevelopmentStorage=true"));
        using var provider = services.BuildServiceProvider();

        Assert.Equal("127.0.0.1", provider.GetRequiredService<TableClient>().Uri.Host);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task AddTemplateStore_Initializer_UsesFlagInEitherMode(
        bool useUri, bool createResources)
    {
        var services = new ServiceCollection();
        services.AddTemplateStore(Configuration(
            uri: useUri ? "https://tables.example.test/" : null,
            connectionString: useUri ? null : "UseDevelopmentStorage=true",
            createResources: createResources.ToString()));
        var recording = new RecordingTableServiceClient();
        services.AddSingleton<TableServiceClient>(recording);
        using var provider = services.BuildServiceProvider();
        var initializer = Assert.Single(provider.GetServices<IHostedService>());
        using var cancellationSource = new CancellationTokenSource();
        var cancellationToken = cancellationSource.Token;

        Assert.Empty(recording.CreatedTables);
        await initializer.StartAsync(cancellationToken);
        await initializer.StopAsync(cancellationToken);

        if (createResources)
        {
            Assert.Equal((TemplateStoreOptions.TableName, cancellationToken),
                Assert.Single(recording.CreatedTables));
        }
        else
        {
            Assert.Empty(recording.CreatedTables);
        }
    }

    private static IConfiguration Configuration(
        string? uri = null, string? connectionString = null,
        string? createResources = null, string? functionsEnvironment = null,
        string? siteName = null)
    {
        var values = new Dictionary<string, string?>();
        if (uri is not null)
        {
            values["TemplateStore:TableServiceUri"] = uri;
        }

        if (connectionString is not null)
        {
            values["TemplateStore:ConnectionString"] = connectionString;
        }

        if (createResources is not null)
        {
            values["TemplateStore:CreateResourcesIfMissing"] = createResources;
        }

        if (functionsEnvironment is not null)
        {
            values["AZURE_FUNCTIONS_ENVIRONMENT"] = functionsEnvironment;
        }

        if (siteName is not null)
        {
            values["WEBSITE_SITE_NAME"] = siteName;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private sealed class RecordingTableServiceClient() : TableServiceClient("UseDevelopmentStorage=true")
    {
        public List<(string Name, CancellationToken CancellationToken)> CreatedTables { get; } = [];

        public override Task<Response<TableItem>> CreateTableIfNotExistsAsync(
            string tableName, CancellationToken cancellationToken = default)
        {
            CreatedTables.Add((tableName, cancellationToken));
            return Task.FromResult<Response<TableItem>>(null!);
        }
    }
}
