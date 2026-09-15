using global::Avalonia;
using global::Avalonia.Headless;

namespace TP.Avalonia.Rendering;

public static class RenderAppBuilder
{
    public static AppBuilder BuildAvaloniaApp() =>
        AppBuilder.Configure<RenderApp>()
            .UseSkia()
            .UseHarfBuzz()
            .WithInterFont()
            .With(new global::Avalonia.Media.FontManagerOptions
            {
                DefaultFamilyName = "fonts:Inter#Inter"
            })
            .UseHeadless(new AvaloniaHeadlessPlatformOptions
            {
                UseHeadlessDrawing = false
            });
}
