using Azure.Monitor.OpenTelemetry.Exporter;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Azure.Functions.Worker.OpenTelemetry;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry;
using TP.Application.Rendering;
using TP.Application.Templates;
using TP.Avalonia.Rendering;
using TP.AzureFunctions.Auth;
using TP.AzureFunctions.Errors;
using TP.TableStorage.Templates;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();
builder.UseMiddleware<ApiExceptionMiddleware>();
builder.UseMiddleware<BearerTokenMiddleware>();
builder.Services.AddApiAuth(builder.Configuration);

builder.Services.AddTransient<RenderSampleHandler>();
builder.Services.AddSingleton<IBundledTemplateSource, BundledTemplateSource>();
builder.Services.AddSingleton<AvaloniaRenderHost>();
builder.Services.AddSingleton<IAxamlRenderer, AvaloniaAxamlRenderer>();

builder.Services.AddTemplateStore(builder.Configuration);
builder.Services.AddTransient<CreateTemplateHandler>();
builder.Services.AddTransient<ListTemplatesHandler>();
builder.Services.AddTransient<FindTemplateHandler>();
builder.Services.AddTransient<UpdateTemplateHandler>();
builder.Services.AddTransient<DeleteTemplateHandler>();

if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING")))
{
    builder.Services.AddOpenTelemetry()
        .UseFunctionsWorkerDefaults()
        .UseAzureMonitorExporter();
}

await builder.Build().RunAsync();
