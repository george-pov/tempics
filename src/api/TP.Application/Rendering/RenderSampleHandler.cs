namespace TP.Application.Rendering;

public sealed class RenderSampleHandler(
    IBundledTemplateSource templateSource,
    IAxamlRenderer renderer)
{
    public async Task<RenderImageResult> HandleAsync(
        RenderSampleQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var axaml = await templateSource.LoadAsync(cancellationToken);
        var result = await renderer.RenderAsync(axaml, cancellationToken);

        if (result?.PngBytes is not { Length: > 0 })
        {
            throw new RenderImageException();
        }

        return result;
    }
}
