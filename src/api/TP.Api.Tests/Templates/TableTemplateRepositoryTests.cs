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

    [Fact]
    public async Task UpdateAsync_ExistingOwner_ReplacesOnlyThatRow()
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        table.Rows.Add(Entity(UserId, id, "Before", "before"));
        table.Rows.Add(Entity(OtherUserId, id, "Other", "other-private"));
        var repository = new TableTemplateRepository(table);
        var replacement = new ImageTemplate(UserId, id, "After", " <TextBlock />\r\n");
        using var cancellation = new CancellationTokenSource();

        var updated = await repository.UpdateAsync(replacement, cancellation.Token);

        Assert.True(updated);
        Assert.Equal(UserId.ToString("D"), table.ReadPartition);
        Assert.Equal(id.ToString("D"), table.ReadRow);
        Assert.Equal(nameof(TemplateEntity.UserId),
            Assert.Single(Assert.IsType<string[]>(table.ReadSelect)));
        Assert.Equal(cancellation.Token, table.ReadToken);
        Assert.Equal(1, table.UpdateCalls);
        Assert.Equal(ETag.All, table.UpdateIfMatch);
        Assert.Equal(TableUpdateMode.Replace, table.UpdateMode);
        Assert.Equal(cancellation.Token, table.UpdateToken);
        Assert.Equal(TemplateEntity.FromTemplate(replacement).PartitionKey,
            table.UpdatedEntity?.PartitionKey);
        Assert.Equal(replacement.Template, table.UpdatedEntity?.Template);
        Assert.Equal(replacement, await repository.FindAsync(UserId, id, CancellationToken.None));
        Assert.Equal(new ImageTemplate(OtherUserId, id, "Other", "other-private"),
            await repository.FindAsync(OtherUserId, id, CancellationToken.None));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task UpdateAsync_MissingOrForeignRow_DoesNotWrite(bool foreignRow)
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        if (foreignRow)
        {
            table.Rows.Add(Entity(OtherUserId, id, "Other", "private"));
        }

        var updated = await new TableTemplateRepository(table).UpdateAsync(
            new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None);

        Assert.False(updated);
        Assert.Equal(UserId.ToString("D"), table.ReadPartition);
        Assert.Equal(0, table.UpdateCalls);
        Assert.Equal(foreignRow ? 1 : 0, table.Rows.Count);
    }

    [Theory]
    [InlineData("partition")]
    [InlineData("row")]
    [InlineData("owner")]
    public async Task UpdateAsync_CorruptStoredKeysOrOwner_FailsClosed(string corruptField)
    {
        var id = Guid.NewGuid();
        var entity = Entity(UserId, id, "Before", "private");
        switch (corruptField)
        {
            case "partition": entity.PartitionKey = OtherUserId.ToString("D"); break;
            case "row": entity.RowKey = Guid.NewGuid().ToString("D"); break;
            case "owner": entity.UserId = OtherUserId.ToString("D"); break;
        }

        var table = new TableClientStub { ApplyReadKeys = false };
        table.Rows.Add(entity);

        await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).UpdateAsync(
                new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None));
        Assert.Equal(0, table.UpdateCalls);
    }

    [Fact]
    public async Task UpdateAsync_EntityRemovedAfterRead_ReturnsMissingWithoutUpsert()
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            UpdateFailure = new RequestFailedException(404, "Gone", "EntityNotFound", null)
        };
        table.Rows.Add(Entity(UserId, id, "Before", "before"));

        var updated = await new TableTemplateRepository(table).UpdateAsync(
            new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None);

        Assert.False(updated);
        Assert.Equal(1, table.UpdateCalls);
        Assert.Single(table.Rows);
    }

    [Theory]
    [InlineData(404, "TableNotFound")]
    [InlineData(412, "UpdateConditionNotSatisfied")]
    public async Task UpdateAsync_ProviderFailure_ThrowsSafeUnavailableError(int status, string code)
    {
        const string privateMessage = "secret-uri private-template";
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            UpdateFailure = new RequestFailedException(status, privateMessage, code, null)
        };
        table.Rows.Add(Entity(UserId, id, "Before", "before"));

        var failure = await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).UpdateAsync(
                new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None));

        Assert.DoesNotContain(privateMessage, failure.ToString());
    }

    [Fact]
    public async Task UpdateAsync_CanceledWrite_PropagatesCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            UpdateFailure = new OperationCanceledException(cancellation.Token)
        };
        table.Rows.Add(Entity(UserId, id, "Before", "before"));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new TableTemplateRepository(table).UpdateAsync(
                new ImageTemplate(UserId, id, "After", "after"), cancellation.Token));
        Assert.Equal(cancellation.Token, table.UpdateToken);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MutationAsync_MissingTableOnOwnerRead_FailsBeforeWrite(bool update)
    {
        var table = new TableClientStub
        {
            ReadFailure = new RequestFailedException(404, "private provider payload", "TableNotFound", null)
        };
        var repository = new TableTemplateRepository(table);
        var id = Guid.NewGuid();

        if (update)
        {
            await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
                repository.UpdateAsync(
                    new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None));
        }
        else
        {
            await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
                repository.DeleteAsync(UserId, id, CancellationToken.None));
        }

        Assert.Equal(0, table.UpdateCalls);
        Assert.Equal(0, table.DeleteCalls);
    }

    [Fact]
    public async Task DeleteAsync_ExistingOwner_RemovesOnlyThatRow()
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        table.Rows.Add(Entity(UserId, id, "Mine", "mine"));
        table.Rows.Add(Entity(OtherUserId, id, "Other", "other-private"));
        var repository = new TableTemplateRepository(table);
        using var cancellation = new CancellationTokenSource();

        var deleted = await repository.DeleteAsync(UserId, id, cancellation.Token);

        Assert.True(deleted);
        Assert.Equal(UserId.ToString("D"), table.ReadPartition);
        Assert.Equal(id.ToString("D"), table.ReadRow);
        Assert.Equal(nameof(TemplateEntity.UserId),
            Assert.Single(Assert.IsType<string[]>(table.ReadSelect)));
        Assert.Equal(1, table.DeleteCalls);
        Assert.Equal(UserId.ToString("D"), table.DeletePartition);
        Assert.Equal(id.ToString("D"), table.DeleteRow);
        Assert.Equal(default(ETag), table.DeleteIfMatch);
        Assert.Equal(cancellation.Token, table.DeleteToken);
        Assert.Null(await repository.FindAsync(UserId, id, CancellationToken.None));
        Assert.NotNull(await repository.FindAsync(OtherUserId, id, CancellationToken.None));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DeleteAsync_MissingOrForeignRow_DoesNotWrite(bool foreignRow)
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        if (foreignRow)
        {
            table.Rows.Add(Entity(OtherUserId, id, "Other", "private"));
        }

        var deleted = await new TableTemplateRepository(table).DeleteAsync(
            UserId, id, CancellationToken.None);

        Assert.False(deleted);
        Assert.Equal(0, table.DeleteCalls);
    }

    [Theory]
    [InlineData("partition")]
    [InlineData("row")]
    [InlineData("owner")]
    public async Task DeleteAsync_CorruptStoredKeysOrOwner_FailsClosed(string corruptField)
    {
        var id = Guid.NewGuid();
        var entity = Entity(UserId, id, "Mine", "private");
        switch (corruptField)
        {
            case "partition": entity.PartitionKey = OtherUserId.ToString("D"); break;
            case "row": entity.RowKey = Guid.NewGuid().ToString("D"); break;
            case "owner": entity.UserId = OtherUserId.ToString("D"); break;
        }

        var table = new TableClientStub { ApplyReadKeys = false };
        table.Rows.Add(entity);

        await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).DeleteAsync(UserId, id, CancellationToken.None));
        Assert.Equal(0, table.DeleteCalls);
    }

    [Fact]
    public async Task DeleteAsync_EntityRemovedAfterRead_ReturnsSuccess()
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            DeleteFailure = new RequestFailedException(404, "Gone", "EntityNotFound", null)
        };
        table.Rows.Add(Entity(UserId, id, "Mine", "mine"));

        Assert.True(await new TableTemplateRepository(table).DeleteAsync(
            UserId, id, CancellationToken.None));
        Assert.Equal(1, table.DeleteCalls);
    }

    [Fact]
    public async Task DeleteAsync_MissingTable_ThrowsSafeUnavailableError()
    {
        const string privateMessage = "secret-uri private-template";
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            DeleteFailure = new RequestFailedException(404, privateMessage, "TableNotFound", null)
        };
        table.Rows.Add(Entity(UserId, id, "Mine", "mine"));

        var failure = await Assert.ThrowsAsync<TemplateUnavailableException>(() =>
            new TableTemplateRepository(table).DeleteAsync(UserId, id, CancellationToken.None));

        Assert.DoesNotContain(privateMessage, failure.ToString());
    }

    [Fact]
    public async Task DeleteAsync_CanceledWrite_PropagatesCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            DeleteFailure = new OperationCanceledException(cancellation.Token)
        };
        table.Rows.Add(Entity(UserId, id, "Mine", "mine"));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new TableTemplateRepository(table).DeleteAsync(UserId, id, cancellation.Token));
        Assert.Equal(cancellation.Token, table.DeleteToken);
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

        public string[]? ReadSelect { get; private set; }

        public Exception? ReadFailure { get; init; }

        public TemplateEntity? UpdatedEntity { get; private set; }

        public int UpdateCalls { get; private set; }

        public ETag UpdateIfMatch { get; private set; }

        public TableUpdateMode UpdateMode { get; private set; }

        public CancellationToken UpdateToken { get; private set; }

        public Exception? UpdateFailure { get; init; }

        public string? DeletePartition { get; private set; }

        public string? DeleteRow { get; private set; }

        public int DeleteCalls { get; private set; }

        public ETag DeleteIfMatch { get; private set; }

        public CancellationToken DeleteToken { get; private set; }

        public Exception? DeleteFailure { get; init; }

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
            var predicate = filter.Compile();
            QueryFilter = entity => predicate((T)(ITableEntity)entity);
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
            return AsyncPageable<T>.FromPages(EnumeratePages(chunks));
        }

        private IEnumerable<Page<T>> EnumeratePages<T>(T[][] chunks)
            where T : class, ITableEntity
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

        public override Task<Response<T>> GetEntityAsync<T>(
            string partitionKey,
            string rowKey,
            IEnumerable<string>? select = null,
            CancellationToken cancellationToken = default)
        {
            ReadPartition = partitionKey;
            ReadRow = rowKey;
            ReadToken = cancellationToken;
            ReadSelect = select?.ToArray();
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

        public override Task<Response> UpdateEntityAsync<T>(
            T entity, ETag ifMatch, TableUpdateMode mode = TableUpdateMode.Merge,
            CancellationToken cancellationToken = default)
        {
            UpdatedEntity = (TemplateEntity)(ITableEntity)entity;
            UpdateCalls++;
            UpdateIfMatch = ifMatch;
            UpdateMode = mode;
            UpdateToken = cancellationToken;
            if (UpdateFailure is not null)
            {
                return Task.FromException<Response>(UpdateFailure);
            }

            var index = Rows.FindIndex(row =>
                row.PartitionKey == UpdatedEntity.PartitionKey &&
                row.RowKey == UpdatedEntity.RowKey);
            if (index < 0)
            {
                return Task.FromException<Response>(
                    new RequestFailedException(404, "Missing", "EntityNotFound", null));
            }

            Rows[index] = UpdatedEntity;
            return Task.FromResult<Response>(null!);
        }

        public override Task<Response> DeleteEntityAsync(
            string partitionKey, string rowKey, ETag ifMatch = default,
            CancellationToken cancellationToken = default)
        {
            DeletePartition = partitionKey;
            DeleteRow = rowKey;
            DeleteCalls++;
            DeleteIfMatch = ifMatch;
            DeleteToken = cancellationToken;
            if (DeleteFailure is not null)
            {
                return Task.FromException<Response>(DeleteFailure);
            }

            var index = Rows.FindIndex(row =>
                row.PartitionKey == partitionKey && row.RowKey == rowKey);
            if (index < 0)
            {
                return Task.FromException<Response>(
                    new RequestFailedException(404, "Missing", "EntityNotFound", null));
            }

            Rows.RemoveAt(index);
            return Task.FromResult<Response>(null!);
        }
    }
}
