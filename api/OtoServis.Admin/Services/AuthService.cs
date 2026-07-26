using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using OtoServis.Admin.Models;

namespace OtoServis.Admin.Services;

public class AuthService(DbFactory db)
{
    public async Task<(Guid UserId, string FullName, ShopOption Shop)?> ValidateAsync(
        string tenantCode, string phone, string password)
    {
        await using var conn = await db.OpenAsync();

        var shop = await ResolveShopAsync(conn, tenantCode);
        if (shop is null) return null;

        var hash = PasswordHasher.Hash(password);
        var user = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT id, full_name AS FullName, password_hash AS PasswordHash
              FROM dbo.users WHERE phone = @phone AND is_active = 1",
            new { phone = phone.Trim() });

        if (user is null || (string)user.PasswordHash != hash) return null;

        var userId = (Guid)user.id;
        var membership = await GetShopMembershipAsync(conn, userId, shop.ShopId);
        if (membership is null) return null;

        await conn.ExecuteAsync(
            "UPDATE dbo.users SET default_shop_id = @shopId, last_login_at = SYSUTCDATETIME() WHERE id = @userId",
            new { shopId = shop.ShopId, userId });

        return (userId, (string)user.FullName, membership);
    }

    public async Task<ShopPreview?> LookupTenantAsync(string tenantCode)
    {
        await using var conn = await db.OpenAsync();
        var shop = await ResolveShopAsync(conn, tenantCode);
        return shop is null ? null : new ShopPreview(shop.TenantCode, shop.ShopName, shop.City);
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

    private static async Task<ResolvedShop?> ResolveShopAsync(
        Microsoft.Data.SqlClient.SqlConnection conn, string tenantCode)
    {
        if (string.IsNullOrWhiteSpace(tenantCode)) return null;
        return await conn.QuerySingleOrDefaultAsync<ResolvedShop>(
            @"SELECT id AS ShopId, tenant_code AS TenantCode, name AS ShopName, city AS City
              FROM dbo.shops
              WHERE UPPER(tenant_code) = UPPER(@code) AND is_active = 1",
            new { code = tenantCode.Trim() });
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

    private sealed class ResolvedShop
    {
        public Guid ShopId { get; init; }
        public string TenantCode { get; init; } = "";
        public string ShopName { get; init; } = "";
        public string? City { get; init; }
    }
}

public record ShopPreview(string TenantCode, string ShopName, string? City);
