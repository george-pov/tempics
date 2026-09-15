using TP.Application.Rendering;

namespace TP.Avalonia.Rendering;

public sealed class BundledTemplateSource : IBundledTemplateSource
{
    public const string ResourceName = "TP.Avalonia.Templates.Sample.axaml";

    private readonly Lazy<byte[]> _sample = new(LoadResource);

    public ValueTask<ReadOnlyMemory<byte>> LoadAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var bytes = _sample.Value;
        cancellationToken.ThrowIfCancellationRequested();

        // A snapshot also protects the cache from callers using MemoryMarshal.
        return ValueTask.FromResult<ReadOnlyMemory<byte>>(bytes.AsSpan().ToArray());
    }

    private static byte[] LoadResource()
    {
        try
        {
            using var resource = typeof(BundledTemplateSource).Assembly
                .GetManifestResourceStream(ResourceName)
                ?? throw new RenderImageException();
            using var buffer = new MemoryStream();
            resource.CopyTo(buffer);

            if (buffer.Length == 0)
            {
                throw new RenderImageException();
            }

            return buffer.ToArray();
        }
        catch (RenderImageException)
        {
            throw;
        }
        catch (Exception exception)
        {
            throw new RenderImageException(exception);
        }
    }
}
