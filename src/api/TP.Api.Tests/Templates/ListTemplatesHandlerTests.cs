using TP.Application.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class ListTemplatesHandlerTests
{
    [Fact]
    public async Task HandleAsync_EmptyList_ReturnsNoItems()
    {
        var userId = Guid.NewGuid();
        var repository = new RepositoryStub((_, _) => []);
        var handler = new ListTemplatesHandler(repository);

        var result = await handler.HandleAsync(
            new ListTemplatesQuery(userId),
            CancellationToken.None);

        Assert.Empty(result.Items);
        Assert.Equal(userId, repository.UserId);
        Assert.Equal(1, repository.ListCalls);
    }

    [Fact]
    public async Task HandleAsync_MoreThanOneThousandItems_ReturnsAllMetadata()
    {
        var userId = Guid.NewGuid();
        var expected = Enumerable.Range(1, 1_001)
            .Select(index => new TemplateSummary(Guid.NewGuid(), $"Name {index}"))
            .ToArray();
        var repository = new RepositoryStub((_, _) => expected);

        var result = await new ListTemplatesHandler(repository).HandleAsync(
            new ListTemplatesQuery(userId), CancellationToken.None);

        Assert.Equal(expected, result.Items);
        Assert.Equal(1_001, result.Items.Count);
        Assert.Equal(userId, repository.UserId);
        Assert.Equal(1, repository.ListCalls);
    }

    [Fact]
    public async Task HandleAsync_EmptyUserId_RejectsWithoutQuery()
    {
        var repository = new RepositoryStub((_, _) => []);
        var handler = new ListTemplatesHandler(repository);

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            handler.HandleAsync(new ListTemplatesQuery(Guid.Empty),
                CancellationToken.None));

        Assert.Equal(TemplateInputError.InvalidUserId, error.Error);
        Assert.Equal(0, repository.ListCalls);
    }

    [Fact]
    public async Task HandleAsync_InvalidMetadata_FailsClosed()
    {
        var repository = new RepositoryStub((_, _) =>
            [new TemplateSummary(Guid.Empty, "Name")]);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new ListTemplatesHandler(repository).HandleAsync(
                new ListTemplatesQuery(Guid.NewGuid()), CancellationToken.None));
    }

    [Fact]
    public async Task HandleAsync_CanceledRequest_DoesNotQuery()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var repository = new RepositoryStub((_, _) => []);
        var handler = new ListTemplatesHandler(repository);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.HandleAsync(new ListTemplatesQuery(Guid.NewGuid()),
                cancellation.Token));

        Assert.Equal(0, repository.ListCalls);
    }

    [Fact]
    public async Task HandleAsync_ActiveRequest_PassesCancellationToRepository()
    {
        using var cancellation = new CancellationTokenSource();
        var repository = new RepositoryStub((_, _) => []);

        await new ListTemplatesHandler(repository).HandleAsync(
            new ListTemplatesQuery(Guid.NewGuid()), cancellation.Token);

        Assert.Equal(cancellation.Token, repository.Token);
    }

    private sealed class RepositoryStub(
        Func<Guid, CancellationToken, IReadOnlyList<TemplateSummary>> list) : ITemplateRepository
    {
        public int ListCalls { get; private set; }

        public Guid UserId { get; private set; }

        public CancellationToken Token { get; private set; }

        public Task CreateAsync(
            ImageTemplate template,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<IReadOnlyList<TemplateSummary>> ListAsync(
            Guid userId,
            CancellationToken cancellationToken)
        {
            ListCalls++;
            UserId = userId;
            Token = cancellationToken;
            return Task.FromResult(list(userId, cancellationToken));
        }

        public Task<ImageTemplate?> FindAsync(
            Guid userId,
            Guid id,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
