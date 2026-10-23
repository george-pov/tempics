using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using TP.Application.Templates;
using TP.AzureFunctions.Templates;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class GetTemplateTests
{
    [Fact]
    public async Task RunAsync_OwnedTemplate_ReturnsExactText()
    {
        var id = Guid.NewGuid();
        const string exactText = "<TextBlock>  Hello  </TextBlock>\r\n";
        var repository = new TemplateRepositoryStub
        {
            OnFind = (userId, templateId, _) =>
            {
                Assert.Equal(TemplateFunctionFixture.UserId, userId);
                Assert.Equal(id, templateId);
                return Task.FromResult<ImageTemplate?>(new ImageTemplate(userId, id, "Name", exactText));
            }
        };
        var context = TemplateFunctionFixture.Http();

        var result = await new GetTemplate(new FindTemplateHandler(repository))
            .RunAsync(context.Request, id.ToString("D"), CancellationToken.None);

        var response = Assert.IsType<GetTemplateResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal(id, response.Id);
        Assert.Equal("Name", response.Name);
        Assert.Equal(exactText, response.Template);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.Equal(new[] { "id", "name", "template" }, JsonSerializer.SerializeToElement(response)
            .EnumerateObject().Select(property => property.Name).ToArray());
    }

    [Fact]
    public async Task RunAsync_UnknownOrOtherUserId_ReturnsSameNotFound()
    {
        var id = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var repository = new TemplateRepositoryStub
        {
            OnFind = (userId, templateId, _) => Task.FromResult<ImageTemplate?>(
                userId == TemplateFunctionFixture.UserId && templateId == id
                    ? new ImageTemplate(userId, id, "Private", "secret text")
                    : null)
        };
        var function = new GetTemplate(new FindTemplateHandler(repository));
        var ownContext = TemplateFunctionFixture.Http();
        var otherContext = TemplateFunctionFixture.Http(otherUserId);
        var unknown = await function.RunAsync(ownContext.Request, Guid.NewGuid().ToString("D"), CancellationToken.None);
        var other = await function.RunAsync(otherContext.Request, id.ToString("D"), CancellationToken.None);

        // Both absent paths use the same safe problem contract.
        var unknownResult = Assert.IsType<ObjectResult>(unknown);
        var otherResult = Assert.IsType<ObjectResult>(other);
        Assert.Equal(StatusCodes.Status404NotFound, unknownResult.StatusCode);
        Assert.Equal(StatusCodes.Status404NotFound, otherResult.StatusCode);
        Assert.Equal(JsonSerializer.Serialize(unknownResult.Value), JsonSerializer.Serialize(otherResult.Value));
        Assert.DoesNotContain("secret text", JsonSerializer.Serialize(unknownResult.Value));
    }

    [Theory]
    [InlineData("bad-id")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task RunAsync_InvalidId_ReturnsBadRequestWithoutLookup(string id)
    {
        var repository = new TemplateRepositoryStub();
        var lookups = 0;
        repository.OnFind = (_, _, _) =>
        {
            lookups++;
            return Task.FromResult<ImageTemplate?>(null);
        };
        var context = TemplateFunctionFixture.Http();

        var result = await new GetTemplate(new FindTemplateHandler(repository))
            .RunAsync(context.Request, id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal(0, lookups);
    }

    [Fact]
    public async Task RunAsync_ProviderFailure_PropagatesToMiddleware()
    {
        const string privateText = "private provider content";
        var repository = new TemplateRepositoryStub
        {
            OnFind = (_, _, _) => Task.FromException<ImageTemplate?>(
                new InvalidOperationException(privateText))
        };
        var context = TemplateFunctionFixture.Http();

        var failure = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new GetTemplate(new FindTemplateHandler(repository))
                .RunAsync(context.Request, Guid.NewGuid().ToString("D"), CancellationToken.None));

        Assert.Equal(privateText, failure.Message);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public void RunAsync_Trigger_UsesGetDetailRouteAndWorkerAuth()
    {
        var method = typeof(GetTemplate).GetMethod(nameof(GetTemplate.RunAsync));
        Assert.NotNull(method);
        Assert.Equal("GetTemplate", method.GetCustomAttribute<FunctionAttribute>()?.Name);
        var request = Assert.Single(method.GetParameters(), parameter => parameter.ParameterType == typeof(HttpRequest));
        var trigger = request.GetCustomAttribute<HttpTriggerAttribute>();
        Assert.NotNull(trigger);
        Assert.Equal("get", Assert.Single(trigger.Methods!), ignoreCase: true);
        Assert.Equal("templates/{id}", trigger.Route);
        Assert.Equal(AuthorizationLevel.Anonymous, trigger.AuthLevel);
    }
}
