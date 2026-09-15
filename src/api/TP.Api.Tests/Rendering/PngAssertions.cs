using System.Buffers.Binary;
using TP.Avalonia.Rendering;
using Xunit;

namespace TP.Api.Tests.Rendering;

internal static class PngAssertions
{
    public static void IsExpectedPng(byte[] png)
    {
        Assert.InRange(png.Length, 1024, AvaloniaAxamlRenderer.MaxPngBytes);
        Assert.Equal(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }, png[..8]);
        Assert.Equal(13u, BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(8, 4)));
        Assert.Equal("IHDR"u8.ToArray(), png[12..16]);
        Assert.Equal(1200u, BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(16, 4)));
        Assert.Equal(630u, BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(20, 4)));
    }
}
