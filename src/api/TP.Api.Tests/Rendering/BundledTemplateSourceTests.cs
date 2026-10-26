using System.Xml.Linq;
using TP.Avalonia.Rendering;
using Xunit;

namespace TP.Api.Tests.Rendering;

public sealed class BundledTemplateSourceTests(RenderFixture fixture)
{
    private const string SampleResourceName = "TP.Avalonia.Templates.Sample.axaml";
    private const string BackgroundUri = "avares://TP.Avalonia/Templates/Background.png";

    [Fact]
    public async Task LoadAsync_EmbeddedSample_MatchesResourceBytes()
    {
        var assembly = typeof(BundledTemplateSource).Assembly;
        Assert.Equal(SampleResourceName, BundledTemplateSource.ResourceName);
        Assert.Contains(SampleResourceName, assembly.GetManifestResourceNames());
        using var resource = assembly.GetManifestResourceStream(SampleResourceName);
        Assert.NotNull(resource);
        using var embedded = new MemoryStream();
        await resource.CopyToAsync(embedded, TestContext.Current.CancellationToken);

        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);

        Assert.False(axaml.IsEmpty);
        Assert.Equal(embedded.ToArray(), axaml.ToArray());
    }

    [Fact]
    public async Task LoadAsync_EmbeddedSample_UsesBundledBackground()
    {
        var root = await LoadRootAsync();
        Assert.Equal("https://github.com/avaloniaui", root.Name.NamespaceName);
        Assert.Equal(1200d, (double?)root.Attribute("Width"));
        Assert.Equal(630d, (double?)root.Attribute("Height"));

        var background = Assert.Single(root.Descendants(root.Name.Namespace + "ImageBrush"));
        Assert.Equal(BackgroundUri, (string?)background.Attribute("Source"));
        var backgroundExists = await fixture.Host.DispatchAsync(
            () => global::Avalonia.Platform.AssetLoader.Exists(new Uri(BackgroundUri)),
            TestContext.Current.CancellationToken)
            .WaitAsync(RenderFixture.Timeout, TestContext.Current.CancellationToken);
        Assert.True(backgroundExists);
    }

    [Fact]
    public async Task LoadAsync_EmbeddedSample_ExcludesExternalReferences()
    {
        var root = await LoadRootAsync();
        var background = Assert.Single(root.Descendants(root.Name.Namespace + "ImageBrush"));

        string[] blocked = ["http:", "https:", "file:", "avares:", "resm:", "{Binding", "{StaticResource", "{DynamicResource"];
        Assert.All(root.DescendantsAndSelf(), element =>
            Assert.DoesNotContain("Binding", element.Name.LocalName, StringComparison.OrdinalIgnoreCase));

        var attributes = root.DescendantsAndSelf()
            .SelectMany(element => element.Attributes()
                .Where(attribute => !attribute.IsNamespaceDeclaration)
                .Select(attribute => (element, attribute)));
        foreach (var (element, attribute) in attributes)
        {
            Assert.NotEqual("Class", attribute.Name.LocalName);
            if (element == background && attribute.Name.LocalName == "Source")
            {
                // Only this fixed, assembly-bundled image URI is trusted.
                Assert.Equal(BackgroundUri, attribute.Value);
                continue;
            }

            Assert.All(blocked, value =>
                Assert.DoesNotContain(value, attribute.Value, StringComparison.OrdinalIgnoreCase));
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

    private async Task<XElement> LoadRootAsync()
    {
        var axaml = await fixture.Source.LoadAsync(TestContext.Current.CancellationToken);
        using var stream = new MemoryStream(axaml.ToArray(), writable: false);
        return Assert.IsType<XElement>(XDocument.Load(stream).Root);
    }
}
