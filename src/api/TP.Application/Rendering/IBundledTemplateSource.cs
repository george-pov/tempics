namespace TP.Application.Rendering;

public interface IBundledTemplateSource
{
    ValueTask<ReadOnlyMemory<byte>> LoadAsync(CancellationToken cancellationToken);
}
