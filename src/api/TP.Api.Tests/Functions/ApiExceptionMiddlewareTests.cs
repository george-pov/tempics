using System.Collections;
using System.Collections.Immutable;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging.Abstractions;
using TP.Application.Rendering;
using TP.Application.Templates;
using TP.AzureFunctions.Errors;
using TP.AzureFunctions.Rendering;
using TP.AzureFunctions.Templates;
using TP.TableStorage.Templates;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class ApiExceptionMiddlewareTests
{
    private const string PrivateText = "private-template-token-provider-path";

    [Fact]
    public async Task Invoke_CreateTemplateInvalidJson_ReturnsSafeBadRequest()
    {
        var http = TemplateFunctionFixture.Http();
        http.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{broken"));
        var context = new HttpFunctionContext(http, "CreateTemplate");
        var function = new CreateTemplate(new CreateTemplateHandler(new TemplateRepositoryStub()));

        await Middleware().Invoke(context, _ => function.RunAsync(http.Request, CancellationToken.None));

        AssertProblem(context, http, StatusCodes.Status400BadRequest,
            "Invalid template request", "template_invalid");
    }

    [Fact]
    public async Task Invoke_ListTemplatesProviderFailure_ReturnsSafeServerProblem()
    {
        var repository = new TemplateRepositoryStub
        {
            OnList = (_, _) => Task.FromException<IReadOnlyList<TemplateSummary>>(
                new InvalidOperationException(PrivateText))
        };
        var http = TemplateFunctionFixture.Http();
        var context = new HttpFunctionContext(http, "ListTemplates");
        var function = new ListTemplates(new ListTemplatesHandler(repository));

        await Middleware().Invoke(context, _ => function.RunAsync(http.Request, CancellationToken.None));

        AssertProblem(context, http, StatusCodes.Status500InternalServerError,
            "Template operation failed", "template_failed");
    }

    [Fact]
    public async Task Invoke_RenderSampleFailure_RetainsRenderProblem()
    {
        var http = new DefaultHttpContext { TraceIdentifier = "render-correlation" };
        var context = new HttpFunctionContext(http, "RenderSample");
        var handler = new RenderSampleHandler(new FailingSource(), new UnusedRenderer());
        var function = new RenderSample(handler, NullLogger<RenderSample>.Instance);

        await Middleware().Invoke(context, _ => function.RunAsync(http.Request, CancellationToken.None));

        AssertProblem(context, http, StatusCodes.Status500InternalServerError,
            "Image rendering failed", "render_failed");
    }

    [Fact]
    public void FromException_TemplateErrors_MapToCurrentContract()
    {
        var request = TemplateFunctionFixture.Http().Request;
        var cases = new (string Function, Exception Error, int Status, string Code)[]
        {
            ("CreateTemplate", new TemplateInputException(TemplateInputError.TemplateTooLarge), 413, "template_too_large"),
            ("CreateTemplate", new TemplateInputException(TemplateInputError.EmptyName), 400, "template_invalid"),
            ("GetTemplate", new UnauthorizedAccessException(PrivateText), 401, "unauthorized"),
            ("ListTemplates", new TemplateUnavailableException(), 503, "template_unavailable"),
            ("ListTemplates", new JsonException(PrivateText), 500, "template_failed"),
            ("FutureFunction", new TemplateUnavailableException(), 500, "api_failed"),
            ("RenderSample", new TemplateUnavailableException(), 500, "render_failed")
        };

        foreach (var item in cases)
        {
            var result = ApiErrorResults.FromException(request, item.Error, item.Function);
            var problem = Assert.IsType<ProblemDetails>(result.Value);
            Assert.Equal(item.Status, result.StatusCode);
            Assert.Equal(item.Code, problem.Extensions["code"]);
            Assert.Equal(request.HttpContext.TraceIdentifier, problem.Extensions["correlationId"]);
            Assert.DoesNotContain(PrivateText, JsonSerializer.Serialize(problem));
        }
    }

    [Fact]
    public async Task Invoke_Cancellation_PropagatesWithoutProblem()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var http = TemplateFunctionFixture.Http();
        var context = new HttpFunctionContext(http, "ListTemplates");

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            Middleware().Invoke(context, _ => Task.FromCanceled(cancellation.Token)));

        Assert.Null(context.GetInvocationResult().Value);
    }

    [Fact]
    public async Task Invoke_NonHttpInvocation_PassesThrough()
    {
        var context = new HttpFunctionContext(null, "OtherFunction");
        var invoked = false;

        await Middleware().Invoke(context, _ =>
        {
            invoked = true;
            return Task.CompletedTask;
        });

        Assert.True(invoked);
    }

    [Fact]
    public async Task Invoke_MissingHttpContext_PropagatesFailure()
    {
        var context = new HttpFunctionContext(null, "ListTemplates");
        var failure = new InvalidOperationException(PrivateText);

        var observed = await Record.ExceptionAsync(() =>
            Middleware().Invoke(context, _ => Task.FromException(failure)));

        Assert.Same(failure, observed);
    }

    [Fact]
    public async Task Invoke_StartedResponse_PropagatesFailure()
    {
        var http = TemplateFunctionFixture.Http();
        http.Features.Set<IHttpResponseFeature>(new StartedResponseFeature());
        var context = new HttpFunctionContext(http, "ListTemplates");
        var failure = new InvalidOperationException(PrivateText);
        Assert.True(http.Response.HasStarted);

        var observed = await Record.ExceptionAsync(() =>
            Middleware().Invoke(context, _ => Task.FromException(failure)));

        Assert.Same(failure, observed);
        Assert.Null(context.GetInvocationResult().Value);
    }

    private static ApiExceptionMiddleware Middleware() =>
        new(NullLogger<ApiExceptionMiddleware>.Instance);

    private static void AssertProblem(
        HttpFunctionContext context, HttpContext http, int status, string title, string code)
    {
        var result = Assert.IsType<ObjectResult>(context.GetInvocationResult().Value);
        var problem = Assert.IsType<ProblemDetails>(result.Value);
        Assert.Equal(status, result.StatusCode);
        Assert.Equal(status, problem.Status);
        Assert.Equal(title, problem.Title);
        Assert.Equal(code, problem.Extensions["code"]);
        Assert.Equal(http.TraceIdentifier, problem.Extensions["correlationId"]);
        Assert.Equal("application/problem+json", Assert.Single(result.ContentTypes));
        Assert.Equal("no-store", http.Response.Headers.CacheControl.ToString());
        Assert.DoesNotContain(PrivateText, JsonSerializer.Serialize(problem));
    }

    private sealed class FailingSource : IBundledTemplateSource
    {
        public ValueTask<ReadOnlyMemory<byte>> LoadAsync(CancellationToken cancellationToken) =>
            ValueTask.FromException<ReadOnlyMemory<byte>>(new InvalidOperationException(PrivateText));
    }

    private sealed class UnusedRenderer : IAxamlRenderer
    {
        public Task<RenderImageResult> RenderAsync(
            ReadOnlyMemory<byte> axaml, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("Renderer should not be called.");
    }

    private sealed class StartedResponseFeature : HttpResponseFeature
    {
        public override bool HasStarted => true;
    }

    private sealed class HttpFunctionContext : FunctionContext
    {
        private readonly FunctionDefinition _definition;
        private readonly TestFeatures _features = new();

        public HttpFunctionContext(HttpContext? http, string functionName)
        {
            _definition = new TestDefinition(functionName);
            if (http is not null)
            {
                Items["HttpRequestContext"] = http;
                var featureType = typeof(FunctionContext).Assembly.GetType(
                    "Microsoft.Azure.Functions.Worker.Context.Features.IFunctionBindingsFeature", true)!;
                var bindings = DispatchProxy.Create(featureType, typeof(BindingsProxy));
                _features.Set(featureType, bindings);
            }
        }

        public override string InvocationId => "test-invocation";
        public override string FunctionId => "test-function";
        public override TraceContext TraceContext => throw new NotSupportedException();
        public override BindingContext BindingContext => throw new NotSupportedException();
        public override RetryContext RetryContext => throw new NotSupportedException();
        public override IServiceProvider InstanceServices { get; set; } = null!;
        public override FunctionDefinition FunctionDefinition => _definition;
        public override IDictionary<object, object> Items { get; set; } = new Dictionary<object, object>();
        public override IInvocationFeatures Features => _features;
    }

    private sealed class TestFeatures : IInvocationFeatures
    {
        private readonly Dictionary<Type, object> _features = [];

        public void Set<T>(T instance) => _features[typeof(T)] = instance!;

        public T? Get<T>() => _features.TryGetValue(typeof(T), out var feature)
            ? (T)feature : default;

        public void Set(Type type, object instance) => _features[type] = instance;

        public IEnumerator<KeyValuePair<Type, object>> GetEnumerator() => _features.GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    public class BindingsProxy : DispatchProxy
    {
        private object? _result;

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) =>
            targetMethod?.Name switch
            {
                "get_InvocationResult" => _result,
                "set_InvocationResult" => SetResult(args),
                _ => throw new NotSupportedException(targetMethod?.Name)
            };

        private object? SetResult(object?[]? args)
        {
            _result = args?[0];
            return null;
        }
    }

    private sealed class TestDefinition(string name) : FunctionDefinition
    {
        public override ImmutableArray<FunctionParameter> Parameters => [];
        public override string PathToAssembly => "test";
        public override string EntryPoint => "test";
        public override string Id => "test-id";
        public override string Name => name;
        public override IImmutableDictionary<string, BindingMetadata> InputBindings =>
            ImmutableDictionary<string, BindingMetadata>.Empty;
        public override IImmutableDictionary<string, BindingMetadata> OutputBindings =>
            ImmutableDictionary<string, BindingMetadata>.Empty;
    }
}
