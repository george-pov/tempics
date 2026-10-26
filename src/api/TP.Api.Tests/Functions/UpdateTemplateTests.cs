using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Templates;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class UpdateTemplateTests
{
    [Fact]
    public async Task RunAsync_ValidPayload_ReplacesOwnedTemplateWithoutResponseBody()
    {
        var id = Guid.NewGuid();
        ImageTemplate? replacement = null;
        CancellationToken observedToken = default;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (template, token) =>
            {
                replacement = template;
                observedToken = token;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("{\"name\":\"  Letter  \",\"template\":\"<Text>  hi  </Text>\"}");
        using var cancellation = new CancellationTokenSource();

        var result = await new UpdateTemplate(new UpdateTemplateHandler(repository))
            .RunAsync(context.Request, id.ToString("D"), cancellation.Token);

        Assert.IsType<NoContentResult>(result);
        Assert.NotNull(replacement);
        Assert.Equal(TemplateFunctionFixture.UserId, replacement.UserId);
        Assert.Equal(id, replacement.Id);
        Assert.Equal("Letter", replacement.Name);
        Assert.Equal("<Text>  hi  </Text>", replacement.Template);
        Assert.Equal(cancellation.Token, observedToken);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_MissingOrForeignId_ReturnsSameNotFound()
    {
        var id = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (template, _) => Task.FromResult(
                template.UserId == TemplateFunctionFixture.UserId && template.Id == id)
        };
        var function = new UpdateTemplate(new UpdateTemplateHandler(repository));
        var unknown = TemplateFunctionFixture.Http();
        unknown.Request.Body = Body("{\"name\":\"New\",\"template\":\"A\"}");
        var foreign = TemplateFunctionFixture.Http(otherUserId);
        foreign.Request.Body = Body("{\"name\":\"New\",\"template\":\"A\"}");

        var unknownResult = await function.RunAsync(
            unknown.Request, Guid.NewGuid().ToString("D"), CancellationToken.None);
        var foreignResult = await function.RunAsync(
            foreign.Request, id.ToString("D"), CancellationToken.None);

        var first = Assert.IsType<ObjectResult>(unknownResult);
        var second = Assert.IsType<ObjectResult>(foreignResult);
        Assert.Equal(StatusCodes.Status404NotFound, first.StatusCode);
        Assert.Equal(StatusCodes.Status404NotFound, second.StatusCode);
        Assert.Equal(JsonSerializer.Serialize(first.Value), JsonSerializer.Serialize(second.Value));
        Assert.Equal("no-store", unknown.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-store", foreign.Response.Headers.CacheControl.ToString());
    }

    [Theory]
    [InlineData("bad-id")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task RunAsync_InvalidId_ReturnsBadRequestWithoutWrite(string id)
    {
        var writes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (_, _) =>
            {
                writes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("{\"name\":\"X\",\"template\":\"Y\"}");

        var result = await new UpdateTemplate(new UpdateTemplateHandler(repository))
            .RunAsync(context.Request, id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, writes);
    }

    [Theory]
    [InlineData("{broken")]
    [InlineData("{\"name\":\"X\",\"template\":\"A\",\"userId\":\"evil\"}")]
    public async Task RunAsync_InvalidJson_ThrowsWithoutWrite(string json)
    {
        var writes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (_, _) =>
            {
                writes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body(json);

        await Assert.ThrowsAsync<JsonException>(() =>
            new UpdateTemplate(new UpdateTemplateHandler(repository))
                .RunAsync(context.Request, Guid.NewGuid().ToString("D"), CancellationToken.None));

        Assert.Equal(0, writes);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_NullPayload_ReturnsBadRequestWithoutWrite()
    {
        var writes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (_, _) =>
            {
                writes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("null");

        var result = await new UpdateTemplate(new UpdateTemplateHandler(repository))
            .RunAsync(context.Request, Guid.NewGuid().ToString("D"), CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, writes);
    }

    [Theory]
    [InlineData("{\"name\":\"  \",\"template\":\"A\"}", TemplateInputError.EmptyName)]
    [InlineData("{\"name\":\"X\",\"template\":\"\"}", TemplateInputError.EmptyTemplate)]
    public async Task RunAsync_InvalidFields_ThrowsWithoutWrite(string json, TemplateInputError error)
    {
        var writes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (_, _) =>
            {
                writes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body(json);

        var failure = await Assert.ThrowsAsync<TemplateInputException>(() =>
            new UpdateTemplate(new UpdateTemplateHandler(repository))
                .RunAsync(context.Request, Guid.NewGuid().ToString("D"), CancellationToken.None));

        Assert.Equal(error, failure.Error);
        Assert.Equal(0, writes);
    }

    [Fact]
    public async Task RunAsync_FieldLimits_ThrowWithoutWrite()
    {
        var writes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (_, _) =>
            {
                writes++;
                return Task.FromResult(true);
            }
        };
        var function = new UpdateTemplate(new UpdateTemplateHandler(repository));
        var longName = TemplateFunctionFixture.Http();
        longName.Request.Body = Body(JsonSerializer.Serialize(new
        {
            name = new string('n', 101),
            template = "A"
        }));
        var longTemplate = TemplateFunctionFixture.Http();
        longTemplate.Request.Body = Body(JsonSerializer.Serialize(new
        {
            name = "X",
            template = new string('x', 16_385)
        }));

        var nameFailure = await Assert.ThrowsAsync<TemplateInputException>(() =>
            function.RunAsync(longName.Request, Guid.NewGuid().ToString("D"), CancellationToken.None));
        var templateFailure = await Assert.ThrowsAsync<TemplateInputException>(() =>
            function.RunAsync(longTemplate.Request, Guid.NewGuid().ToString("D"), CancellationToken.None));

        Assert.Equal(TemplateInputError.NameTooLong, nameFailure.Error);
        Assert.Equal(TemplateInputError.TemplateTooLarge, templateFailure.Error);
        Assert.Equal(0, writes);
    }

    [Fact]
    public async Task RunAsync_ExcessiveKnownOrStreamingBody_ReturnsTooLargeWithoutWrite()
    {
        var writes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (_, _) =>
            {
                writes++;
                return Task.FromResult(true);
            }
        };
        var function = new UpdateTemplate(new UpdateTemplateHandler(repository));
        var known = TemplateFunctionFixture.Http();
        known.Request.ContentLength = 128 * 1024 + 1;
        known.Request.Body = Body("{}");
        var streaming = TemplateFunctionFixture.Http();
        streaming.Request.Body = Body(new string('x', 128 * 1024 + 1));

        var knownResult = await function.RunAsync(
            known.Request, Guid.NewGuid().ToString("D"), CancellationToken.None);
        var streamingResult = await function.RunAsync(
            streaming.Request, Guid.NewGuid().ToString("D"), CancellationToken.None);

        Assert.Equal(StatusCodes.Status413PayloadTooLarge, Assert.IsType<ObjectResult>(knownResult).StatusCode);
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, Assert.IsType<ObjectResult>(streamingResult).StatusCode);
        Assert.Equal(0, writes);
    }

    [Fact]
    public async Task RunAsync_Canceled_PropagatesBeforeWrite()
    {
        var writes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnUpdate = (_, _) =>
            {
                writes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("{\"name\":\"X\",\"template\":\"Y\"}");
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new UpdateTemplate(new UpdateTemplateHandler(repository))
                .RunAsync(context.Request, Guid.NewGuid().ToString("D"), cancellation.Token));

        Assert.Equal(0, writes);
    }

    [Fact]
    public void RunAsync_Trigger_UsesPutDetailRouteAndWorkerAuth()
    {
        var method = typeof(UpdateTemplate).GetMethod(nameof(UpdateTemplate.RunAsync));
        Assert.NotNull(method);
        Assert.Equal("UpdateTemplate", method.GetCustomAttribute<FunctionAttribute>()?.Name);
        var request = Assert.Single(method.GetParameters(), parameter => parameter.ParameterType == typeof(HttpRequest));
        var trigger = request.GetCustomAttribute<HttpTriggerAttribute>();
        Assert.NotNull(trigger);
        Assert.Equal("put", Assert.Single(trigger.Methods!), ignoreCase: true);
        Assert.Equal("templates/{id}", trigger.Route);
        Assert.Equal(AuthorizationLevel.Anonymous, trigger.AuthLevel);
    }

    private static Stream Body(string text) => new MemoryStream(Encoding.UTF8.GetBytes(text));
}
