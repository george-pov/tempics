using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging.Abstractions;
using TP.Application.Rendering;
using TP.AzureFunctions.Rendering;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class RenderSampleTests
{
    [Fact]
    public async Task RunAsync_RenderSucceeds_ReturnsPngResponse()
    {
        byte[] png = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3];
        var renderer = new RendererStub(_ => Task.FromResult(new RenderImageResult(png)));
        var function = CreateFunction(renderer);
        var context = new DefaultHttpContext();
        using var cancellation = new CancellationTokenSource();

        var result = await function.RunAsync(context.Request, cancellation.Token);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.Equal("image/png", file.ContentType);
        Assert.Equal(png, file.FileContents);
        Assert.True(string.IsNullOrEmpty(file.FileDownloadName));
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.False(context.Response.Headers.ContainsKey("Content-Disposition"));
        Assert.Equal(cancellation.Token, renderer.Token);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RunAsync_RenderFails_ReturnsSafeProblem(bool applicationFailure)
    {
        const string privateMessage = "private-path AXAML-content PNG-content configuration-value";
        const string headerValue = "private-request-header";
        var cause = new InvalidOperationException(privateMessage);
        Exception failure = applicationFailure ? new RenderImageException(cause) : cause;
        var renderer = new RendererStub(_ => Task.FromException<RenderImageResult>(failure));
        var function = CreateFunction(renderer);
        var context = new DefaultHttpContext { TraceIdentifier = "sample-correlation" };
        context.Request.Headers["X-Test-Private"] = headerValue;

        var result = await function.RunAsync(context.Request, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", Assert.Single(response.ContentTypes));
        var problem = Assert.IsType<ProblemDetails>(response.Value);
        Assert.Equal(StatusCodes.Status500InternalServerError, problem.Status);
        Assert.Equal("Image rendering failed", problem.Title);
        Assert.Equal("render_failed", problem.Extensions["code"]);
        Assert.Equal(context.TraceIdentifier, problem.Extensions["correlationId"]);
        Assert.Equal(2, problem.Extensions.Count);
        Assert.Null(problem.Detail);
        Assert.Null(problem.Instance);
        var json = JsonSerializer.Serialize(problem);
        Assert.DoesNotContain(privateMessage, json);
        Assert.DoesNotContain(headerValue, json);
        Assert.DoesNotContain(nameof(InvalidOperationException), json);
        Assert.DoesNotContain(nameof(RenderImageException), json);
        Assert.DoesNotContain("stack", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RunAsync_RequestCanceled_DoesNotMapRenderFailure()
    {
        using var cancellation = new CancellationTokenSource();
        var renderer = new RendererStub(token =>
        {
            cancellation.Cancel();
            return Task.FromCanceled<RenderImageResult>(token);
        });
        var function = CreateFunction(renderer);
        var context = new DefaultHttpContext();

        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            function.RunAsync(context.Request, cancellation.Token));

        Assert.Equal(cancellation.Token, failure.CancellationToken);
        Assert.Equal(cancellation.Token, renderer.Token);
    }

    [Fact]
    public void RunAsync_Trigger_UsesPostSampleRouteAndWorkerAuth()
    {
        var method = typeof(RenderSample).GetMethod(nameof(RenderSample.RunAsync));
        Assert.NotNull(method);
        var function = method.GetCustomAttribute<FunctionAttribute>();
        Assert.NotNull(function);
        Assert.Equal("RenderSample", function.Name);
        var request = Assert.Single(method.GetParameters(), parameter => parameter.ParameterType == typeof(HttpRequest));
        var trigger = request.GetCustomAttribute<HttpTriggerAttribute>();
        Assert.NotNull(trigger);
        var methods = trigger.Methods;
        Assert.NotNull(methods);
        Assert.Equal("post", Assert.Single(methods), ignoreCase: true);
        Assert.Equal("renders/sample", trigger.Route);
        Assert.Equal(AuthorizationLevel.Anonymous, trigger.AuthLevel);
    }

    private static RenderSample CreateFunction(IAxamlRenderer renderer)
    {
        var handler = new RenderSampleHandler(new TemplateStub(), renderer);
        return new RenderSample(handler, NullLogger<RenderSample>.Instance);
    }

    private sealed class TemplateStub : IBundledTemplateSource
    {
        public ValueTask<ReadOnlyMemory<byte>> LoadAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult<ReadOnlyMemory<byte>>("trusted sample"u8.ToArray());
    }

    private sealed class RendererStub(
        Func<CancellationToken, Task<RenderImageResult>> render) : IAxamlRenderer
    {
        public CancellationToken Token { get; private set; }

        public Task<RenderImageResult> RenderAsync(
            ReadOnlyMemory<byte> axaml,
            CancellationToken cancellationToken)
        {
            Token = cancellationToken;
            return render(cancellationToken);
        }
    }
}
