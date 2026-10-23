using Azure;
using Azure.Data.Tables;
using Azure.Data.Tables.Models;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using TP.Application.Templates;
using TP.TableStorage.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class TemplateStoreOptionsTests
{
    [Fact]
    public async Task AddTemplateStore_DevelopmentWithoutUri_DefersUnavailableError()
    {
        var services = new ServiceCollection();

        services.AddTemplateStore(Configuration(null), new HostEnvironmentStub("Development"));
        using var provider = services.BuildServiceProvider();
        var repository = provider.GetRequiredService<ITemplateRepository>();

        await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            repository.FindAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None));
        Assert.Null(provider.GetService<TableClient>());
        Assert.Empty(provider.GetServices<IHostedService>());
    }

    [Fact]
    public async Task AddTemplateStore_CoreToolsDevelopment_DefersUnavailableError()
    {
        var services = new ServiceCollection();

        services.AddTemplateStore(
            Configuration(null, "Development"), new HostEnvironmentStub("Production"));
        using var provider = services.BuildServiceProvider();

        await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            provider.GetRequiredService<ITemplateRepository>().FindAsync(
                Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public void AddTemplateStore_HostedDevelopmentWithoutUri_FailsAtStartup()
    {
        var services = new ServiceCollection();

        Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(
                Configuration(null, "Development", "tempics-api-dev"),
                new HostEnvironmentStub("Production")));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("http://storage.table.core.windows.net/")]
    [InlineData("https://user:secret@storage.table.core.windows.net/")]
    [InlineData("https://storage.table.core.windows.net/?sig=secret")]
    [InlineData("https://storage.table.core.windows.net/not-a-service-root")]
    public void AddTemplateStore_HostedInvalidUri_FailsAtStartup(string? uri)
    {
        var services = new ServiceCollection();

        var failure = Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(Configuration(uri), new HostEnvironmentStub("Production")));

        Assert.DoesNotContain("secret", failure.Message);
        Assert.DoesNotContain(services, descriptor => descriptor.ServiceType == typeof(ITemplateRepository));
    }

    [Fact]
    public void AddTemplateStore_ValidHostedUri_RegistersAzureTableClient()
    {
        var services = new ServiceCollection();

        services.AddTemplateStore(
            Configuration("https://storage.table.core.windows.net/"),
            new HostEnvironmentStub("Production"));
        using var provider = services.BuildServiceProvider();
        var table = provider.GetRequiredService<TableClient>();

        Assert.Equal(TemplateStoreOptions.TableName, table.Name);
        Assert.IsType<TableTemplateRepository>(provider.GetRequiredService<ITemplateRepository>());
        Assert.NotNull(provider.GetService<DefaultAzureCredential>());
        Assert.Empty(provider.GetServices<IHostedService>());
    }

    [Fact]
    public void AddTemplateStore_LocalEmulator_RegistersTableWithoutProvisioning()
    {
        var services = new ServiceCollection();

        services.AddTemplateStore(
            Configuration(connectionString: "UseDevelopmentStorage=true"),
            new HostEnvironmentStub("Development"));
        using var provider = services.BuildServiceProvider();

        Assert.Equal(TemplateStoreOptions.TableName, provider.GetRequiredService<TableClient>().Name);
        Assert.IsType<TableTemplateRepository>(provider.GetRequiredService<ITemplateRepository>());
        Assert.Equal("http://127.0.0.1:10002/devstoreaccount1",
            provider.GetRequiredService<TableServiceClient>().Uri.AbsoluteUri.TrimEnd('/'));
        Assert.Null(provider.GetService<DefaultAzureCredential>());
        Assert.Empty(provider.GetServices<IHostedService>());
    }

    [Fact]
    public async Task AddTemplateStore_LocalProvisioning_CreatesTableAtStartup()
    {
        var services = new ServiceCollection();
        services.AddTemplateStore(
            Configuration(connectionString: "UseDevelopmentStorage=true", createResources: "true"),
            new HostEnvironmentStub("Development"));
        var tableService = new RecordingTableServiceClient();
        services.AddSingleton<TableServiceClient>(tableService);
        using var provider = services.BuildServiceProvider();
        var initializer = Assert.Single(provider.GetServices<IHostedService>());
        using var cancellationSource = new CancellationTokenSource();
        var cancellationToken = cancellationSource.Token;

        Assert.Empty(tableService.CreatedTables);
        await initializer.StartAsync(cancellationToken);
        await initializer.StopAsync(cancellationToken);

        Assert.Equal((TemplateStoreOptions.TableName, cancellationToken),
            Assert.Single(tableService.CreatedTables));
    }

    [Theory]
    [InlineData("DefaultEndpointsProtocol=https;AccountName=prod;AccountKey=secret")]
    [InlineData("UseDevelopmentStorage=true;DevelopmentStorageProxyUri=http://127.0.0.1")]
    [InlineData("usedevelopmentstorage=true")]
    public void AddTemplateStore_NonEmulatorConnectionString_FailsAtStartup(string value)
    {
        var services = new ServiceCollection();

        var failure = Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(Configuration(connectionString: value),
                new HostEnvironmentStub("Development")));

        Assert.DoesNotContain("secret", failure.Message);
        Assert.DoesNotContain(services, descriptor => descriptor.ServiceType == typeof(ITemplateRepository));
    }

    [Theory]
    [InlineData("Production", null, null)]
    [InlineData("Production", "Development", "tempics-api-dev")]
    public void AddTemplateStore_HostedConnectionString_FailsAtStartup(
        string environmentName, string? functionsEnvironment, string? siteName)
    {
        var services = new ServiceCollection();

        Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(
                Configuration(connectionString: "UseDevelopmentStorage=true",
                    functionsEnvironment: functionsEnvironment, siteName: siteName),
                new HostEnvironmentStub(environmentName)));
    }

    [Fact]
    public void AddTemplateStore_BothModes_FailsAtStartup()
    {
        var services = new ServiceCollection();

        Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(
                Configuration(uri: "https://storage.table.core.windows.net/",
                    connectionString: "UseDevelopmentStorage=true"),
                new HostEnvironmentStub("Development")));
    }

    [Theory]
    [InlineData("https://storage.table.core.windows.net/", "Production")]
    [InlineData(null, "Development")]
    [InlineData("https://storage.table.core.windows.net/", "Development")]
    public void AddTemplateStore_ProvisioningWithoutEmulator_FailsAtStartup(
        string? uri, string environmentName)
    {
        var services = new ServiceCollection();

        Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(
                Configuration(uri: uri, createResources: "true"),
                new HostEnvironmentStub(environmentName)));
    }

    [Fact]
    public void AddTemplateStore_HostedDevMarkerProvisioning_FailsAtStartup()
    {
        var services = new ServiceCollection();

        Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(
                Configuration(uri: "https://storage.table.core.windows.net/",
                    createResources: "true", functionsEnvironment: "Development",
                    siteName: "tempics-api-dev"),
                new HostEnvironmentStub("Development")));
    }

    [Fact]
    public void AddTemplateStore_InvalidProvisioningSetting_FailsAtStartup()
    {
        var services = new ServiceCollection();

        var failure = Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(
                Configuration(connectionString: "UseDevelopmentStorage=true", createResources: "secret"),
                new HostEnvironmentStub("Development")));

        Assert.DoesNotContain("secret", failure.Message);
    }

    [Fact]
    public void ResolveUri_DevelopmentHttps_AcceptsEndpoint()
    {
        const string value = "https://storage.table.core.windows.net/";
        var options = new TemplateStoreOptions { TableServiceUri = value };

        var uri = options.ResolveUri(isDevelopment: true);

        Assert.Equal(value, uri?.AbsoluteUri);
    }

    [Fact]
    public void ResolveUri_DevelopmentHttpLoopback_RejectsEndpoint()
    {
        var options = new TemplateStoreOptions
        {
            TableServiceUri = "http://127.0.0.1:10002/devstoreaccount1"
        };

        Assert.Throws<InvalidOperationException>(() => options.ResolveUri(isDevelopment: true));
    }

    [Fact]
    public void AddTemplateStore_LocalHttpUri_FailsAtStartup()
    {
        var services = new ServiceCollection();

        Assert.Throws<InvalidOperationException>(() =>
            services.AddTemplateStore(
                Configuration(uri: "http://127.0.0.1:10002/devstoreaccount1"),
                new HostEnvironmentStub("Development")));
    }

    private static IConfiguration Configuration(
        string? uri = null, string? functionsEnvironment = null, string? siteName = null,
        string? connectionString = null, string? createResources = null)
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

    private sealed class HostEnvironmentStub(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;

        public string ApplicationName { get; set; } = "Tempics.Tests";

        public string ContentRootPath { get; set; } = string.Empty;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
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
