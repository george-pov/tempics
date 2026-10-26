namespace TP.Application.Templates;

public sealed record UpdateTemplateCommand(
    Guid UserId,
    Guid Id,
    string? Name,
    string? Template);
