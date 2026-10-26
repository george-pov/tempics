using TP.Application.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class UpdateTemplateHandlerTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task HandleAsync_ValidReplacement_ForwardsOwnedFieldsAndResult(bool exists)
    {
        var userId = Guid.NewGuid();
        var id = Guid.NewGuid();
        const string text = "  <Border>\r\n exact text </Border>  ";
        var repository = new RepositoryStub { UpdateResult = exists };
        using var cancellation = new CancellationTokenSource();

        var result = await new UpdateTemplateHandler(repository).HandleAsync(
            new UpdateTemplateCommand(userId, id, "  Invoice  ", text),
            cancellation.Token);

        Assert.Equal(exists, result);
        Assert.Equal(1, repository.UpdateCalls);
        Assert.Equal(new ImageTemplate(userId, id, "Invoice", text), repository.Updated);
        Assert.Equal(cancellation.Token, repository.Token);
    }

    [Fact]
    public async Task HandleAsync_MaximumLengths_AcceptsUtf16Boundaries()
    {
        var repository = new RepositoryStub { UpdateResult = true };
        var name = new string('n', 100);
        var text = string.Concat(Enumerable.Repeat("\U0001F642", 8_192));

        var result = await new UpdateTemplateHandler(repository).HandleAsync(
            new UpdateTemplateCommand(Guid.NewGuid(), Guid.NewGuid(), name, text),
            CancellationToken.None);

        Assert.True(result);
        Assert.Equal(name, repository.Updated!.Name);
        Assert.Equal(text, repository.Updated.Template);
    }

    [Theory]
    [InlineData(null, "<Border/>", TemplateInputError.EmptyName)]
    [InlineData("  ", "<Border/>", TemplateInputError.EmptyName)]
    [InlineData("Name", null, TemplateInputError.EmptyTemplate)]
    [InlineData("Name", "  \r\n  ", TemplateInputError.EmptyTemplate)]
    public async Task HandleAsync_EmptyFields_RejectsBeforeRepository(
        string? name,
        string? text,
        TemplateInputError expected)
    {
        var repository = new RepositoryStub();

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            new UpdateTemplateHandler(repository).HandleAsync(
                new UpdateTemplateCommand(Guid.NewGuid(), Guid.NewGuid(), name, text),
                CancellationToken.None));

        Assert.Equal(expected, error.Error);
        Assert.Equal(0, repository.UpdateCalls);
    }

    [Fact]
    public async Task HandleAsync_LongName_RejectsAfterTrimming()
    {
        var repository = new RepositoryStub();

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            new UpdateTemplateHandler(repository).HandleAsync(
                new UpdateTemplateCommand(
                    Guid.NewGuid(), Guid.NewGuid(), $" {new string('n', 101)} ", "<Border/>"),
                CancellationToken.None));

        Assert.Equal(TemplateInputError.NameTooLong, error.Error);
        Assert.Equal(0, repository.UpdateCalls);
    }

    [Fact]
    public async Task HandleAsync_OversizedText_RejectsUtf16Length()
    {
        var repository = new RepositoryStub();
        var text = string.Concat(Enumerable.Repeat("\U0001F642", 8_193));

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            new UpdateTemplateHandler(repository).HandleAsync(
                new UpdateTemplateCommand(Guid.NewGuid(), Guid.NewGuid(), "Name", text),
                CancellationToken.None));

        Assert.Equal(TemplateInputError.TemplateTooLarge, error.Error);
        Assert.Equal(0, repository.UpdateCalls);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task HandleAsync_EmptyGuid_RejectsBeforeRepository(bool emptyUser)
    {
        var repository = new RepositoryStub();

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            new UpdateTemplateHandler(repository).HandleAsync(
                new UpdateTemplateCommand(
                    emptyUser ? Guid.Empty : Guid.NewGuid(),
                    emptyUser ? Guid.NewGuid() : Guid.Empty,
                    "Name",
                    "<Border/>"),
                CancellationToken.None));

        Assert.Equal(emptyUser ? TemplateInputError.InvalidUserId : TemplateInputError.InvalidId,
            error.Error);
        Assert.Equal(0, repository.UpdateCalls);
    }

    [Fact]
    public async Task HandleAsync_CanceledRequest_DoesNotUpdate()
    {
        var repository = new RepositoryStub();
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new UpdateTemplateHandler(repository).HandleAsync(
                new UpdateTemplateCommand(Guid.NewGuid(), Guid.NewGuid(), "Name", "<Border/>"),
                cancellation.Token));

        Assert.Equal(0, repository.UpdateCalls);
    }

    private sealed class RepositoryStub : ITemplateRepository
    {
        public bool UpdateResult { get; set; }

        public int UpdateCalls { get; private set; }

        public ImageTemplate? Updated { get; private set; }

        public CancellationToken Token { get; private set; }

        public Task<bool> UpdateAsync(ImageTemplate template, CancellationToken cancellationToken)
        {
            UpdateCalls++;
            Updated = template;
            Token = cancellationToken;
            return Task.FromResult(UpdateResult);
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

        public Task<bool> DeleteAsync(
            Guid userId,
            Guid id,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
