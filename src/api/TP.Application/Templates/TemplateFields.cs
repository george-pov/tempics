namespace TP.Application.Templates;

internal sealed record TemplateFields(string Name, string Template)
{
    public static TemplateFields Parse(string? name, string? template)
    {
        var normalizedName = name?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            throw new TemplateInputException(TemplateInputError.EmptyName);
        }

        if (normalizedName.Length > 100)
        {
            throw new TemplateInputException(TemplateInputError.NameTooLong);
        }

        if (template?.Length > 16_384)
        {
            throw new TemplateInputException(TemplateInputError.TemplateTooLarge);
        }

        if (string.IsNullOrWhiteSpace(template))
        {
            throw new TemplateInputException(TemplateInputError.EmptyTemplate);
        }

        return new TemplateFields(normalizedName, template);
    }
}
