using TP.Application.Rendering;
using Xunit;

namespace TP.Api.Tests.Rendering;

public sealed class RenderSampleHandlerTests
{
    [Fact]
    public async Task HandleAsync_ValidTemplate_ReturnsRendererOutput()
    {
        var expected = new RenderImageResult([1, 2, 3]);
        var source = new TemplateStub("trusted sample"u8.ToArray());
        var renderer = new RendererStub(_ => Task.FromResult(expected));
        var handler = new RenderSampleHandler(source, renderer);

        var actual = await handler.HandleAsync(new RenderSampleQuery(), CancellationToken.None);

        Assert.Equal(expected.PngBytes, actual.PngBytes);
    }

    [Fact]
    public async Task HandleAsync_ValidTemplate_RendersBundledBytes()
    {
        byte[] axaml = "trusted sample"u8.ToArray();
        var source = new TemplateStub(axaml);
        var renderer = new RendererStub(_ => Task.FromResult(new RenderImageResult([1])));

        await new RenderSampleHandler(source, renderer).HandleAsync(
            new RenderSampleQuery(), CancellationToken.None);

        Assert.Equal(axaml, renderer.Input.ToArray());
    }

    [Fact]
    public async Task HandleAsync_RequestCanceled_ForwardsCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var source = new TemplateStub("trusted sample"u8.ToArray());
        var renderer = new RendererStub(token =>
        {
            cancellation.Cancel();
            return Task.FromCanceled<RenderImageResult>(token);
        });
        var handler = new RenderSampleHandler(source, renderer);

        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.HandleAsync(new RenderSampleQuery(), cancellation.Token));

        Assert.Equal(cancellation.Token, failure.CancellationToken);
        Assert.Equal(cancellation.Token, source.Token);
        Assert.Equal(cancellation.Token, renderer.Token);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleAsync_EmptyRendererOutput_ThrowsRenderImageException(bool useNull)
    {
        var source = new TemplateStub("trusted sample"u8.ToArray());
        var renderer = new RendererStub(_ =>
            Task.FromResult(new RenderImageResult(useNull ? null! : [])));
        var handler = new RenderSampleHandler(source, renderer);

        await Assert.ThrowsAsync<RenderImageException>(() =>
            handler.HandleAsync(new RenderSampleQuery(), CancellationToken.None));
    }

    private sealed class TemplateStub(byte[] axaml) : IBundledTemplateSource
    {
        public CancellationToken Token { get; private set; }

        public ValueTask<ReadOnlyMemory<byte>> LoadAsync(CancellationToken cancellationToken)
        {
            Token = cancellationToken;
            return ValueTask.FromResult<ReadOnlyMemory<byte>>(axaml);
        }
    }

    private sealed class RendererStub(
        Func<CancellationToken, Task<RenderImageResult>> render) : IAxamlRenderer
    {
        public ReadOnlyMemory<byte> Input { get; private set; }

        public CancellationToken Token { get; private set; }

        public Task<RenderImageResult> RenderAsync(
            ReadOnlyMemory<byte> axaml,
            CancellationToken cancellationToken)
        {
            Input = axaml;
            Token = cancellationToken;
            return render(cancellationToken);
        }
    }
}
