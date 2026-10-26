using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Rendering;
using TP.AzureFunctions.Rendering;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class RenderPreviewTests
{
    private const string ValidTemplate = """
        <Border xmlns="https://github.com/avaloniaui" Width="1200" Height="630" Background="#FFFFFF">
          <Grid>
            <TextBlock Text="You are invited" FontSize="64" FontWeight="Bold"
                       Foreground="#242424" HorizontalAlignment="Center" VerticalAlignment="Center" />
          </Grid>
        </Border>
        """;

    [Fact]
    public async Task RunAsync_ValidDraft_ReturnsNoStorePngWithoutFilename()
    {
        byte[] png = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3];
        var renderer = new PreviewRendererStub((_, _) =>
            Task.FromResult(new RenderImageResult(png)));
        var context = new DefaultHttpContext { TraceIdentifier = "preview-correlation" };
        context.Request.Body = Body(JsonSerializer.Serialize(new { template = ValidTemplate }));
        using var cancellation = new CancellationTokenSource();

        var result = await CreateFunction(renderer).RunAsync(
            context.Request, cancellation.Token);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("image/png", file.ContentType);
        Assert.Equal(png, file.FileContents);
        Assert.True(string.IsNullOrEmpty(file.FileDownloadName));
        Assert.False(context.Response.Headers.ContainsKey("Content-Disposition"));
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.Equal(cancellation.Token, renderer.Token);
        Assert.Equal(1, renderer.CallCount);
        Assert.Equal(Encoding.UTF8.GetBytes(ValidTemplate), renderer.Axaml);
    }

    [Theory]
    [InlineData("{not-json")]
    [InlineData("{}")]
    [InlineData("{\"template\":\"text\",\"userId\":\"evil\"}")]
    [InlineData("{\"template\":\"one\",\"template\":\"two\"}")]
    [InlineData("{\"Template\":\"text\"}")]
    [InlineData("{\"template\":3}")]
    public async Task RunAsync_MalformedOrUnknownJson_RejectsBeforeRender(string json)
    {
        var renderer = new PreviewRendererStub((_, _) =>
            throw new InvalidOperationException("Renderer must not be called."));
        var context = new DefaultHttpContext();
        context.Request.Body = Body(json);

        await Assert.ThrowsAnyAsync<JsonException>(() =>
            CreateFunction(renderer).RunAsync(context.Request, CancellationToken.None));

        Assert.Equal(0, renderer.CallCount);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_NullPayload_ReturnsSafeBadRequestWithoutRender()
    {
        var renderer = new PreviewRendererStub((_, _) =>
            throw new InvalidOperationException("Renderer must not be called."));
        var context = new DefaultHttpContext();
        context.Request.Body = Body("null");

        var result = await CreateFunction(renderer).RunAsync(
            context.Request, CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, renderer.CallCount);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RunAsync_OversizedBody_RejectsWhileReadingOrFromLength(bool knownLength)
    {
        var renderer = new PreviewRendererStub((_, _) =>
            throw new InvalidOperationException("Renderer must not be called."));
        var context = new DefaultHttpContext();
        context.Request.Body = Body(new string('x', 2_049));
        if (knownLength)
        {
            context.Request.ContentLength = 2_049;
        }

        var result = await CreateFunction(renderer).RunAsync(
            context.Request, CancellationToken.None);

        Assert.Equal(StatusCodes.Status413PayloadTooLarge, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, renderer.CallCount);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RunAsync_BodyAtLimit_Renders(bool knownLength)
    {
        var json = JsonSerializer.Serialize(new { template = ValidTemplate });
        var body = json.PadRight(2_048);
        Assert.Equal(2_048, Encoding.UTF8.GetByteCount(body));
        var renderer = new PreviewRendererStub((_, _) =>
            Task.FromResult(new RenderImageResult([1])));
        var context = new DefaultHttpContext();
        context.Request.Body = Body(body);
        if (knownLength)
        {
            context.Request.ContentLength = 2_048;
        }

        var result = await CreateFunction(renderer).RunAsync(
            context.Request, CancellationToken.None);

        Assert.IsType<FileContentResult>(result);
        Assert.Equal(1, renderer.CallCount);
    }

    [Theory]
    [InlineData("{\"template\":null}")]
    [InlineData("{\"template\":\"  \"}")]
    public async Task RunAsync_InvalidDraft_RejectsBeforeRender(string json)
    {
        var renderer = new PreviewRendererStub((_, _) =>
            throw new InvalidOperationException("Renderer must not be called."));
        var context = new DefaultHttpContext();
        context.Request.Body = Body(json);

        await Assert.ThrowsAsync<PreviewInputException>(() =>
            CreateFunction(renderer).RunAsync(context.Request, CancellationToken.None));

        Assert.Equal(0, renderer.CallCount);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_Canceled_PropagatesWithoutRenderProblem()
    {
        using var cancellation = new CancellationTokenSource();
        var renderer = new PreviewRendererStub((_, token) =>
        {
            cancellation.Cancel();
            return Task.FromCanceled<RenderImageResult>(token);
        });
        var context = new DefaultHttpContext();
        context.Request.Body = Body(JsonSerializer.Serialize(new { template = ValidTemplate }));

        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            CreateFunction(renderer).RunAsync(context.Request, cancellation.Token));

        Assert.Equal(cancellation.Token, failure.CancellationToken);
        Assert.Equal(1, renderer.CallCount);
    }

    [Fact]
    public void RunAsync_Trigger_UsesPostPreviewRouteAndBearerAuth()
    {
        var method = typeof(RenderPreview).GetMethod(nameof(RenderPreview.RunAsync));
        Assert.NotNull(method);
        Assert.Equal("RenderPreview", method.GetCustomAttribute<FunctionAttribute>()?.Name);
        var request = Assert.Single(method.GetParameters(),
            parameter => parameter.ParameterType == typeof(HttpRequest));
        var trigger = request.GetCustomAttribute<HttpTriggerAttribute>();
        Assert.NotNull(trigger);
        Assert.Equal("post", Assert.Single(trigger.Methods!), ignoreCase: true);
        Assert.Equal("renders/preview", trigger.Route);
        Assert.Equal(AuthorizationLevel.Anonymous, trigger.AuthLevel);
    }

    private static RenderPreview CreateFunction(IAxamlRenderer renderer) =>
        new(new RenderPreviewHandler(renderer));

    private static Stream Body(string text) =>
        new MemoryStream(Encoding.UTF8.GetBytes(text));

    private sealed class PreviewRendererStub(
        Func<ReadOnlyMemory<byte>, CancellationToken, Task<RenderImageResult>> render)
        : IAxamlRenderer
    {
        public int CallCount { get; private set; }
        public byte[]? Axaml { get; private set; }
        public CancellationToken Token { get; private set; }

        public Task<RenderImageResult> RenderAsync(
            ReadOnlyMemory<byte> axaml, CancellationToken cancellationToken)
        {
            CallCount++;
            Axaml = axaml.ToArray();
            Token = cancellationToken;
            return render(axaml, cancellationToken);
        }
    }
}
