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
        var repository = new TemplateRepositoryStub();
        Guid observedUser = default;
        CancellationToken observedToken = default;
        repository.OnList = (userId, token) =>
        {
            observedUser = userId;
            observedToken = token;
            return Task.FromResult<IReadOnlyList<TemplateSummary>>(items);
        };
        var context = TemplateFunctionFixture.Http();
        using var cancellation = new CancellationTokenSource();

        var result = await new ListTemplates(new ListTemplatesHandler(repository))
            .RunAsync(context.Request, cancellation.Token);

        var response = Assert.IsType<ListTemplatesResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal(TemplateFunctionFixture.UserId, observedUser);
        Assert.Equal(cancellation.Token, observedToken);
        Assert.Equal(1_001, response.Items.Count);
        Assert.Equal(items.Select(item => item.Id), response.Items.Select(item => item.Id));
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
        var json = JsonSerializer.Serialize(response);
        Assert.Contains("\"items\"", json);
        Assert.DoesNotContain("\"template\"", json);
        Assert.DoesNotContain("nextToken", json);
    }

    [Fact]
    public async Task RunAsync_EmptyList_ReturnsEmptyItems()
    {
        var context = TemplateFunctionFixture.Http();

        var result = await new ListTemplates(new ListTemplatesHandler(new TemplateRepositoryStub()))
            .RunAsync(context.Request, CancellationToken.None);

        var response = Assert.IsType<ListTemplatesResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Empty(response.Items);
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
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
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
