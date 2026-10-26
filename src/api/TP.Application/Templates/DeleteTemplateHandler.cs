namespace TP.Application.Templates;

public sealed class DeleteTemplateHandler(ITemplateRepository repository)
{
    public Task<bool> HandleAsync(
        DeleteTemplateCommand command,
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

        return repository.DeleteAsync(command.UserId, command.Id, cancellationToken);
    }
}
