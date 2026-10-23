using Azure.Data.Tables;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TP.Application.Templates;

namespace TP.TableStorage.Templates;

public static class TemplateStoreRegistration
{
    private const string EmulatorConnectionString = "UseDevelopmentStorage=true";

    public static IServiceCollection AddTemplateStore(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        var createResources = configuration[$"{TemplateStoreOptions.SectionName}:{nameof(TemplateStoreOptions.CreateResourcesIfMissing)}"];
        if (createResources is not null && !bool.TryParse(createResources, out _))
        {
            throw new InvalidOperationException("Template storage resource creation setting is invalid.");
        }

        var options = new TemplateStoreOptions
        {
            ConnectionString = configuration[$"{TemplateStoreOptions.SectionName}:{nameof(TemplateStoreOptions.ConnectionString)}"],
            TableServiceUri = configuration[$"{TemplateStoreOptions.SectionName}:{nameof(TemplateStoreOptions.TableServiceUri)}"],
            CreateResourcesIfMissing = bool.TryParse(createResources, out var enabled) && enabled
        };
        var functionsEnvironment = configuration["AZURE_FUNCTIONS_ENVIRONMENT"];
        var isHosted = !string.IsNullOrWhiteSpace(configuration["WEBSITE_SITE_NAME"]);
        var isDevelopment = !isHosted && (functionsEnvironment is null
            ? environment.IsDevelopment()
            : string.Equals(functionsEnvironment, "Development", StringComparison.OrdinalIgnoreCase));
        var hasConnectionString = !string.IsNullOrWhiteSpace(options.ConnectionString);
        var hasUri = !string.IsNullOrWhiteSpace(options.TableServiceUri);
        if (hasConnectionString && hasUri)
        {
            throw new InvalidOperationException("Configure one template storage mode.");
        }

        if (hasConnectionString)
        {
            if (!isDevelopment ||
                !string.Equals(options.ConnectionString, EmulatorConnectionString, StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Template storage connection string is only supported for the local emulator.");
            }

            services.AddSingleton(options);
            services.AddSingleton(new TableServiceClient(EmulatorConnectionString));
            services.AddSingleton(provider =>
                provider.GetRequiredService<TableServiceClient>()
                    .GetTableClient(TemplateStoreOptions.TableName));
            services.AddSingleton<ITemplateRepository, TableTemplateRepository>();
            if (options.CreateResourcesIfMissing)
            {
                services.AddHostedService<TemplateStoreInitializer>();
            }

            return services;
        }

        if (options.CreateResourcesIfMissing)
        {
            throw new InvalidOperationException("Template storage resource creation requires the local emulator.");
        }

        var uri = options.ResolveUri(isDevelopment);
        services.AddSingleton(options);

        if (uri is null)
        {
            services.AddSingleton<ITemplateRepository, UnavailableTemplateRepository>();
            return services;
        }

        services.AddSingleton<DefaultAzureCredential>();
        services.AddSingleton(provider =>
            new TableServiceClient(uri, provider.GetRequiredService<DefaultAzureCredential>())
                .GetTableClient(TemplateStoreOptions.TableName));
        services.AddSingleton<ITemplateRepository, TableTemplateRepository>();
        return services;
    }

    private sealed class UnavailableTemplateRepository : ITemplateRepository
    {
        public Task CreateAsync(ImageTemplate template, CancellationToken cancellationToken) =>
            throw new TemplateUnavailableException();

        public Task<IReadOnlyList<TemplateSummary>> ListAsync(
            Guid userId, CancellationToken cancellationToken) =>
            throw new TemplateUnavailableException();

        public Task<ImageTemplate?> FindAsync(
            Guid userId, Guid id, CancellationToken cancellationToken) =>
            throw new TemplateUnavailableException();
    }
}
