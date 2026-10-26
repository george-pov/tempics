using Azure.Data.Tables;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TP.Application.Templates;

namespace TP.TableStorage.Templates;

public static class TemplateStoreRegistration
{
    public static IServiceCollection AddTemplateStore(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<TemplateStoreOptions>()
            .Bind(configuration.GetSection(TemplateStoreOptions.SectionName));

        services.AddSingleton(provider =>
            TemplateStoreClientFactory.CreateTableServiceClient(
                provider.GetRequiredService<IOptions<TemplateStoreOptions>>().Value));
        services.AddSingleton(provider =>
            provider.GetRequiredService<TableServiceClient>()
                .GetTableClient(TemplateStoreOptions.TableName));
        services.AddSingleton<ITemplateRepository, TableTemplateRepository>();
        services.AddHostedService<TemplateStoreInitializer>();

        return services;
    }
}
