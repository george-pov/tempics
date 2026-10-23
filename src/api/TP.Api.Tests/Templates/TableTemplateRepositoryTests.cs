using System.Linq.Expressions;
using Azure;
using Azure.Data.Tables;
using Azure.Identity;
using TP.Application.Templates;
using TP.TableStorage.Templates;
using Xunit;

namespace TP.Api.Tests.Templates;

public sealed class TableTemplateRepositoryTests
{
    private static readonly Guid UserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid OtherUserId = Guid.Parse("20000000-0000-0000-0000-000000000002");

    [Fact]
    public async Task CreateAsync_ValidTemplate_InsertsOwnerScopedEntity()
    {
        var table = new TableClientStub();
        var repository = new TableTemplateRepository(table);
        var id = Guid.NewGuid();
        const string axaml = "<TextBlock Text=\"exact\" />\r\n";
        using var cancellation = new CancellationTokenSource();

        await repository.CreateAsync(
            new ImageTemplate(UserId, id, "Title", axaml), cancellation.Token);

        var entity = Assert.IsType<TemplateEntity>(table.AddedEntity);
        Assert.Equal(UserId.ToString("D"), entity.PartitionKey);
        Assert.Equal(UserId.ToString("D"), entity.UserId);
        Assert.Equal(id.ToString("D"), entity.RowKey);
        Assert.Equal("Title", entity.Name);
        Assert.Equal(axaml, entity.Template);
        Assert.Equal(cancellation.Token, table.AddToken);
        Assert.Equal(1, table.AddCalls);
    }

    [Fact]
    public async Task CreateAsync_ProviderFailure_ThrowsSafeUnavailableError()
    {
        const string privateMessage = "secret-uri private-template";
        var table = new TableClientStub { AddFailure = new RequestFailedException(409, privateMessage) };
        var repository = new TableTemplateRepository(table);

        var failure = await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            repository.CreateAsync(
                new ImageTemplate(UserId, Guid.NewGuid(), "Title", "<TextBlock />"),
                CancellationToken.None));

