using Azure;
using Azure.Data.Tables;
using Azure.Identity;
using TP.Application.Templates;

namespace TP.TableStorage.Templates;

public sealed class TableTemplateRepository(TableClient tableClient) : ITemplateRepository
{
    private readonly TableClient _tableClient = tableClient;

    public async Task CreateAsync(ImageTemplate template, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(template);
        if (template.UserId == Guid.Empty || template.Id == Guid.Empty)
        {
            throw new ArgumentException("Template keys must be nonempty GUIDs.", nameof(template));
        }

        try
        {
            await _tableClient.AddEntityAsync(
                TemplateEntity.FromTemplate(template), cancellationToken);
        }
        catch (Exception exception) when (
            exception is RequestFailedException or AuthenticationFailedException or HttpRequestException)
        {
            throw new TemplateUnavailableException();
        }
    }

    public async Task<IReadOnlyList<TemplateSummary>> ListAsync(
        Guid userId, CancellationToken cancellationToken)
    {
        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User ID must be a nonempty GUID.", nameof(userId));
        }

        var partition = userId.ToString("D");
        string[] select = [nameof(TemplateEntity.RowKey), nameof(TemplateEntity.UserId), nameof(TemplateEntity.Name)];
        try
        {
            var query = _tableClient.QueryAsync<TemplateEntity>(
                entity => entity.PartitionKey == partition,
                maxPerPage: 1000,
                select: select,
                cancellationToken: cancellationToken);

            var items = new List<TemplateSummary>();
            await foreach (var entity in query.WithCancellation(cancellationToken))
            {
                var id = ReadId(entity, partition);
                items.Add(new TemplateSummary(id, entity.Name));
            }

            return items;
        }
        catch (Exception exception) when (
            exception is RequestFailedException or AuthenticationFailedException or HttpRequestException)
        {
            throw new TemplateUnavailableException();
        }
    }

    public async Task<ImageTemplate?> FindAsync(
        Guid userId, Guid id, CancellationToken cancellationToken)
    {
        if (userId == Guid.Empty || id == Guid.Empty)
        {
            throw new ArgumentException("Template keys must be nonempty GUIDs.");
        }

        var partition = userId.ToString("D");
        var row = id.ToString("D");
        try
        {
            var response = await _tableClient.GetEntityAsync<TemplateEntity>(
                partition, row, cancellationToken: cancellationToken);
            return MapTemplate(response.Value, userId, id);
        }
        catch (RequestFailedException exception) when (
            exception.Status == 404 && exception.ErrorCode == "EntityNotFound")
        {
            return null;
        }
        catch (Exception exception) when (
            exception is RequestFailedException or AuthenticationFailedException or HttpRequestException)
        {
            throw new TemplateUnavailableException();
        }
    }

    public async Task<bool> UpdateAsync(ImageTemplate template, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(template);
        if (template.UserId == Guid.Empty || template.Id == Guid.Empty)
        {
            throw new ArgumentException("Template keys must be nonempty GUIDs.", nameof(template));
        }

        var partition = template.UserId.ToString("D");
        var row = template.Id.ToString("D");
        if (await ReadOwnedEntityAsync(partition, row, cancellationToken) is null)
        {
            return false;
        }

        try
        {
            await _tableClient.UpdateEntityAsync(
                TemplateEntity.FromTemplate(template), ETag.All, TableUpdateMode.Replace,
                cancellationToken);
            return true;
        }
        catch (RequestFailedException exception) when (
            exception.Status == 404 && exception.ErrorCode == "EntityNotFound")
        {
            return false;
        }
        catch (Exception exception) when (
            exception is RequestFailedException or AuthenticationFailedException or HttpRequestException)
        {
            throw new TemplateUnavailableException();
        }
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        if (userId == Guid.Empty || id == Guid.Empty)
        {
            throw new ArgumentException("Template keys must be nonempty GUIDs.");
        }

        var partition = userId.ToString("D");
        var row = id.ToString("D");
        if (await ReadOwnedEntityAsync(partition, row, cancellationToken) is null)
        {
            return false;
        }

        try
        {
            await _tableClient.DeleteEntityAsync(
                partition, row, cancellationToken: cancellationToken);
            return true;
        }
        catch (RequestFailedException exception) when (
            exception.Status == 404 && exception.ErrorCode == "EntityNotFound")
        {
            return true;
        }
        catch (Exception exception) when (
            exception is RequestFailedException or AuthenticationFailedException or HttpRequestException)
        {
            throw new TemplateUnavailableException();
        }
    }

    private async Task<TemplateEntity?> ReadOwnedEntityAsync(
        string partition, string row, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _tableClient.GetEntityAsync<TemplateEntity>(
                partition, row, select: [nameof(TemplateEntity.UserId)],
                cancellationToken: cancellationToken);
            var entity = response.Value;
            ValidateOwnedEntity(entity, partition, row);

            return entity;
        }
        catch (RequestFailedException exception) when (
            exception.Status == 404 && exception.ErrorCode == "EntityNotFound")
        {
            return null;
        }
        catch (Exception exception) when (
            exception is RequestFailedException or AuthenticationFailedException or HttpRequestException)
        {
            throw new TemplateUnavailableException();
        }
    }

    private static void ValidateOwnedEntity(TemplateEntity entity, string partition, string row)
    {
        if (entity.PartitionKey != partition || entity.RowKey != row ||
            entity.UserId != partition)
        {
            throw new TemplateUnavailableException();
        }
    }

    private static ImageTemplate MapTemplate(TemplateEntity entity, Guid userId, Guid id)
    {
        ValidateOwnedEntity(entity, userId.ToString("D"), id.ToString("D"));
        if (string.IsNullOrWhiteSpace(entity.Name) ||
            string.IsNullOrEmpty(entity.Template))
        {
            throw new TemplateUnavailableException();
        }

        return new ImageTemplate(userId, id, entity.Name, entity.Template);
    }

    private static Guid ReadId(TemplateEntity entity, string partition)
    {
        if (entity.UserId != partition ||
            !Guid.TryParseExact(entity.RowKey, "D", out var id) ||
            id == Guid.Empty || entity.RowKey != id.ToString("D") ||
            string.IsNullOrWhiteSpace(entity.Name))
        {
            throw new TemplateUnavailableException();
        }

        return id;
    }
}
