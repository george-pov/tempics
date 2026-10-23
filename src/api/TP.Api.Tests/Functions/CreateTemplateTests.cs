using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Templates;
using TP.TableStorage.Templates;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class CreateTemplateTests
{
    [Fact]
    public async Task RunAsync_ValidPayload_CreatesOwnedTemplateAndReturnsLocation()
    {
        var repository = new TemplateRepositoryStub();
        ImageTemplate? saved = null;
        CancellationToken passedToken = default;
        repository.OnCreate = (template, token) =>
        {
            saved = template;
            passedToken = token;
            return Task.CompletedTask;
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("{\"name\":\"  Letter  \",\"template\":\"<Text>  hi  </Text>\"}");
        using var cancellation = new CancellationTokenSource();

        var result = await new CreateTemplate(new CreateTemplateHandler(repository))
            .RunAsync(context.Request, cancellation.Token);

        var created = Assert.IsType<CreatedResult>(result);
        var response = Assert.IsType<CreateTemplateResponse>(created.Value);
        Assert.NotNull(saved);
        Assert.Equal(TemplateFunctionFixture.UserId, saved.UserId);
        Assert.Equal(response.Id, saved.Id);
        Assert.NotEqual(Guid.Empty, response.Id);
        Assert.Equal("Letter", response.Name);
        Assert.Equal("<Text>  hi  </Text>", saved.Template);
        Assert.Equal($"/api/templates/{response.Id:D}", created.Location);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.Equal(cancellation.Token, passedToken);
        Assert.Equal(new[] { "id", "name" }, JsonSerializer.SerializeToElement(response)
            .EnumerateObject().Select(property => property.Name).ToArray());
    }

    [Theory]
    [InlineData("{not-json")]
    [InlineData("{\"name\":\"X\",\"template\":\"A\",\"userId\":\"evil\"}")]
    public async Task RunAsync_InvalidJson_ThrowsWithoutWrite(string json)
    {
        var repository = new TemplateRepositoryStub();
        var writes = 0;
        repository.OnCreate = (_, _) =>
        {
            writes++;
            return Task.CompletedTask;
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body(json);

        await Assert.ThrowsAsync<JsonException>(() =>
            new CreateTemplate(new CreateTemplateHandler(repository))
                .RunAsync(context.Request, CancellationToken.None));

        Assert.Equal(0, writes);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_NullPayload_ReturnsBadRequestWithoutWrite()
    {
        var repository = new TemplateRepositoryStub();
        var writes = 0;
        repository.OnCreate = (_, _) =>
        {
            writes++;
            return Task.CompletedTask;
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("null");

        var result = await new CreateTemplate(new CreateTemplateHandler(repository))
            .RunAsync(context.Request, CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, writes);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Theory]
    [InlineData("{\"name\":\"  \",\"template\":\"A\"}", TemplateInputError.EmptyName)]
    [InlineData("{\"name\":\"X\",\"template\":\"\"}", TemplateInputError.EmptyTemplate)]
    public async Task RunAsync_InvalidTemplate_ThrowsWithoutWrite(string json, TemplateInputError expectedError)
    {
        var repository = new TemplateRepositoryStub();
        var writes = 0;
        repository.OnCreate = (_, _) =>
        {
            writes++;
            return Task.CompletedTask;
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body(json);

        var failure = await Assert.ThrowsAsync<TemplateInputException>(() =>
            new CreateTemplate(new CreateTemplateHandler(repository))
                .RunAsync(context.Request, CancellationToken.None));

        Assert.Equal(expectedError, failure.Error);
        Assert.Equal(0, writes);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_ExcessivePayload_RejectsWithoutWrite()
    {
        var repository = new TemplateRepositoryStub();
        var writes = 0;
        repository.OnCreate = (_, _) =>
        {
            writes++;
            return Task.CompletedTask;
        };
        var function = new CreateTemplate(new CreateTemplateHandler(repository));
        var longTemplateContext = TemplateFunctionFixture.Http();
        longTemplateContext.Request.Body = Body(JsonSerializer.Serialize(new
        {
            name = "Large",
            template = new string('x', 16_385)
        }));
        var longBodyContext = TemplateFunctionFixture.Http();
        longBodyContext.Request.Body = Body(new string('x', 128 * 1024 + 1));

        var first = await Assert.ThrowsAsync<TemplateInputException>(() =>
            function.RunAsync(longTemplateContext.Request, CancellationToken.None));
        var second = await function.RunAsync(longBodyContext.Request, CancellationToken.None);

        Assert.Equal(TemplateInputError.TemplateTooLarge, first.Error);
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, Assert.IsType<ObjectResult>(second).StatusCode);
        Assert.Equal(0, writes);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RunAsync_StorageFailure_PropagatesToMiddleware(bool unavailable)
    {
        const string privateText = "secret template provider payload";
        var repository = new TemplateRepositoryStub
        {
            OnCreate = (_, _) => unavailable
                ? Task.FromException(new TemplateUnavailableException())
                : Task.FromException(new InvalidOperationException(privateText))
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("{\"name\":\"X\",\"template\":\"secret template\"}");

        if (unavailable)
        {
            await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
                new CreateTemplate(new CreateTemplateHandler(repository))
                    .RunAsync(context.Request, CancellationToken.None));
        }
        else
        {
            var failure = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new CreateTemplate(new CreateTemplateHandler(repository))
                    .RunAsync(context.Request, CancellationToken.None));
            Assert.Equal(privateText, failure.Message);
        }

        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_Canceled_PropagatesCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var repository = new TemplateRepositoryStub
        {
            OnCreate = (_, token) => Task.FromCanceled(token)
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("{\"name\":\"X\",\"template\":\"Y\"}");
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new CreateTemplate(new CreateTemplateHandler(repository))
                .RunAsync(context.Request, cancellation.Token));
    }

    [Fact]
    public void RunAsync_Trigger_UsesPostTemplatesRouteAndWorkerAuth()
    {
        var method = typeof(CreateTemplate).GetMethod(nameof(CreateTemplate.RunAsync));
        Assert.NotNull(method);
        Assert.Equal("CreateTemplate", method.GetCustomAttribute<FunctionAttribute>()?.Name);
        var request = Assert.Single(method.GetParameters(), parameter => parameter.ParameterType == typeof(HttpRequest));
        var trigger = request.GetCustomAttribute<HttpTriggerAttribute>();
        Assert.NotNull(trigger);
        Assert.Equal("post", Assert.Single(trigger.Methods!), ignoreCase: true);
        Assert.Equal("templates", trigger.Route);
        Assert.Equal(AuthorizationLevel.Anonymous, trigger.AuthLevel);
    }

    private static Stream Body(string text) => new MemoryStream(Encoding.UTF8.GetBytes(text));
}
