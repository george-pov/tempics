using TP.Application.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class FindTemplateHandlerTests
{
    [Fact]
    public async Task HandleAsync_OwnTemplate_ReturnsExactText()
    {
        var userId = Guid.NewGuid();
        var id = Guid.NewGuid();
        const string text = "<Border>\r\n  own text \r\n</Border>";
        var template = new ImageTemplate(userId, id, "Name", text);
        var repository = new RepositoryStub((_, _) => template);
        using var cancellation = new CancellationTokenSource();

        var result = await new FindTemplateHandler(repository).HandleAsync(
            new FindTemplateQuery(userId, id), cancellation.Token);

        Assert.Same(template, result);
        Assert.Equal(text, result!.Template);
        Assert.Equal(userId, repository.UserId);
        Assert.Equal(id, repository.Id);
        Assert.Equal(cancellation.Token, repository.Token);
        Assert.Equal(1, repository.FindCalls);
    }

    [Fact]
    public async Task HandleAsync_AbsentAndOtherUser_ReturnSameAbsence()
    {
        var ownerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var storedId = Guid.NewGuid();
        var absentId = Guid.NewGuid();
        var stored = new ImageTemplate(ownerId, storedId, "Secret", "private text");
        var repository = new RepositoryStub((userId, id) =>
            userId == ownerId && id == storedId ? stored : null);
        var handler = new FindTemplateHandler(repository);

        var otherResult = await handler.HandleAsync(
            new FindTemplateQuery(otherId, storedId), CancellationToken.None);
        var absentResult = await handler.HandleAsync(
            new FindTemplateQuery(otherId, absentId), CancellationToken.None);

        Assert.Null(otherResult);
        Assert.Null(absentResult);
        Assert.Equal(2, repository.FindCalls);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task HandleAsync_EmptyGuid_RejectsBeforeLookup(bool emptyUser)
    {
        var repository = new RepositoryStub((_, _) => null);
        var handler = new FindTemplateHandler(repository);

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            handler.HandleAsync(new FindTemplateQuery(
                emptyUser ? Guid.Empty : Guid.NewGuid(),
                emptyUser ? Guid.NewGuid() : Guid.Empty), CancellationToken.None));

        Assert.Equal(emptyUser ? TemplateInputError.InvalidUserId : TemplateInputError.InvalidId,
            error.Error);
        Assert.Equal(0, repository.FindCalls);
    }

    [Fact]
    public async Task HandleAsync_MismatchedOwner_FailsClosed()
    {
        var requestedUserId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var repository = new RepositoryStub((_, _) =>
            new ImageTemplate(Guid.NewGuid(), id, "Other", "private text"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new FindTemplateHandler(repository).HandleAsync(
                new FindTemplateQuery(requestedUserId, id), CancellationToken.None));
    }

    [Fact]
    public async Task HandleAsync_CanceledRequest_DoesNotRead()
    {
        var repository = new RepositoryStub((_, _) => null);
        var handler = new FindTemplateHandler(repository);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.HandleAsync(new FindTemplateQuery(Guid.NewGuid(), Guid.NewGuid()),
                cancellation.Token));

        Assert.Equal(0, repository.FindCalls);
    }

    private sealed class RepositoryStub(Func<Guid, Guid, ImageTemplate?> find) : ITemplateRepository
    {
        public int FindCalls { get; private set; }

        public Guid UserId { get; private set; }

        public Guid Id { get; private set; }

        public CancellationToken Token { get; private set; }

        public Task CreateAsync(
            ImageTemplate template,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<IReadOnlyList<TemplateSummary>> ListAsync(
            Guid userId,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<ImageTemplate?> FindAsync(
            Guid userId,
            Guid id,
            CancellationToken cancellationToken)
        {
            FindCalls++;
            UserId = userId;
            Id = id;
            Token = cancellationToken;
            return Task.FromResult(find(userId, id));
        }

        public Task<bool> UpdateAsync(
            ImageTemplate template,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<bool> DeleteAsync(
            Guid userId,
            Guid id,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
