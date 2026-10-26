using TP.Application.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class DeleteTemplateHandlerTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task HandleAsync_ValidRequest_ForwardsOwnerIdTokenAndResult(bool exists)
    {
        var userId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var repository = new RepositoryStub { DeleteResult = exists };
        using var cancellation = new CancellationTokenSource();

        var result = await new DeleteTemplateHandler(repository).HandleAsync(
            new DeleteTemplateCommand(userId, id), cancellation.Token);

        Assert.Equal(exists, result);
        Assert.Equal(1, repository.DeleteCalls);
        Assert.Equal(userId, repository.UserId);
        Assert.Equal(id, repository.Id);
        Assert.Equal(cancellation.Token, repository.Token);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task HandleAsync_EmptyGuid_RejectsBeforeRepository(bool emptyUser)
    {
        var repository = new RepositoryStub();

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            new DeleteTemplateHandler(repository).HandleAsync(
                new DeleteTemplateCommand(
                    emptyUser ? Guid.Empty : Guid.NewGuid(),
                    emptyUser ? Guid.NewGuid() : Guid.Empty),
                CancellationToken.None));

        Assert.Equal(emptyUser ? TemplateInputError.InvalidUserId : TemplateInputError.InvalidId,
            error.Error);
        Assert.Equal(0, repository.DeleteCalls);
    }

    [Fact]
    public async Task HandleAsync_CanceledRequest_DoesNotDelete()
    {
        var repository = new RepositoryStub();
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new DeleteTemplateHandler(repository).HandleAsync(
                new DeleteTemplateCommand(Guid.NewGuid(), Guid.NewGuid()),
                cancellation.Token));

        Assert.Equal(0, repository.DeleteCalls);
    }

    private sealed class RepositoryStub : ITemplateRepository
    {
        public bool DeleteResult { get; set; }

        public int DeleteCalls { get; private set; }

        public Guid UserId { get; private set; }

        public Guid Id { get; private set; }

        public CancellationToken Token { get; private set; }

        public Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken cancellationToken)
        {
            DeleteCalls++;
            UserId = userId;
            Id = id;
            Token = cancellationToken;
            return Task.FromResult(DeleteResult);
        }

        public Task CreateAsync(ImageTemplate template, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<TemplateSummary>> ListAsync(
            Guid userId,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<ImageTemplate?> FindAsync(
            Guid userId,
            Guid id,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<bool> UpdateAsync(
            ImageTemplate template,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
