using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Templates;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class ListTemplatesTests
{
    [Fact]
    public async Task RunAsync_LargeOwnedList_ReturnsAllMetadataInOneResponse()
    {
        var items = Enumerable.Range(1, 1_001)
            .Select(index => new TemplateSummary(Guid.NewGuid(), $"Name {index}"))
            .ToArray();
        var repository = new TemplateRepositoryStub
        {
            OnList = (_, _) => Task.FromResult<IReadOnlyList<TemplateSummary>>(items)
        };
        var context = TemplateFunctionFixture.Http();

        var result = await new ListTemplates(new ListTemplatesHandler(repository))
            .RunAsync(context.Request, CancellationToken.None);

        var response = Assert.IsType<ListTemplatesResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal(items.Select(item => new TemplateSummaryResponse(item.Id, item.Name)),
            response.Items);
    }

    [Fact]
    public async Task RunAsync_UsesAuthenticatedUserAndCancellation()
    {
        (Guid UserId, CancellationToken Token) observed = default;
        var repository = new TemplateRepositoryStub
        {
            OnList = (userId, token) =>
            {
                observed = (userId, token);
                return Task.FromResult<IReadOnlyList<TemplateSummary>>([]);
            }
        };
        var context = TemplateFunctionFixture.Http();
        using var cancellation = new CancellationTokenSource();

        await new ListTemplates(new ListTemplatesHandler(repository))
            .RunAsync(context.Request, cancellation.Token);

        Assert.Equal((TemplateFunctionFixture.UserId, cancellation.Token), observed);
    }

    [Fact]
    public async Task RunAsync_Success_DisablesCaching()
    {
        var context = TemplateFunctionFixture.Http();

        await new ListTemplates(new ListTemplatesHandler(new TemplateRepositoryStub()))
            .RunAsync(context.Request, CancellationToken.None);

        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task RunAsync_OwnedList_SerializesOnlyMetadata()
    {
        var repository = new TemplateRepositoryStub
        {
            OnList = (_, _) => Task.FromResult<IReadOnlyList<TemplateSummary>>(
                [new TemplateSummary(Guid.NewGuid(), "Name")])
        };
        var context = TemplateFunctionFixture.Http();

        var result = await new ListTemplates(new ListTemplatesHandler(repository))
            .RunAsync(context.Request, CancellationToken.None);

        var response = Assert.IsType<ListTemplatesResponse>(Assert.IsType<OkObjectResult>(result).Value);
        var json = JsonSerializer.SerializeToElement(response);
        Assert.Equal(["items"], json.EnumerateObject().Select(property => property.Name));
        var item = Assert.Single(json.GetProperty("items").EnumerateArray());
        string[] expected = ["id", "name"];
        Assert.Equal(expected.Order(StringComparer.Ordinal),
            item.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task RunAsync_EmptyList_SerializesEmptyItems()
    {
        var context = TemplateFunctionFixture.Http();

        var result = await new ListTemplates(new ListTemplatesHandler(new TemplateRepositoryStub()))
            .RunAsync(context.Request, CancellationToken.None);

        var response = Assert.IsType<ListTemplatesResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal("{\"items\":[]}", JsonSerializer.Serialize(response));
    }

    [Fact]
    public async Task RunAsync_ProviderFailure_PropagatesToMiddleware()
    {
        const string privateText = "connection-key secret template";
        var repository = new TemplateRepositoryStub
        {
            OnList = (_, _) => Task.FromException<IReadOnlyList<TemplateSummary>>(
                new InvalidOperationException(privateText))
        };
        var context = TemplateFunctionFixture.Http();

        var failure = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new ListTemplates(new ListTemplatesHandler(repository))
                .RunAsync(context.Request, CancellationToken.None));

        Assert.Equal(privateText, failure.Message);
    }

    [Fact]
    public async Task RunAsync_Canceled_PropagatesCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var context = TemplateFunctionFixture.Http();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new ListTemplates(new ListTemplatesHandler(new TemplateRepositoryStub()))
                .RunAsync(context.Request, cancellation.Token));
    }

    [Fact]
    public void RunAsync_Trigger_UsesGetTemplatesRouteAndWorkerAuth()
    {
        var method = typeof(ListTemplates).GetMethod(nameof(ListTemplates.RunAsync));
        Assert.NotNull(method);
        Assert.Equal("ListTemplates", method.GetCustomAttribute<FunctionAttribute>()?.Name);
        var request = Assert.Single(method.GetParameters(), parameter => parameter.ParameterType == typeof(HttpRequest));
        var trigger = request.GetCustomAttribute<HttpTriggerAttribute>();
        Assert.NotNull(trigger);
        Assert.Equal("get", Assert.Single(trigger.Methods!), ignoreCase: true);
        Assert.Equal("templates", trigger.Route);
        Assert.Equal(AuthorizationLevel.Anonymous, trigger.AuthLevel);
    }
}
