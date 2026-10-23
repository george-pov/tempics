namespace TP.Application.Templates;

public sealed record CreateTemplateCommand(Guid UserId, string? Name, string? Template);
