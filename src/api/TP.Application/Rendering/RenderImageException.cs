namespace TP.Application.Rendering;

public sealed class RenderImageException(Exception? innerException = null)
    : Exception("Image rendering failed.", innerException);
