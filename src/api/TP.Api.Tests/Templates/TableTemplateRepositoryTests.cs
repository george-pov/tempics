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
    }

    [Fact]
    public async Task CreateAsync_ValidTemplate_PassesCancellationToTable()
    {
        var table = new TableClientStub();
        using var cancellation = new CancellationTokenSource();

        await new TableTemplateRepository(table).CreateAsync(
            new ImageTemplate(UserId, Guid.NewGuid(), "Title", "<TextBlock />"),
            cancellation.Token);

        Assert.Equal(cancellation.Token, table.AddToken);
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

        var items = await repository.ListAsync(UserId, CancellationToken.None);

        Assert.Equal(ids, items.Select(item => item.Id));
        Assert.All(items, item => Assert.Equal("Name", item.Name));
        Assert.Equal(2, table.QueryPageCount);
    }

    [Fact]
    public async Task ListAsync_RequestsMetadataWithoutTemplateText()
    {
        var table = new TableClientStub();

        await new TableTemplateRepository(table).ListAsync(UserId, CancellationToken.None);

        string[] expected =
            [nameof(TemplateEntity.RowKey), nameof(TemplateEntity.UserId), nameof(TemplateEntity.Name)];
        Assert.Equal(expected.Order(StringComparer.Ordinal),
            table.QuerySelect?.Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task ListAsync_QueriesOnlyCallerPartition()
    {
        var table = new TableClientStub();

        await new TableTemplateRepository(table).ListAsync(UserId, CancellationToken.None);

        Assert.True(table.QueryFilter!(Entity(UserId, Guid.NewGuid(), "Mine", "mine")));
        Assert.False(table.QueryFilter(Entity(OtherUserId, Guid.NewGuid(), "Other", "private")));
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
    public async Task FindAsync_Owner_ReturnsExactText()
    {
        var table = new TableClientStub();
        var id = Guid.NewGuid();
        const string axaml = " <TextBlock />\r\n";
        table.Rows.Add(Entity(UserId, id, "Title", axaml));
        var repository = new TableTemplateRepository(table);
        var found = await repository.FindAsync(UserId, id, CancellationToken.None);

        Assert.Equal(new ImageTemplate(UserId, id, "Title", axaml), found);
    }

    [Fact]
    public async Task FindAsync_OtherUser_ReturnsNull()
    {
        var table = new TableClientStub();
        var id = Guid.NewGuid();
        table.Rows.Add(Entity(UserId, id, "Title", "private"));

        var otherUserResult = await new TableTemplateRepository(table).FindAsync(
            OtherUserId, id, CancellationToken.None);

        Assert.Null(otherUserResult);
    }

    [Fact]
    public async Task FindAsync_ValidRequest_PassesCancellationToTable()
    {
        var table = new TableClientStub();
        using var cancellation = new CancellationTokenSource();

        await new TableTemplateRepository(table).FindAsync(
            UserId, Guid.NewGuid(), cancellation.Token);

        Assert.Equal(cancellation.Token, table.ReadToken);
    }

    [Theory]
    [InlineData("partition")]
    [InlineData("row")]
    [InlineData("owner")]
    public async Task FindAsync_CorruptStoredKeysOrOwner_FailsClosed(string corruptField)
    {
        var id = Guid.NewGuid();
        var entity = Entity(UserId, id, "Private", "private-content");
        switch (corruptField)
        {
            case "partition": entity.PartitionKey = OtherUserId.ToString("D"); break;
            case "row": entity.RowKey = Guid.NewGuid().ToString("D"); break;
            case "owner": entity.UserId = OtherUserId.ToString("D"); break;
        }

        var table = new TableClientStub { ApplyReadKeys = false };
        table.Rows.Add(entity);

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

    [Theory]
    [InlineData("EntityNotFound")]
    [InlineData("ResourceNotFound")]
    public async Task FindAsync_MissingEntity_ReturnsNull(string errorCode)
    {
        var table = new TableClientStub
        {
            ReadFailure = new RequestFailedException(404, "Missing entity", errorCode, null)
        };

        Assert.Null(await new TableTemplateRepository(table).FindAsync(
            UserId, Guid.NewGuid(), CancellationToken.None));
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

        var updated = await repository.UpdateAsync(replacement, CancellationToken.None);

        Assert.True(updated);
        Assert.Equal(replacement, await repository.FindAsync(UserId, id, CancellationToken.None));
        Assert.Equal(new ImageTemplate(OtherUserId, id, "Other", "other-private"),
            await repository.FindAsync(OtherUserId, id, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_ExistingOwner_UsesFullReplaceLastWriteWins()
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        table.Rows.Add(Entity(UserId, id, "Before", "before"));

        await new TableTemplateRepository(table).UpdateAsync(
            new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None);

        Assert.Equal(ETag.All, table.UpdateIfMatch);
        Assert.Equal(TableUpdateMode.Replace, table.UpdateMode);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MutationAsync_OwnerRead_RequestsOnlyOwnershipFields(bool update)
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        table.Rows.Add(Entity(UserId, id, "Mine", "private"));
        var repository = new TableTemplateRepository(table);

        if (update)
        {
            await repository.UpdateAsync(
                new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None);
        }
        else
        {
            await repository.DeleteAsync(UserId, id, CancellationToken.None);
        }

        string[] expected =
            [nameof(TemplateEntity.PartitionKey), nameof(TemplateEntity.RowKey), nameof(TemplateEntity.UserId)];
        Assert.Equal(expected.Order(StringComparer.Ordinal),
            table.ReadSelect?.Order(StringComparer.Ordinal));
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
        Assert.Equal(0, table.UpdateCalls);
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

    [Theory]
    [InlineData("EntityNotFound")]
    [InlineData("ResourceNotFound")]
    public async Task UpdateAsync_EntityRemovedAfterRead_ReturnsMissingWithoutUpsert(string errorCode)
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            UpdateFailure = new RequestFailedException(404, "Gone", errorCode, null)
        };
        table.Rows.Add(Entity(UserId, id, "Before", "before"));

        var updated = await new TableTemplateRepository(table).UpdateAsync(
            new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None);

        Assert.False(updated);
        Assert.Equal(1, table.UpdateCalls);
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

        Assert.Equal(0, update ? table.UpdateCalls : table.DeleteCalls);
    }

    [Theory]
    [InlineData(true, "EntityNotFound")]
    [InlineData(true, "ResourceNotFound")]
    [InlineData(false, "EntityNotFound")]
    [InlineData(false, "ResourceNotFound")]
    public async Task MutationAsync_MissingOwnerRead_ReturnsMissingWithoutWrite(
        bool update, string errorCode)
    {
        var table = new TableClientStub
        {
            ReadFailure = new RequestFailedException(404, "Missing entity", errorCode, null)
        };
        var repository = new TableTemplateRepository(table);
        var id = Guid.NewGuid();

        var found = update
            ? await repository.UpdateAsync(
                new ImageTemplate(UserId, id, "After", "after"), CancellationToken.None)
            : await repository.DeleteAsync(UserId, id, CancellationToken.None);

        Assert.False(found);
        Assert.Equal(0, update ? table.UpdateCalls : table.DeleteCalls);
    }

    [Fact]
    public async Task DeleteAsync_ExistingOwner_RemovesOnlyThatRow()
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        table.Rows.Add(Entity(UserId, id, "Mine", "mine"));
        table.Rows.Add(Entity(OtherUserId, id, "Other", "other-private"));
        var repository = new TableTemplateRepository(table);

        var deleted = await repository.DeleteAsync(UserId, id, CancellationToken.None);

        Assert.True(deleted);
        Assert.Null(await repository.FindAsync(UserId, id, CancellationToken.None));
        Assert.NotNull(await repository.FindAsync(OtherUserId, id, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_ExistingOwner_UsesUnconditionalDelete()
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub();
        table.Rows.Add(Entity(UserId, id, "Mine", "mine"));

        await new TableTemplateRepository(table).DeleteAsync(UserId, id, CancellationToken.None);

        Assert.Equal(default(ETag), table.DeleteIfMatch);
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

    [Theory]
    [InlineData("EntityNotFound")]
    [InlineData("ResourceNotFound")]
    public async Task DeleteAsync_EntityRemovedAfterRead_ReturnsSuccess(string errorCode)
    {
        var id = Guid.NewGuid();
        var table = new TableClientStub
        {
            DeleteFailure = new RequestFailedException(404, "Gone", errorCode, null)
        };
        table.Rows.Add(Entity(UserId, id, "Mine", "mine"));

        Assert.True(await new TableTemplateRepository(table).DeleteAsync(
            UserId, id, CancellationToken.None));
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

        public CancellationToken AddToken { get; private set; }

        public Exception? AddFailure { get; init; }

        public bool ApplyQueryFilter { get; init; } = true;

        public Func<TemplateEntity, bool>? QueryFilter { get; private set; }

        public int QueryPageCount { get; private set; }

        public string[]? QuerySelect { get; private set; }

        public CancellationToken QueryToken { get; private set; }

        public Exception? QueryFailure { get; init; }

        public Exception? QueryFailureAfterFirstPage { get; init; }

        public bool ApplyReadKeys { get; init; } = true;

        public CancellationToken ReadToken { get; private set; }

        public string[]? ReadSelect { get; private set; }

        public Exception? ReadFailure { get; init; }

        public TemplateEntity? UpdatedEntity { get; private set; }

        public int UpdateCalls { get; private set; }

        public ETag UpdateIfMatch { get; private set; }

        public TableUpdateMode UpdateMode { get; private set; }

        public CancellationToken UpdateToken { get; private set; }

        public Exception? UpdateFailure { get; init; }

        public int DeleteCalls { get; private set; }

        public ETag DeleteIfMatch { get; private set; }

        public CancellationToken DeleteToken { get; private set; }

        public Exception? DeleteFailure { get; init; }

        public override Task<Response> AddEntityAsync<T>(T entity, CancellationToken cancellationToken = default)
        {
            AddedEntity = entity;
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
            ReadToken = cancellationToken;
            ReadSelect = select?.ToArray();
            if (ReadFailure is not null)
            {
                return Task.FromException<Response<T>>(ReadFailure);
            }

            var entity = Rows.FirstOrDefault(entity =>
                !ApplyReadKeys || (entity.PartitionKey == partitionKey && entity.RowKey == rowKey));
            if (entity is null)
            {
                return Task.FromException<Response<T>>(
                    new RequestFailedException(404, "Missing", "EntityNotFound", null));
            }

            // The SDK materializes only selected entity properties. Preserve response metadata.
            var selected = ReadSelect is null
                ? entity
                : new TemplateEntity
                {
                    PartitionKey = ReadSelect.Contains(nameof(TemplateEntity.PartitionKey))
                        ? entity.PartitionKey : string.Empty,
                    RowKey = ReadSelect.Contains(nameof(TemplateEntity.RowKey))
                        ? entity.RowKey : string.Empty,
                    UserId = ReadSelect.Contains(nameof(TemplateEntity.UserId))
                        ? entity.UserId : string.Empty,
                    Name = ReadSelect.Contains(nameof(TemplateEntity.Name))
                        ? entity.Name : string.Empty,
                    Template = ReadSelect.Contains(nameof(TemplateEntity.Template))
                        ? entity.Template : string.Empty,
                    ETag = entity.ETag,
                    Timestamp = entity.Timestamp
                };
            return Task.FromResult(Response.FromValue((T)(ITableEntity)selected, null!));
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
