using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace OtoServis.Platform.Services;

public class PlatformAuthService(DbFactory db)
{
    public async Task<(Guid UserId, string FullName)?> ValidateAsync(string phone, string password)
    {
        await using var conn = await db.OpenAsync();
        var hash = PasswordHasher.Hash(password);
        var user = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT id, full_name AS FullName, password_hash AS PasswordHash, is_platform_admin AS IsPlatformAdmin
              FROM dbo.users
              WHERE phone = @phone AND is_active = 1",
            new { phone = phone.Trim() });

        if (user is null || (string)user.PasswordHash != hash) return null;
        if (!IsTruthy(user.IsPlatformAdmin)) return null;

        var userId = (Guid)user.id;
        await conn.ExecuteAsync(
            "UPDATE dbo.users SET last_login_at = SYSUTCDATETIME() WHERE id = @userId",
            new { userId });

        return (userId, (string)user.FullName);
    }

    private static bool IsTruthy(object? value) => value switch
    {
        null => false,
        bool b => b,
        byte by => by != 0,
        short s => s != 0,
        int i => i != 0,
        long l => l != 0,
        _ => Convert.ToBoolean(value),
    };

    public static ClaimsPrincipal BuildPrincipal(Guid userId, string fullName)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, fullName),
            new(PlatformClaims.IsPlatformAdmin, "1"),
            new(ClaimTypes.Role, "platform_admin"),
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }

    public static AuthenticationProperties SessionProps() => new()
    {
        IsPersistent = true,
        ExpiresUtc = DateTimeOffset.UtcNow.AddHours(12),
    };
}
