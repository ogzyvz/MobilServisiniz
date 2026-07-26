using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using OtoServis.Api.Models;

namespace OtoServis.Api.Services;

public class AuthService(DbFactory db, IConfiguration config)
{
    public async Task<AuthResponse?> LoginAsync(string tenantCode, string phone, string password)
    {
        await using var conn = new SqlConnection(db.ConnectionString);
        var shop = await ResolveShopAsync(conn, tenantCode);
        if (shop is null) return null;

        var hash = PasswordHasher.Hash(password);
        var user = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT id, full_name AS FullName, phone, email, password_hash AS PasswordHash
              FROM dbo.users WHERE phone = @phone AND is_active = 1",
            new { phone = phone.Trim() });

        if (user is null || (string)user.PasswordHash != hash) return null;

        var userId = (Guid)user.id;
        var shops = await GetUserShopsAsync(conn, userId);
        var active = shops.FirstOrDefault(s => s.ShopId == shop.ShopId);
        if (active is null) return null;

        await conn.ExecuteAsync(
            "UPDATE dbo.users SET default_shop_id = @shopId, last_login_at = SYSUTCDATETIME() WHERE id = @userId",
            new { shopId = shop.ShopId, userId });

        var token = CreateToken(userId, (string)user.FullName, shop.ShopId, active.Role);

        return new AuthResponse(
            token,
            new UserDto(userId, (string)user.FullName, (string)user.phone, user.email as string),
            shops,
            active);
    }

    public async Task<ShopPreviewDto?> LookupTenantAsync(string tenantCode)
    {
        await using var conn = new SqlConnection(db.ConnectionString);
        var shop = await ResolveShopAsync(conn, tenantCode);
        return shop is null ? null : new ShopPreviewDto(shop.ShopId, shop.TenantCode, shop.ShopName, shop.City);
    }

    public async Task<AuthResponse?> SelectShopAsync(Guid userId, Guid shopId)
    {
        await using var conn = new SqlConnection(db.ConnectionString);
        var membership = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT su.role, u.full_name AS FullName, u.phone, u.email
              FROM dbo.shop_users su
              INNER JOIN dbo.users u ON u.id = su.user_id
              WHERE su.user_id = @userId AND su.shop_id = @shopId AND su.is_active = 1 AND u.is_active = 1",
            new { userId, shopId });

        if (membership is null) return null;

        await conn.ExecuteAsync(
            "UPDATE dbo.users SET default_shop_id = @shopId, last_login_at = SYSUTCDATETIME() WHERE id = @userId",
            new { shopId, userId });

        var shops = await GetUserShopsAsync(conn, userId);
        var active = shops.First(s => s.ShopId == shopId);
        var token = CreateToken(userId, (string)membership.FullName, shopId, (string)membership.role);

        return new AuthResponse(
            token,
            new UserDto(userId, (string)membership.FullName, (string)membership.phone, membership.email as string),
            shops,
            active);
    }

    public async Task<bool> ValidateShopAccessAsync(Guid userId, Guid shopId)
    {
        await using var conn = new SqlConnection(db.ConnectionString);
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.shop_users WHERE user_id=@userId AND shop_id=@shopId AND is_active=1",
            new { userId, shopId }) > 0;
    }

    private static async Task<ResolvedShop?> ResolveShopAsync(SqlConnection conn, string tenantCode)
    {
        if (string.IsNullOrWhiteSpace(tenantCode)) return null;
        return await conn.QuerySingleOrDefaultAsync<ResolvedShop>(
            @"SELECT id AS ShopId, tenant_code AS TenantCode, name AS ShopName, city AS City
              FROM dbo.shops
              WHERE UPPER(tenant_code) = UPPER(@code) AND is_active = 1",
            new { code = tenantCode.Trim() });
    }

    private static async Task<IReadOnlyList<ShopMembershipDto>> GetUserShopsAsync(SqlConnection conn, Guid userId)
    {
        var rows = await conn.QueryAsync<ShopMembershipDto>(
            @"SELECT shop_id AS ShopId, tenant_code AS TenantCode, slug AS Slug,
                     shop_name AS ShopName, city AS City, role AS Role, title AS Title,
                     is_owner AS IsOwner, CAST(is_default AS bit) AS IsDefault
              FROM dbo.vw_UserShops WHERE user_id = @userId",
            new { userId });
        return rows.ToList();
    }

    private string CreateToken(Guid userId, string fullName, Guid? shopId, string? role)
    {
        var key = config["Jwt:Key"]!;
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, fullName),
        };
        if (shopId.HasValue)
        {
            claims.Add(new Claim(ClaimTypes_.ShopId, shopId.Value.ToString()));
            claims.Add(new Claim(ClaimTypes_.Role, role ?? "personel"));
        }

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(double.Parse(config["Jwt:ExpireHours"] ?? "24")),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private sealed class ResolvedShop
    {
        public Guid ShopId { get; init; }
        public string TenantCode { get; init; } = "";
        public string ShopName { get; init; } = "";
        public string? City { get; init; }
    }
}

public class TenantService(DbFactory db, TenantContext tenant)
{
    public Guid RequireShopId() =>
        tenant.IsSet ? tenant.ShopId : throw new UnauthorizedAccessException("Servis seçilmedi.");

    public Guid RequireUserId() =>
        tenant.IsSet ? tenant.UserId : throw new UnauthorizedAccessException("Oturum gerekli.");

    public async Task<SqlConnection> OpenAsync()
    {
        var conn = new SqlConnection(db.ConnectionString);
        await conn.OpenAsync();
        return conn;
    }
}
