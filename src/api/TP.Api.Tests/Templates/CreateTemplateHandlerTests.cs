using TP.Application.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class CreateTemplateHandlerTests
{
    [Fact]
    public async Task HandleAsync_ValidInput_InsertsOwnedTemplateWithExactText()
    {
        var userId = Guid.NewGuid();
        const string text = "  <Border>\r\n  text  \r\n</Border>  ";
        var repository = new RepositoryStub();
        var handler = new CreateTemplateHandler(repository);
        using var cancellation = new CancellationTokenSource();

        var result = await handler.HandleAsync(
            new CreateTemplateCommand(userId, "  Invoice  ", text),
            cancellation.Token);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Invoice", result.Name);
        Assert.Equal(1, repository.CreateCalls);
        Assert.Equal(userId, repository.Created!.UserId);
        Assert.Equal(result.Id, repository.Created.Id);
        Assert.Equal(result.Name, repository.Created.Name);
        Assert.Equal(text, repository.Created.Template);
        Assert.Equal(cancellation.Token, repository.Token);
    }

    [Fact]
    public async Task HandleAsync_MaximumLengths_AcceptsInput()
    {
        var repository = new RepositoryStub();
        var name = new string('n', 100);
        var text = new string('x', 16_384);

        var result = await new CreateTemplateHandler(repository).HandleAsync(
            new CreateTemplateCommand(Guid.NewGuid(), name, text),
            CancellationToken.None);

        Assert.Equal(name, result.Name);
        Assert.Equal(text, repository.Created!.Template);
    }

    [Theory]
    [InlineData(null, "<Border/>", TemplateInputError.EmptyName)]
    [InlineData("  ", "<Border/>", TemplateInputError.EmptyName)]
    [InlineData("Name", null, TemplateInputError.EmptyTemplate)]
    [InlineData("Name", "  \r\n  ", TemplateInputError.EmptyTemplate)]
    public async Task HandleAsync_EmptyFields_RejectsWithoutPersistence(
        string? name,
        string? text,
        TemplateInputError expectedError)
    {
        var repository = new RepositoryStub();
        var handler = new CreateTemplateHandler(repository);

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            handler.HandleAsync(
                new CreateTemplateCommand(Guid.NewGuid(), name, text),
                CancellationToken.None));

        Assert.Equal(expectedError, error.Error);
        Assert.Equal(0, repository.CreateCalls);
    }

    [Fact]
    public async Task HandleAsync_LongName_RejectsAfterTrimming()
    {
        var repository = new RepositoryStub();
        var handler = new CreateTemplateHandler(repository);

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            handler.HandleAsync(
                new CreateTemplateCommand(Guid.NewGuid(), $" {new string('n', 101)} ", "<Border/>"),
                CancellationToken.None));

        Assert.Equal(TemplateInputError.NameTooLong, error.Error);
        Assert.Equal(0, repository.CreateCalls);
    }

    [Fact]
    public async Task HandleAsync_OversizedTemplate_RejectsUtf16Length()
    {
        var repository = new RepositoryStub();
        var handler = new CreateTemplateHandler(repository);
        var text = string.Concat(Enumerable.Repeat("\U0001F642", 8_193));

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            handler.HandleAsync(
                new CreateTemplateCommand(Guid.NewGuid(), "Name", text),
                CancellationToken.None));

        Assert.Equal(TemplateInputError.TemplateTooLarge, error.Error);
        Assert.Equal(0, repository.CreateCalls);
    }

    [Fact]
    public async Task HandleAsync_EmptyUserId_RejectsWithoutPersistence()
    {
        var repository = new RepositoryStub();
        var handler = new CreateTemplateHandler(repository);

        var error = await Assert.ThrowsAsync<TemplateInputException>(() =>
            handler.HandleAsync(
                new CreateTemplateCommand(Guid.Empty, "Name", "<Border/>"),
                CancellationToken.None));

        Assert.Equal(TemplateInputError.InvalidUserId, error.Error);
        Assert.Equal(0, repository.CreateCalls);
    }

    [Fact]
    public async Task HandleAsync_CanceledRequest_DoesNotPersist()
    {
        var repository = new RepositoryStub();
        var handler = new CreateTemplateHandler(repository);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.HandleAsync(
                new CreateTemplateCommand(Guid.NewGuid(), "Name", "<Border/>"),
                cancellation.Token));

        Assert.Equal(0, repository.CreateCalls);
    }

    private sealed class RepositoryStub : ITemplateRepository
    {
        public int CreateCalls { get; private set; }

        public ImageTemplate? Created { get; private set; }

        public CancellationToken Token { get; private set; }

        public Task CreateAsync(ImageTemplate template, CancellationToken cancellationToken)
        {
            CreateCalls++;
            Created = template;
            Token = cancellationToken;
            return Task.CompletedTask;
        }

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

        public Task<bool> DeleteAsync(
            Guid userId,
            Guid id,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
