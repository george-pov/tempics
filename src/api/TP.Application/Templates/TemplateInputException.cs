namespace TP.Application.Templates;

public sealed class TemplateInputException(TemplateInputError error)
    : Exception(GetMessage(error))
{
    public TemplateInputError Error { get; } = error;

    private static string GetMessage(TemplateInputError error) => error switch
    {
        TemplateInputError.InvalidUserId => "The authenticated user ID is invalid.",
        TemplateInputError.InvalidId => "The template ID is invalid.",
        TemplateInputError.EmptyName => "The template name is required.",
        TemplateInputError.NameTooLong => "The template name is too long.",
        TemplateInputError.EmptyTemplate => "The template text is required.",
        TemplateInputError.TemplateTooLarge => "The template text is too large.",
        _ => "The template input is invalid."
    };
}
