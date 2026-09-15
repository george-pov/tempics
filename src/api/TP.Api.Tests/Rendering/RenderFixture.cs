using TP.Avalonia.Rendering;
using Xunit;

namespace TP.Api.Tests.Rendering;

public sealed class RenderFixture : IAsyncLifetime
{
    public static TimeSpan Timeout { get; } = TimeSpan.FromSeconds(30);

    public AvaloniaRenderHost Host { get; } = new();

    public BundledTemplateSource Source { get; } = new();

    public AvaloniaAxamlRenderer Renderer { get; }

    public RenderFixture()
    {
        Renderer = new AvaloniaAxamlRenderer(Host);
    }

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        await Host.DisposeAsync().AsTask().WaitAsync(Timeout);
    }
}
