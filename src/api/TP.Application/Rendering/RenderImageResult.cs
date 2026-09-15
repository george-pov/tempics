namespace TP.Application.Rendering;

// The renderer transfers ownership of this buffer to the application response.
public sealed record RenderImageResult(byte[] PngBytes);
