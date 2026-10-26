namespace TP.Application.Rendering;

// Renders AXAML in the shared API process. It does not isolate caller markup.
public interface IAxamlRenderer
{
    Task<RenderImageResult> RenderAsync(
        ReadOnlyMemory<byte> axaml,
        CancellationToken cancellationToken);
}
