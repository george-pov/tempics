using System.Text;
using TP.Application.Rendering;
using Xunit;

namespace TP.Api.Tests.Rendering;

public sealed class AvaloniaAxamlRendererTests(RenderFixture fixture)
{
    [Fact]
    public async Task RenderAsync_Font_IsInter()
    {
        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);
        var result = await fixture.Renderer.RenderAsync(axaml, TestContext.Current.CancellationToken)
            .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken);

        PngAssertions.IsExpectedPng(result.PngBytes);
        var usesInter = await fixture.Host.DispatchAsync(
            () => global::Avalonia.Media.FontManager.Current.DefaultFontFamily.Equals(
                new global::Avalonia.Media.FontFamily("fonts:Inter#Inter")),
            TestContext.Current.CancellationToken);

        // An OS-selected default may not exist on the Azure Linux host.
        Assert.True(usesInter, "The render host must use its bundled Inter font as the default.");
    }

    [Fact]
    public async Task RenderAsync_SampleTemplate_ReturnsExpectedPng()
    {
        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);

        var result = await fixture.Renderer.RenderAsync(axaml, TestContext.Current.CancellationToken)
            .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken);

        PngAssertions.IsExpectedPng(result.PngBytes);
    }

    [Fact]
    public async Task RenderAsync_MalformedAxaml_ThrowsRenderImageException()
    {
        await Assert.ThrowsAsync<RenderImageException>(() =>
            fixture.Renderer.RenderAsync("<Border"u8.ToArray(), TestContext.Current.CancellationToken)
                .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task RenderAsync_MissingSize_ThrowsRenderImageException()
    {
        var axaml = Encoding.UTF8.GetBytes("""
            <Border xmlns="https://github.com/avaloniaui" Background="Red" />
            """);

        await Assert.ThrowsAsync<RenderImageException>(() =>
            fixture.Renderer.RenderAsync(axaml, TestContext.Current.CancellationToken)
                .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task RenderAsync_OversizedRoot_ThrowsRenderImageException()
    {
        var axaml = Encoding.UTF8.GetBytes("""
            <Border xmlns="https://github.com/avaloniaui" Width="1201" Height="630" />
            """);

        await Assert.ThrowsAsync<RenderImageException>(() =>
            fixture.Renderer.RenderAsync(axaml, TestContext.Current.CancellationToken)
                .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task RenderAsync_CanceledBeforeDispatch_ThrowsOperationCanceledException()
    {
        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            fixture.Renderer.RenderAsync(axaml, cancellation.Token)
                .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken));

        Assert.Equal(cancellation.Token, failure.CancellationToken);
    }

    [Fact]
    public async Task RenderAsync_ConcurrentCalls_CompletesWithoutDeadlock()
    {
        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);
        using var cancellation = new CancellationTokenSource(RenderFixture.Timeout);

        var renders = Enumerable.Range(0, 4)
            .Select(_ => fixture.Renderer.RenderAsync(axaml, cancellation.Token))
            .ToArray();
        var results = await Task.WhenAll(renders)
            .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken);

        Assert.Equal(4, results.Length);
        Assert.All(results, result => PngAssertions.IsExpectedPng(result.PngBytes));
    }

    [Fact]
    public async Task RenderAsync_CanceledWhileQueued_StopsWaiting()
    {
        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);
        using var release = new ManualResetEventSlim();
        using var cancellation = new CancellationTokenSource();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var active = fixture.Host.DispatchAsync(() =>
        {
            entered.SetResult();
            if (!release.Wait(TimeSpan.FromSeconds(15)))
            {
                throw new TimeoutException("The test did not release the render callback.");
            }

            return true;
        }, TestContext.Current.CancellationToken);

        try
        {
            await entered.Task.WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken);
            var queued = fixture.Renderer.RenderAsync(axaml, cancellation.Token);
            cancellation.Cancel();

            var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
                queued.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken));

            Assert.Equal(cancellation.Token, failure.CancellationToken);
        }
        finally
        {
            release.Set();
#pragma warning disable xUnit1051 // Cleanup must observe the callback even when the runner cancels the test.
            await active.WaitAsync(RenderFixture.Timeout);
#pragma warning restore xUnit1051
        }
    }
}