        Assert.DoesNotContain(privateMessage, failure.ToString());
        Assert.Equal(1, table.AddCalls);
    }

    [Fact]
    public async Task ListAsync_MultiplePages_ReturnsAllOwnerMetadata()
    {
        var table = new TableClientStub();
        var ids = Enumerable.Range(1, 1005)
            .Select(value => Guid.Parse($"00000000-0000-0000-0000-{value:x12}"))
            .ToArray();
        table.Rows.AddRange(ids.Select(id => Entity(UserId, id, "Name", "secret-axaml")));
        table.Rows.Add(Entity(OtherUserId, Guid.NewGuid(), "Other", "other-secret"));
        var repository = new TableTemplateRepository(table);
        using var cancellation = new CancellationTokenSource();

        var items = await repository.ListAsync(UserId, cancellation.Token);

        Assert.Equal(1005, items.Count);
        Assert.Equal(ids, items.Select(item => item.Id));
        Assert.All(items, item => Assert.Equal("Name", item.Name));
        Assert.Equal(1000, table.QueryMaxPerPage);
        Assert.Equal(2, table.QueryPageCount);
        Assert.NotNull(table.QuerySelect);
        Assert.Equal(
            [nameof(TemplateEntity.RowKey), nameof(TemplateEntity.UserId), nameof(TemplateEntity.Name)],
            table.QuerySelect);
        Assert.DoesNotContain(nameof(TemplateEntity.Template), table.QuerySelect);
        Assert.Equal(cancellation.Token, table.QueryToken);
        Assert.False(table.QueryFilter!(Entity(OtherUserId, Guid.NewGuid(), "Other", "other-secret")));
        Assert.Contains($"PartitionKey eq '{UserId:D}'", table.QueryOdata);
        Assert.DoesNotContain("RowKey gt", table.QueryOdata);
    }

    [Fact]
    public async Task ListAsync_CorruptOwner_FailsClosed()
    {
        var table = new TableClientStub { ApplyQueryFilter = false };
        table.Rows.Add(new TemplateEntity
        {
            PartitionKey = UserId.ToString("D"),
            UserId = OtherUserId.ToString("D"),
            RowKey = Guid.NewGuid().ToString("D"),
            Name = "Leak"
        });

        await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).ListAsync(UserId, CancellationToken.None));
    }

    [Fact]
    public async Task ListAsync_ProviderFailure_ThrowsSafeUnavailableError()
    {
        const string privateMessage = "private provider payload";
        var table = new TableClientStub
        {
            QueryFailure = new RequestFailedException(503, privateMessage)
        };

        var failure = await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).ListAsync(UserId, CancellationToken.None));

        Assert.DoesNotContain(privateMessage, failure.ToString());
    }

    [Fact]
    public async Task ListAsync_LaterPageFails_DoesNotReturnPartialList()
    {
        const string privateMessage = "private provider payload";
        var table = new TableClientStub
        {
            QueryFailureAfterFirstPage = new RequestFailedException(503, privateMessage)
        };
        table.Rows.AddRange(Enumerable.Range(1, 1001)
            .Select(value => Entity(
                UserId,
                Guid.Parse($"00000000-0000-0000-0000-{value:x12}"),
                "Name",
                "private-template")));

        var failure = await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).ListAsync(UserId, CancellationToken.None));

        Assert.DoesNotContain(privateMessage, failure.ToString());
        Assert.Equal(2, table.QueryPageCount);
    }

    [Fact]
    public async Task ListAsync_RequestCanceled_PropagatesCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var table = new TableClientStub
        {
            QueryFailure = new OperationCanceledException(cancellation.Token)
        };

        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new TableTemplateRepository(table).ListAsync(UserId, cancellation.Token));

        Assert.Equal(cancellation.Token, failure.CancellationToken);
        Assert.Equal(cancellation.Token, table.QueryToken);
    }

    [Fact]
    public async Task FindAsync_OwnerAndOtherUser_UsesTwoKeysAndReturnsExactText()
    {
        var table = new TableClientStub();
        var id = Guid.NewGuid();
        const string axaml = " <TextBlock />\r\n";
        table.Rows.Add(Entity(UserId, id, "Title", axaml));
        var repository = new TableTemplateRepository(table);
        using var cancellation = new CancellationTokenSource();

        var found = await repository.FindAsync(UserId, id, cancellation.Token);

        Assert.Equal(new ImageTemplate(UserId, id, "Title", axaml), found);
        Assert.Equal(UserId.ToString("D"), table.ReadPartition);
        Assert.Equal(id.ToString("D"), table.ReadRow);
        Assert.Equal(cancellation.Token, table.ReadToken);

        var otherUserResult = await repository.FindAsync(OtherUserId, id, cancellation.Token);

        Assert.Null(otherUserResult);
        Assert.Equal(OtherUserId.ToString("D"), table.ReadPartition);
    }

    [Fact]
    public async Task FindAsync_CorruptOwner_FailsClosed()
    {
        var table = new TableClientStub { ApplyReadKeys = false };
        var id = Guid.NewGuid();
        table.Rows.Add(new TemplateEntity
        {
            PartitionKey = UserId.ToString("D"),
            RowKey = id.ToString("D"),
            UserId = OtherUserId.ToString("D"),
            Name = "Private",
            Template = "private-content"
        });

        await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).FindAsync(UserId, id, CancellationToken.None));
    }

    [Fact]
    public async Task FindAsync_ProviderFailure_ThrowsSafeUnavailableError()
    {
        const string privateMessage = "secret-uri private-template";
        var table = new TableClientStub { ReadFailure = new RequestFailedException(503, privateMessage) };

        var failure = await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).FindAsync(UserId, Guid.NewGuid(), CancellationToken.None));

        Assert.DoesNotContain(privateMessage, failure.ToString());
    }

    [Fact]
    public async Task FindAsync_MissingTable_ThrowsUnavailableInsteadOfNotFound()
    {
        var table = new TableClientStub
        {
            ReadFailure = new RequestFailedException(404, "Missing table", "TableNotFound", null)
        };

        await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).FindAsync(UserId, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task FindAsync_CredentialFailure_ThrowsSafeUnavailableError()
    {
        const string privateMessage = "private credential details";
        var table = new TableClientStub
        {
            ReadFailure = new AuthenticationFailedException(privateMessage)
        };

        var failure = await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).FindAsync(UserId, Guid.NewGuid(), CancellationToken.None));

        Assert.DoesNotContain(privateMessage, failure.ToString());
    }

    private static TemplateEntity Entity(Guid userId, Guid id, string name, string template) =>
        TemplateEntity.FromTemplate(new ImageTemplate(userId, id, name, template));

    private sealed class TableClientStub : TableClient
    {
        public List<TemplateEntity> Rows { get; } = [];

        public ITableEntity? AddedEntity { get; private set; }

        public int AddCalls { get; private set; }

        public CancellationToken AddToken { get; private set; }

        public Exception? AddFailure { get; init; }

        public bool ApplyQueryFilter { get; init; } = true;

        public Func<TemplateEntity, bool>? QueryFilter { get; private set; }

        public string? QueryOdata { get; private set; }

        public int? QueryMaxPerPage { get; private set; }

        public int QueryPageCount { get; private set; }

        public string[]? QuerySelect { get; private set; }

        public CancellationToken QueryToken { get; private set; }

        public Exception? QueryFailure { get; init; }

        public Exception? QueryFailureAfterFirstPage { get; init; }

        public bool ApplyReadKeys { get; init; } = true;

        public string? ReadPartition { get; private set; }

        public string? ReadRow { get; private set; }

        public CancellationToken ReadToken { get; private set; }

        public Exception? ReadFailure { get; init; }

        public override Task<Response> AddEntityAsync<T>(T entity, CancellationToken cancellationToken = default)
        {
            AddedEntity = entity;
            AddCalls++;
            AddToken = cancellationToken;
            return AddFailure is null
                ? Task.FromResult<Response>(null!)
                : Task.FromException<Response>(AddFailure);
        }

        public override AsyncPageable<T> QueryAsync<T>(
            Expression<Func<T, bool>> filter,
            int? maxPerPage = null,
            IEnumerable<string>? select = null,
            CancellationToken cancellationToken = default)
        {
            QueryFilter = entity => filter.Compile()((T)(ITableEntity)entity);
            QueryOdata = TableClient.CreateQueryFilter(filter);
            QueryMaxPerPage = maxPerPage;
            QuerySelect = select?.ToArray();
            QueryToken = cancellationToken;
            if (QueryFailure is not null)
            {
                throw QueryFailure;
            }

            var items = (ApplyQueryFilter ? Rows.Where(QueryFilter) : Rows)
                .Select(entity => (T)(ITableEntity)entity)
                .ToArray();
            var chunks = items.Chunk(maxPerPage ?? 1000).ToArray();
            QueryPageCount = chunks.Length;
            return AsyncPageable<T>.FromPages(Pages());

            IEnumerable<Page<T>> Pages()
            {
                for (var index = 0; index < chunks.Length; index++)
                {
                    if (index == 1 && QueryFailureAfterFirstPage is not null)
                    {
                        throw QueryFailureAfterFirstPage;
                    }

                    yield return Page<T>.FromValues(
                        chunks[index],
                        index < chunks.Length - 1 ? $"page-{index + 1}" : null,
                        null!);
                }
            }
        }

        public override Task<Response<T>> GetEntityAsync<T>(
            string partitionKey,
            string rowKey,
            IEnumerable<string>? select = null,
            CancellationToken cancellationToken = default)
        {
            ReadPartition = partitionKey;
            ReadRow = rowKey;
            ReadToken = cancellationToken;
            if (ReadFailure is not null)
            {
                return Task.FromException<Response<T>>(ReadFailure);
            }

            var entity = Rows.FirstOrDefault(entity =>
                !ApplyReadKeys || (entity.PartitionKey == partitionKey && entity.RowKey == rowKey));
            return entity is null
                ? Task.FromException<Response<T>>(
                    new RequestFailedException(404, "Missing", "EntityNotFound", null))
                : Task.FromResult(Response.FromValue((T)(ITableEntity)entity, null!));
        }
    }
}
