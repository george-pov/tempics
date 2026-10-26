using System.Text;
using TP.Application.Rendering;
using Xunit;

namespace TP.Api.Tests.Rendering;

public sealed class RenderPreviewHandlerTests(RenderFixture fixture)
{
    private const string Markup = """
        <Border xmlns="https://github.com/avaloniaui"
                Width="1200" Height="630" Background="#FFFFFF">
          <Grid>
            <TextBlock Text="You are invited" FontSize="64"
                       FontWeight="Bold" Foreground="#242424"
                       HorizontalAlignment="Center" VerticalAlignment="Center" />
          </Grid>
        </Border>
        """;

    [Theory]
    [InlineData("You are invited")]
    [InlineData("Edited preview")]
    public async Task HandleAsync_CurrentDraft_RendersWithSharedAvalonia(string text)
    {
        var handler = new RenderPreviewHandler(fixture.Renderer);
        var markup = Markup.Replace("Text=\"You are invited\"", $"Text=\"{text}\"",
            StringComparison.Ordinal);

        var result = await handler.HandleAsync(
                new RenderPreviewQuery(markup), TestContext.Current.CancellationToken)
            .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken);

        PngAssertions.IsExpectedPng(result.PngBytes);
    }

    [Fact]
    public async Task HandleAsync_ValidMarkup_PassesUtf8ToRenderer()
    {
        var renderer = new RendererStub(_ => Task.FromResult(new RenderImageResult([1, 2, 3])));
        var handler = new RenderPreviewHandler(renderer);
        using var cancellation = new CancellationTokenSource();

        var result = await handler.HandleAsync(new RenderPreviewQuery(Markup), cancellation.Token);

        Assert.Equal(new byte[] { 1, 2, 3 }, result.PngBytes);
        Assert.Equal(1, renderer.Calls);
        Assert.Equal(Encoding.UTF8.GetBytes(Markup), renderer.Axaml);
        Assert.Equal(cancellation.Token, renderer.Token);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \r\n  ")]
    public async Task HandleAsync_BlankMarkup_RejectsWithoutRendering(string? markup)
    {
        var renderer = new RendererStub(_ => throw new InvalidOperationException());
        var handler = new RenderPreviewHandler(renderer);

        var error = await Assert.ThrowsAsync<PreviewInputException>(() =>
            handler.HandleAsync(new RenderPreviewQuery(markup), CancellationToken.None));

        Assert.Equal(PreviewInputError.Invalid, error.Error);
        Assert.Equal(0, renderer.Calls);
    }

    [Fact]
    public async Task HandleAsync_NonblankMarkup_PassesThroughWithoutGrammarCheck()
    {
        const string markup = "<Border />";
        var renderer = new RendererStub(_ => Task.FromResult(new RenderImageResult([1])));
        var handler = new RenderPreviewHandler(renderer);

        await handler.HandleAsync(new RenderPreviewQuery(markup), CancellationToken.None);

        Assert.Equal(1, renderer.Calls);
        Assert.Equal(Encoding.UTF8.GetBytes(markup), renderer.Axaml);
    }

    [Fact]
    public async Task HandleAsync_TemplateAtCharacterLimit_Renders()
    {
        var renderer = new RendererStub(_ => Task.FromResult(new RenderImageResult([1])));
        var handler = new RenderPreviewHandler(renderer);
        var markup = new string('a', 2_048);

        await handler.HandleAsync(new RenderPreviewQuery(markup), CancellationToken.None);

        Assert.Equal(1, renderer.Calls);
        Assert.Equal(Encoding.UTF8.GetBytes(markup), renderer.Axaml);
    }

    [Fact]
    public async Task HandleAsync_TemplateAboveCharacterLimit_RejectsWithoutRendering()
    {
        var renderer = new RendererStub(_ => throw new InvalidOperationException());
        var handler = new RenderPreviewHandler(renderer);
        var markup = new string('a', 2_049);

        var error = await Assert.ThrowsAsync<PreviewInputException>(() =>
            handler.HandleAsync(new RenderPreviewQuery(markup), CancellationToken.None));

        Assert.Equal(PreviewInputError.TooLarge, error.Error);
        Assert.Equal(0, renderer.Calls);
    }

    [Fact]
    public async Task HandleAsync_CanceledBeforeRender_DoesNotRender()
    {
        var renderer = new RendererStub(_ => throw new InvalidOperationException());
        var handler = new RenderPreviewHandler(renderer);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.HandleAsync(new RenderPreviewQuery(Markup), cancellation.Token));

        Assert.Equal(0, renderer.Calls);
    }

    [Fact]
    public async Task HandleAsync_CanceledByRenderer_PropagatesCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var renderer = new RendererStub(token =>
        {
            cancellation.Cancel();
            return Task.FromCanceled<RenderImageResult>(token);
        });
        var handler = new RenderPreviewHandler(renderer);

        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.HandleAsync(new RenderPreviewQuery(Markup), cancellation.Token));

        Assert.Equal(cancellation.Token, error.CancellationToken);
        Assert.Equal(1, renderer.Calls);
    }

    [Fact]
    public async Task HandleAsync_EmptyRendererOutput_Rejects()
    {
        var renderer = new RendererStub(_ => Task.FromResult(new RenderImageResult([])));
        var handler = new RenderPreviewHandler(renderer);

        await Assert.ThrowsAsync<RenderImageException>(() =>
            handler.HandleAsync(new RenderPreviewQuery(Markup), CancellationToken.None));
    }

    private sealed class RendererStub(
        Func<CancellationToken, Task<RenderImageResult>> render) : IAxamlRenderer
    {
        public int Calls { get; private set; }
        public byte[]? Axaml { get; private set; }
        public CancellationToken Token { get; private set; }

        public Task<RenderImageResult> RenderAsync(
            ReadOnlyMemory<byte> axaml,
            CancellationToken cancellationToken)
        {
            Calls++;
            Axaml = axaml.ToArray();
            Token = cancellationToken;
            return render(cancellationToken);
        }
    }
}
