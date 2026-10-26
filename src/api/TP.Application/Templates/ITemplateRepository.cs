namespace TP.Application.Templates;

public interface ITemplateRepository
{
    Task CreateAsync(ImageTemplate template, CancellationToken cancellationToken);

    Task<IReadOnlyList<TemplateSummary>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task<ImageTemplate?> FindAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken);

    Task<bool> UpdateAsync(ImageTemplate template, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken cancellationToken);
}
