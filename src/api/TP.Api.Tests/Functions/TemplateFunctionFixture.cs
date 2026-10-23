using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using TP.Application.Templates;

namespace TP.Api.Tests.Functions;

internal static class TemplateFunctionFixture
{
    public static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    public static DefaultHttpContext Http(Guid? userId = null)
    {
        var context = new DefaultHttpContext { TraceIdentifier = "template-correlation" };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("oid", (userId ?? UserId).ToString("D"))], "fixture"));
        return context;
    }
}

internal sealed class TemplateRepositoryStub : ITemplateRepository
{
    public Func<ImageTemplate, CancellationToken, Task> OnCreate { get; set; } =
        (_, _) => Task.CompletedTask;

    public Func<Guid, CancellationToken, Task<IReadOnlyList<TemplateSummary>>> OnList { get; set; } =
        (_, _) => Task.FromResult<IReadOnlyList<TemplateSummary>>([]);

    public Func<Guid, Guid, CancellationToken, Task<ImageTemplate?>> OnFind { get; set; } =
        (_, _, _) => Task.FromResult<ImageTemplate?>(null);

    public Task CreateAsync(ImageTemplate template, CancellationToken cancellationToken) =>
        OnCreate(template, cancellationToken);

    public Task<IReadOnlyList<TemplateSummary>> ListAsync(
        Guid userId, CancellationToken cancellationToken) =>
        OnList(userId, cancellationToken);

    public Task<ImageTemplate?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        OnFind(userId, id, cancellationToken);
}
