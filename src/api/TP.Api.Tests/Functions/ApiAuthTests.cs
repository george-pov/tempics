using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using TP.AzureFunctions.Auth;
using Xunit;

namespace TP.Api.Tests.Functions;

public sealed class ApiAuthTests : IDisposable
{
    private const string Tenant = "11111111-1111-1111-1111-111111111111";
    private const string Audience = "22222222-2222-2222-2222-222222222222";
    private const string Issuer = "https://" + Tenant + ".ciamlogin.com/" + Tenant + "/v2.0";
    private readonly RSA _rsa = RSA.Create(2048);
    private readonly RsaSecurityKey _key;
    private readonly ServiceProvider _services;

    public ApiAuthTests()
    {
        _key = new RsaSecurityKey(_rsa) { KeyId = "fixture-key" };
        var services = new ServiceCollection();
        services.AddLogging();
        // Exercise production DI and validation; replace only remote metadata discovery.
        var configuration = Configuration();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddApiAuth(configuration);
        services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            var metadata = new OpenIdConnectConfiguration { Issuer = Issuer };
            metadata.SigningKeys.Add(_key);
            options.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(metadata);
        });
        _services = services.BuildServiceProvider();
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("malformed")]
    [InlineData("wrong-audience")]
    [InlineData("wrong-issuer")]
    [InlineData("wrong-tenant")]
    [InlineData("wrong-version")]
    [InlineData("missing-object-id")]
    [InlineData("expired")]
    [InlineData("future")]
    [InlineData("wrong-signature")]
    [InlineData("unsigned")]
    [InlineData("id-token")]
    [InlineData("function-key")]
    public async Task Invoke_InvalidToken_RejectsBeforeRender(string scenario)
    {
        var http = NewHttpContext(scenario);
        var invoked = false;

        await new BearerTokenMiddleware().Invoke(new HttpFunctionContext(http), _ =>
        {
            invoked = true;
            return Task.CompletedTask;
        });

        Assert.False(invoked);
        Assert.Equal(StatusCodes.Status401Unauthorized, http.Response.StatusCode);
        Assert.Equal("Bearer", http.Response.Headers.WWWAuthenticate.ToString());
        Assert.Equal(0, http.Response.Body.Length);
        Assert.False(http.User.Identity?.IsAuthenticated ?? false);
    }

    [Theory]
    [InlineData("wrong-scope")]
    [InlineData("partial-scope")]
    [InlineData("case-scope")]
    [InlineData("app-only")]
    public async Task Invoke_MissingScope_ReturnsForbidden(string scenario)
    {
        var http = NewHttpContext(scenario);
        var invoked = false;

        await new BearerTokenMiddleware().Invoke(new HttpFunctionContext(http), _ =>
        {
            invoked = true;
            return Task.CompletedTask;
        });

        Assert.False(invoked);
        Assert.Equal(StatusCodes.Status403Forbidden, http.Response.StatusCode);
        Assert.Equal(0, http.Response.Body.Length);
    }

    [Theory]
    [InlineData("valid")]
    [InlineData("multiple-scopes")]
    public async Task Invoke_ValidScope_EstablishesCallerAndRuns(string scenario)
    {
        var http = NewHttpContext(scenario);
        var invoked = false;

        await new BearerTokenMiddleware().Invoke(new HttpFunctionContext(http), _ =>
        {
            invoked = true;
            Assert.True(http.User.Identity?.IsAuthenticated);
            Assert.Equal(Tenant, http.User.FindFirst("tid")?.Value);
            Assert.Equal("33333333-3333-3333-3333-333333333333", http.User.FindFirst("oid")?.Value);
            return Task.CompletedTask;
        });

        Assert.True(invoked);
        Assert.Equal(StatusCodes.Status200OK, http.Response.StatusCode);
    }

    [Theory]
    [InlineData("Instance", "http://issuer.example.test/")]
    [InlineData("TenantId", "common")]
    [InlineData("ClientId", "")]
    [InlineData("Issuer", "")]
    public void Validate_InvalidSettings_FailsStartup(string setting, string value)
    {
        var configuration = Configuration();
        configuration["Auth:" + setting] = value;
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApiAuth(configuration);
        using var provider = services.BuildServiceProvider();

        Assert.Throws<OptionsValidationException>(() =>
            provider.GetRequiredService<IStartupValidator>().Validate());
    }

    private DefaultHttpContext NewHttpContext(string scenario)
    {
        var http = new DefaultHttpContext { RequestServices = _services };
        http.Response.Body = new MemoryStream();
        if (scenario == "function-key")
        {
            http.Request.Headers["x-functions-key"] = "fixture-obsolete-key";
        }
        else if (scenario != "missing")
        {
            http.Request.Headers.Authorization = "Bearer " +
                (scenario == "malformed" ? "not-a-token" : IssueToken(scenario));
        }
        return http;
    }

    private string IssueToken(string scenario)
    {
        using var otherRsa = RSA.Create(2048);
        var key = scenario == "wrong-signature" ? new RsaSecurityKey(otherRsa) : _key;
        var now = DateTime.UtcNow;
        var claims = new Dictionary<string, object>
        {
            ["tid"] = scenario == "wrong-tenant" ? "44444444-4444-4444-4444-444444444444" : Tenant,
            ["oid"] = "33333333-3333-3333-3333-333333333333",
            ["ver"] = scenario == "wrong-version" ? "1.0" : "2.0",
            ["scp"] = scenario switch
            {
                "wrong-scope" => "Images.Read",
                "partial-scope" => "Images.Render.All",
                "case-scope" => "images.render",
                "multiple-scopes" => "Images.Read Images.Render",
                _ => "Images.Render"
            }
        };
        if (scenario is "id-token" or "app-only") claims.Remove("scp");
        if (scenario == "missing-object-id") claims.Remove("oid");
        if (scenario == "app-only") claims["roles"] = new[] { "Images.Render" };
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = scenario == "wrong-issuer" ? "https://attacker.example.test/" + Tenant + "/v2.0" : Issuer,
            Audience = scenario is "wrong-audience" or "id-token" ? "55555555-5555-5555-5555-555555555555" : Audience,
            Claims = claims,
            IssuedAt = now.AddMinutes(-20),
            NotBefore = scenario == "future" ? now.AddMinutes(20) : now.AddMinutes(-20),
            Expires = scenario == "expired" ? now.AddMinutes(-10) : now.AddMinutes(30),
            SigningCredentials = scenario == "unsigned" ? null : new SigningCredentials(key, SecurityAlgorithms.RsaSha256)
        });
    }

    private static IConfigurationRoot Configuration() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Auth:Instance"] = "https://fixture.ciamlogin.com/",
            ["Auth:TenantId"] = Tenant,
            ["Auth:ClientId"] = Audience,
            ["Auth:Issuer"] = Issuer
        }).Build();

    public void Dispose()
    {
        _services.Dispose();
        _rsa.Dispose();
    }

    private sealed class HttpFunctionContext : FunctionContext
    {
        public HttpFunctionContext(HttpContext http) => Items["HttpRequestContext"] = http;
        public override string InvocationId => "fixture-invocation";
        public override string FunctionId => "fixture-function";
        public override TraceContext TraceContext => throw new NotSupportedException();
        public override BindingContext BindingContext => throw new NotSupportedException();
        public override RetryContext RetryContext => throw new NotSupportedException();
        public override IServiceProvider InstanceServices { get; set; } = null!;
        public override FunctionDefinition FunctionDefinition => throw new NotSupportedException();
        public override IDictionary<object, object> Items { get; set; } = new Dictionary<object, object>();
        public override IInvocationFeatures Features => throw new NotSupportedException();
    }
}
