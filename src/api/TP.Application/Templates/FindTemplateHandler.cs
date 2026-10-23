namespace TP.Application.Templates;

public sealed class FindTemplateHandler(ITemplateRepository repository)
{
    public async Task<ImageTemplate?> HandleAsync(
        FindTemplateQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        if (query.UserId == Guid.Empty)
        {
            throw new TemplateInputException(TemplateInputError.InvalidUserId);
        }

        if (query.Id == Guid.Empty)
        {
            throw new TemplateInputException(TemplateInputError.InvalidId);
        }

        var template = await repository.FindAsync(query.UserId, query.Id, cancellationToken);
        if (template is not null &&
            (template.UserId != query.UserId || template.Id != query.Id))
        {
            throw new InvalidOperationException("The template result is invalid.");
        }

        return template;
    }
}
