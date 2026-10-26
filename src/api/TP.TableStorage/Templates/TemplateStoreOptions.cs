namespace TP.TableStorage.Templates;

public sealed class TemplateStoreOptions
{
    public const string SectionName = "TemplateStore";

    public const string TableName = "Templates";

    public string? ConnectionString { get; set; }

    public string? TableServiceUri { get; set; }

    public bool CreateResourcesIfMissing { get; set; }
}
