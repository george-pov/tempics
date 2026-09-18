namespace TP.AzureFunctions.Auth;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";
    public const string RenderScope = "Images.Render";

    public string Instance { get; init; } = string.Empty;
    public string TenantId { get; init; } = string.Empty;
    public string ClientId { get; init; } = string.Empty;
    public string Issuer { get; init; } = string.Empty;
}
