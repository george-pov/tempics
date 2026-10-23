using System.Security.Claims;

namespace TP.AzureFunctions.Auth;

public static class TemplateCaller
{
    public static Guid GetUserId(ClaimsPrincipal caller)
    {
        if (caller.Identity?.IsAuthenticated != true ||
            !Guid.TryParse(caller.FindFirst("oid")?.Value, out var userId) ||
            userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("A validated caller is required.");
        }

        return userId;
    }
}
