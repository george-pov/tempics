using Azure;
using Azure.Data.Tables;
using TP.Application.Templates;

namespace TP.TableStorage.Templates;

public sealed class TemplateEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;

    public string RowKey { get; set; } = string.Empty;

    public DateTimeOffset? Timestamp { get; set; }

    public ETag ETag { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Template { get; set; } = string.Empty;

    public static TemplateEntity FromTemplate(ImageTemplate template)
    {
        var userId = template.UserId.ToString("D");
        return new TemplateEntity
        {
            PartitionKey = userId,
            RowKey = template.Id.ToString("D"),
            UserId = userId,
            Name = template.Name,
            Template = template.Template
        };
    }
}
