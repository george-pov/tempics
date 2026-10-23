namespace TP.TableStorage.Templates;

public sealed class TemplateStoreOptions
{
    public const string SectionName = "TemplateStore";

    public const string TableName = "Templates";

    public string? ConnectionString { get; set; }

    public string? TableServiceUri { get; set; }

    public bool CreateResourcesIfMissing { get; set; }

    public Uri? ResolveUri(bool isDevelopment)
    {
        if (string.IsNullOrWhiteSpace(TableServiceUri))
        {
            if (isDevelopment)
            {
                return null;
            }

            throw new InvalidOperationException("Template storage URI is required.");
        }

        if (!Uri.TryCreate(TableServiceUri.Trim(), UriKind.Absolute, out var uri) ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrEmpty(uri.Host) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            (!isDevelopment && uri.AbsolutePath != "/"))
        {
            throw new InvalidOperationException("Template storage URI is invalid.");
        }

        return uri;
    }
}
