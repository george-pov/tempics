using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Identity.Web;

namespace TP.AzureFunctions.Auth;

public static class AuthRegistration
{
    public static IServiceCollection AddApiAuth(
        this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(AuthOptions.SectionName);
        services.AddOptions<AuthOptions>()
            .Bind(section)
            .Validate(options => Guid.TryParse(options.TenantId, out var id) && id != Guid.Empty,
                "Auth:TenantId must be a tenant GUID.")
            .Validate(options => Guid.TryParse(options.ClientId, out var id) && id != Guid.Empty,
                "Auth:ClientId must be the API application GUID.")
            .Validate(options => IsHttpsUrl(options.Instance), "Auth:Instance must be an HTTPS URL.")
            .Validate(options => IsHttpsUrl(options.Issuer), "Auth:Issuer must be an HTTPS URL.")
            .ValidateOnStart();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddMicrosoftIdentityWebApi(configuration, configSectionName: AuthOptions.SectionName);
        services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.MapInboundClaims = false;
            options.IncludeErrorDetails = false;
            // External ID discovery uses a tenant-name host; its issuer uses a tenant-GUID host.
            options.TokenValidationParameters.ValidIssuer = section[nameof(AuthOptions.Issuer)];
            var onValidated = options.Events.OnTokenValidated;
            options.Events.OnTokenValidated = async context =>
            {
                await onValidated(context);
                var caller = context.Principal;
                if (caller is null ||
                    caller.FindFirst("tid")?.Value != section[nameof(AuthOptions.TenantId)] ||
                    caller.FindFirst("ver")?.Value != "2.0" ||
                    !Guid.TryParse(caller.FindFirst("oid")?.Value, out var objectId) ||
                    objectId == Guid.Empty)
                {
                    context.Fail("Invalid caller identity.");
                }
            };
        });
        return services;
    }

    private static bool IsHttpsUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Scheme == Uri.UriSchemeHttps &&
        string.IsNullOrEmpty(uri.UserInfo) &&
        string.IsNullOrEmpty(uri.Query) &&
        string.IsNullOrEmpty(uri.Fragment);
}
