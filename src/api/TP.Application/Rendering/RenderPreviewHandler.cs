using System.Text;

namespace TP.Application.Rendering;

public sealed class RenderPreviewHandler(
    IAxamlRenderer renderer)
{
    public const int MaxTemplateLength = 2_048;

    public async Task<RenderImageResult> HandleAsync(
        RenderPreviewQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(query.Template))
        {
            throw new PreviewInputException(PreviewInputError.Invalid);
        }

        if (query.Template.Length > MaxTemplateLength)
        {
            throw new PreviewInputException(PreviewInputError.TooLarge);
        }

        var axaml = Encoding.UTF8.GetBytes(query.Template);
        cancellationToken.ThrowIfCancellationRequested();
        var result = await renderer.RenderAsync(axaml, cancellationToken);

        if (result?.PngBytes is not { Length: > 0 })
        {
            throw new RenderImageException();
        }

        return result;
    }
}
