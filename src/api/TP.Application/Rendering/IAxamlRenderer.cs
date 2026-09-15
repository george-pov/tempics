namespace TP.Application.Rendering;

// This POC port accepts only the trusted bundled template. It is not an AXAML sandbox.
public interface IAxamlRenderer
{
    Task<RenderImageResult> RenderAsync(
        ReadOnlyMemory<byte> axaml,
        CancellationToken cancellationToken);
}
