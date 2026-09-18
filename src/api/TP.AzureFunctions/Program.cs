using Azure.Monitor.OpenTelemetry.Exporter;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Azure.Functions.Worker.OpenTelemetry;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry;
using TP.Application.Rendering;
using TP.Avalonia.Rendering;
using TP.AzureFunctions.Auth;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();
builder.UseMiddleware<BearerTokenMiddleware>();
builder.Services.AddApiAuth(builder.Configuration);

builder.Services.AddTransient<RenderSampleHandler>();
builder.Services.AddSingleton<IBundledTemplateSource, BundledTemplateSource>();
builder.Services.AddSingleton<AvaloniaRenderHost>();
builder.Services.AddSingleton<IAxamlRenderer, AvaloniaAxamlRenderer>();

if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING")))
{
    builder.Services.AddOpenTelemetry()
        .UseFunctionsWorkerDefaults()
        .UseAzureMonitorExporter();
}

await builder.Build().RunAsync();
