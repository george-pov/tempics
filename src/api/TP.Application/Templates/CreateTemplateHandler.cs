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

        var fields = TemplateFields.Parse(command.Name, command.Template);

        var template = new ImageTemplate(
            command.UserId,
            Guid.NewGuid(),
            fields.Name,
            fields.Template);

        await repository.CreateAsync(template, cancellationToken);
        return new CreateTemplateResult(template.Id, template.Name);
    }
}
