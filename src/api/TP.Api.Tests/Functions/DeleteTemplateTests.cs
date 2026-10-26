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

public sealed class DeleteTemplateTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RunAsync_EmptyBody_DeletesOwnedTemplateWithoutResponseBody(bool knownLength)
    {
        var id = Guid.NewGuid();
        Guid observedUser = default;
        Guid observedId = default;
        CancellationToken observedToken = default;
        var repository = new TemplateRepositoryStub
        {
            OnDelete = (userId, templateId, token) =>
            {
                observedUser = userId;
                observedId = templateId;
                observedToken = token;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("");
        if (knownLength)
        {
            context.Request.ContentLength = 0;
        }

        using var cancellation = new CancellationTokenSource();
        var result = await new DeleteTemplate(new DeleteTemplateHandler(repository))
            .RunAsync(context.Request, id.ToString("D"), cancellation.Token);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(TemplateFunctionFixture.UserId, observedUser);
        Assert.Equal(id, observedId);
        Assert.Equal(cancellation.Token, observedToken);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_MissingOrForeignId_ReturnsSameNotFound()
    {
        var id = Guid.NewGuid();
        var repository = new TemplateRepositoryStub
        {
            OnDelete = (userId, templateId, _) => Task.FromResult(
                userId == TemplateFunctionFixture.UserId && templateId == id)
        };
        var function = new DeleteTemplate(new DeleteTemplateHandler(repository));
        var unknown = TemplateFunctionFixture.Http();
        unknown.Request.Body = Body("");
        var foreign = TemplateFunctionFixture.Http(Guid.NewGuid());
        foreign.Request.Body = Body("");

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
    public async Task RunAsync_InvalidId_ReturnsBadRequestWithoutDelete(string id)
    {
        var deletes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnDelete = (_, _, _) =>
            {
                deletes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("");

        var result = await new DeleteTemplate(new DeleteTemplateHandler(repository))
            .RunAsync(context.Request, id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, deletes);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RunAsync_NonemptyBody_ReturnsBadRequestWithoutDelete(bool knownLength)
    {
        var deletes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnDelete = (_, _, _) =>
            {
                deletes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("x");
        if (knownLength)
        {
            context.Request.ContentLength = 1;
        }

        var result = await new DeleteTemplate(new DeleteTemplateHandler(repository))
            .RunAsync(context.Request, Guid.NewGuid().ToString("D"), CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, deletes);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_CanceledBodyRead_PropagatesBeforeDelete()
    {
        var deletes = 0;
        var repository = new TemplateRepositoryStub
        {
            OnDelete = (_, _, _) =>
            {
                deletes++;
                return Task.FromResult(true);
            }
        };
        var context = TemplateFunctionFixture.Http();
        context.Request.Body = Body("");
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new DeleteTemplate(new DeleteTemplateHandler(repository))
                .RunAsync(context.Request, Guid.NewGuid().ToString("D"), cancellation.Token));

        Assert.Equal(0, deletes);
    }

    [Fact]
    public void RunAsync_Trigger_UsesDeleteDetailRouteAndWorkerAuth()
    {
        var method = typeof(DeleteTemplate).GetMethod(nameof(DeleteTemplate.RunAsync));
        Assert.NotNull(method);
        Assert.Equal("DeleteTemplate", method.GetCustomAttribute<FunctionAttribute>()?.Name);
        var request = Assert.Single(method.GetParameters(), parameter => parameter.ParameterType == typeof(HttpRequest));
        var trigger = request.GetCustomAttribute<HttpTriggerAttribute>();
        Assert.NotNull(trigger);
        Assert.Equal("delete", Assert.Single(trigger.Methods!), ignoreCase: true);
        Assert.Equal("templates/{id}", trigger.Route);
        Assert.Equal(AuthorizationLevel.Anonymous, trigger.AuthLevel);
    }

    private static Stream Body(string text) => new MemoryStream(Encoding.UTF8.GetBytes(text));
}
