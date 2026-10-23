namespace TP.Application.Templates;

public sealed class ListTemplatesHandler(ITemplateRepository repository)
{
    public async Task<ListTemplatesResult> HandleAsync(
        ListTemplatesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        if (query.UserId == Guid.Empty)
        {
            throw new TemplateInputException(TemplateInputError.InvalidUserId);
        }

        var items = await repository.ListAsync(query.UserId, cancellationToken);
        if (items is null || items.Any(item =>
                item is null || item.Id == Guid.Empty || string.IsNullOrWhiteSpace(item.Name)))
        {
            throw new InvalidOperationException("The template list is invalid.");
        }

        return new ListTemplatesResult(items);
    }
}
