namespace TP.Application.Templates;

public sealed class CreateTemplateHandler(ITemplateRepository repository)
{
    public async Task<CreateTemplateResult> HandleAsync(
        CreateTemplateCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (command.UserId == Guid.Empty)
        {
            throw new TemplateInputException(TemplateInputError.InvalidUserId);
        }

        var name = command.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new TemplateInputException(TemplateInputError.EmptyName);
        }

        if (name.Length > 100)
        {
            throw new TemplateInputException(TemplateInputError.NameTooLong);
        }

        if (command.Template?.Length > 16_384)
        {
            throw new TemplateInputException(TemplateInputError.TemplateTooLarge);
        }

        if (string.IsNullOrWhiteSpace(command.Template))
        {
            throw new TemplateInputException(TemplateInputError.EmptyTemplate);
        }

        var template = new ImageTemplate(
            command.UserId,
            Guid.NewGuid(),
            name,
            command.Template);

        await repository.CreateAsync(template, cancellationToken);
        return new CreateTemplateResult(template.Id, template.Name);
    }
}
