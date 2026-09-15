using global::Avalonia.Controls;
using global::Avalonia.Headless;
using global::Avalonia.Markup.Xaml;
using global::Avalonia.Media;
using global::Avalonia.Media.Imaging;
using TP.Application.Rendering;

namespace TP.Avalonia.Rendering;

public sealed class AvaloniaAxamlRenderer(AvaloniaRenderHost renderHost) : IAxamlRenderer
{
    public const int ImageWidth = 1200;
    public const int ImageHeight = 630;
    public const int MaxPngBytes = 5 * 1024 * 1024;

    public async Task<RenderImageResult> RenderAsync(
        ReadOnlyMemory<byte> axaml,
        CancellationToken cancellationToken)
    {
        try
        {
            return await renderHost.DispatchAsync(
                () => Render(axaml), cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
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

    private static RenderImageResult Render(ReadOnlyMemory<byte> axaml)
    {
        using var input = new MemoryStream(axaml.ToArray(), writable: false);
        var loaded = AvaloniaRuntimeXamlLoader.Load(
            input, localAssembly: typeof(AvaloniaAxamlRenderer).Assembly);

        if (loaded is not Control control ||
            !double.IsFinite(control.Width) || !double.IsFinite(control.Height) ||
            control.Width != ImageWidth || control.Height != ImageHeight)
        {
            throw new RenderImageException();
        }

        if (!FontManager.Current.TryGetGlyphTypeface(
                new Typeface(new FontFamily("fonts:Inter#Inter")), out _))
        {
            throw new RenderImageException();
        }

        var window = new Window
        {
            Width = ImageWidth,
            Height = ImageHeight,
            CanResize = false,
            WindowDecorations = WindowDecorations.None,
            ShowInTaskbar = false,
            Content = control
        };

        try
        {
            window.Show();

            using var bitmap = window.CaptureRenderedFrame()
                ?? throw new RenderImageException();
            if (bitmap.PixelSize.Width != ImageWidth || bitmap.PixelSize.Height != ImageHeight)
            {
                throw new RenderImageException();
            }

            using var output = new MemoryStream();
            bitmap.Save(output, PngBitmapEncoderOptions.Default);
            if (output.Length == 0 || output.Length > MaxPngBytes)
            {
                throw new RenderImageException();
            }

            return new RenderImageResult(output.ToArray());
        }
        finally
        {
            window.Close();
        }
    }
}
