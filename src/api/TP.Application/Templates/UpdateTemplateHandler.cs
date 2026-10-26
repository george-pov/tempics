namespace TP.Application.Templates;

public sealed class UpdateTemplateHandler(ITemplateRepository repository)
{
    public Task<bool> HandleAsync(
        UpdateTemplateCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (command.UserId == Guid.Empty)
        {
            throw new TemplateInputException(TemplateInputError.InvalidUserId);
        }

        if (command.Id == Guid.Empty)
        {
            throw new TemplateInputException(TemplateInputError.InvalidId);
        }

        var fields = TemplateFields.Parse(command.Name, command.Template);
        var replacement = new ImageTemplate(
            command.UserId,
            command.Id,
            fields.Name,
            fields.Template);

        return repository.UpdateAsync(replacement, cancellationToken);
    }
}
