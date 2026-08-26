using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using OtoServis.Admin.Models;

namespace OtoServis.Admin.Services;

public class AuthService(DbFactory db)
{
    public async Task<(Guid UserId, string FullName, ShopOption Shop)?> ValidateAsync(
        string identifier, string password)
    {
        await using var conn = await db.OpenAsync();

        var login = identifier?.Trim() ?? "";
        if (login.Length < 3) return null;

        var hash = PasswordHasher.Hash(password);
        var phoneDigits = DigitsOnly(login);
        var user = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT id, full_name AS FullName, password_hash AS PasswordHash, default_shop_id AS DefaultShopId
              FROM dbo.users
              WHERE is_active = 1
                AND (
                  phone = @login
                  OR (@phoneDigits <> N'' AND REPLACE(REPLACE(REPLACE(phone, N' ', N''), N'-', N''), N'+', N'') = @phoneDigits)
                  OR (username IS NOT NULL AND LOWER(username) = LOWER(@login))
                )",
            new { login, phoneDigits });

        if (user is null || (string)user.PasswordHash != hash) return null;

        var userId = (Guid)user.id;
        var shops = (await conn.QueryAsync<ShopOption>(
            @"SELECT shop_id AS ShopId, tenant_code AS TenantCode, shop_name AS ShopName,
                     city AS City, role AS Role, CAST(is_default AS bit) AS IsDefault
              FROM dbo.vw_UserShops
              WHERE user_id = @userId
              ORDER BY is_default DESC, shop_name",
            new { userId })).ToList();
        if (shops.Count == 0) return null;

        Guid? defaultShopId = user.DefaultShopId as Guid?;
        var membership = shops.FirstOrDefault(s => s.IsDefault)
                         ?? (defaultShopId.HasValue
                             ? shops.FirstOrDefault(s => s.ShopId == defaultShopId.Value)
                             : null)
                         ?? shops[0];

        var license = await ShopLicenseHelper.GetForShopAsync(conn, membership.ShopId)
            ?? ShopLicenseHelper.Evaluate("unlimited", null);
        if (license.LicenseStatus == "expired")
            throw new ShopLicenseExpiredException();

        await conn.ExecuteAsync(
            "UPDATE dbo.users SET default_shop_id = @shopId, last_login_at = SYSUTCDATETIME() WHERE id = @userId",
            new { shopId = membership.ShopId, userId });

        return (userId, (string)user.FullName, membership);
    }

    public async Task<AdminShopLicense?> GetShopLicenseAsync(Guid shopId)
    {
        await using var conn = await db.OpenAsync();
        return await ShopLicenseHelper.GetForShopAsync(conn, shopId);
    }

    public async Task<ShopOption?> GetShopMembershipAsync(Guid userId, Guid shopId)
    {
        await using var conn = await db.OpenAsync();
        return await GetShopMembershipAsync(conn, userId, shopId);
    }

    private static async Task<ShopOption?> GetShopMembershipAsync(
        Microsoft.Data.SqlClient.SqlConnection conn, Guid userId, Guid shopId)
    {
        return await conn.QuerySingleOrDefaultAsync<ShopOption>(
            @"SELECT shop_id AS ShopId, tenant_code AS TenantCode, shop_name AS ShopName,
                     city AS City, role AS Role, CAST(is_default AS bit) AS IsDefault
              FROM dbo.vw_UserShops
              WHERE user_id = @userId AND shop_id = @shopId",
            new { userId, shopId });
    }

    private static string DigitsOnly(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var chars = value.Where(char.IsDigit).ToArray();
        if (chars.Length < 7 || chars.Length < value.Count(c => !char.IsWhiteSpace(c)) * 0.7)
            return "";
        return new string(chars);
    }

    public static ClaimsPrincipal BuildPrincipal(Guid userId, string fullName, ShopOption shop)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, fullName),
            new(ClaimTypes_.ShopId, shop.ShopId.ToString()),
            new(ClaimTypes_.ShopRole, shop.Role),
            new(ClaimTypes_.ShopName, shop.ShopName),
            new(ClaimTypes_.TenantCode, shop.TenantCode),
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
