using System.Xml.Linq;
using TP.Avalonia.Rendering;
using Xunit;

namespace TP.Api.Tests.Rendering;

public sealed class BundledTemplateSourceTests(RenderFixture fixture)
{
    [Fact]
    public async Task LoadAsync_EmbeddedSample_ReturnsTrustedAxaml()
    {
        const string resourceName = "TP.Avalonia.Templates.Sample.axaml";
        var assembly = typeof(BundledTemplateSource).Assembly;
        Assert.Equal(resourceName, BundledTemplateSource.ResourceName);
        Assert.Contains(resourceName, assembly.GetManifestResourceNames());
        using var resource = assembly.GetManifestResourceStream(resourceName);
        Assert.NotNull(resource);
        using var embedded = new MemoryStream();
        await resource.CopyToAsync(embedded, TestContext.Current.CancellationToken);

        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);

        Assert.False(axaml.IsEmpty);
        Assert.Equal(embedded.ToArray(), axaml.ToArray());
        using var stream = new MemoryStream(axaml.ToArray(), writable: false);
        var root = Assert.IsType<XElement>(XDocument.Load(stream).Root);
        Assert.Equal("https://github.com/avaloniaui", root.Name.NamespaceName);
        Assert.Equal(1200d, (double?)root.Attribute("Width"));
        Assert.Equal(630d, (double?)root.Attribute("Height"));

        string[] blocked = ["http:", "https:", "file:", "avares:", "resm:", "{Binding", "{StaticResource", "{DynamicResource"];
        foreach (var element in root.DescendantsAndSelf())
        {
            Assert.DoesNotContain("Binding", element.Name.LocalName, StringComparison.OrdinalIgnoreCase);
            foreach (var attribute in element.Attributes().Where(attribute => !attribute.IsNamespaceDeclaration))
            {
                Assert.NotEqual("Class", attribute.Name.LocalName);
                foreach (var value in blocked)
                {
                    Assert.DoesNotContain(value, attribute.Value, StringComparison.OrdinalIgnoreCase);
                }
            }
        }
    }

    [Fact]
    public async Task LoadAsync_RequestCanceled_ThrowsOperationCanceledException()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            fixture.Source.LoadAsync(cancellation.Token).AsTask());

        Assert.Equal(cancellation.Token, failure.CancellationToken);
    }
}
