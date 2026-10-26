namespace TP.Application.Rendering;

public enum PreviewInputError
{
    Invalid,
    TooLarge
}

public sealed class PreviewInputException(PreviewInputError error)
    : Exception(error == PreviewInputError.TooLarge
        ? "The preview input is too large."
        : "The preview input is invalid.")
{
    public PreviewInputError Error { get; } = error;
}
