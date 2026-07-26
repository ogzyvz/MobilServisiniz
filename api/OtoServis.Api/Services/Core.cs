using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace OtoServis.Api.Services;

public class TenantContext
{
    public Guid UserId { get; private set; }
    public Guid ShopId { get; private set; }
    public string Role { get; private set; } = "";
    public bool IsSet { get; private set; }

    public void Set(Guid userId, Guid shopId, string role)
    {
        UserId = userId;
        ShopId = shopId;
        Role = role;
        IsSet = true;
    }
}

public static class PasswordHasher
{
    private const string Salt = "otoservis::v1";

    public static string Hash(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{Salt}:{password}"));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public class DbFactory(IConfiguration config)
{
    public string ConnectionString =>
        config.GetConnectionString("Default")
        ?? throw new InvalidOperationException("Connection string bulunamadı.");
}

public static class ClaimTypes_
{
    public const string ShopId = "shop_id";
    public const string Role = "shop_role";
}

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static Guid? GetShopId(this ClaimsPrincipal user)
    {
        var v = user.FindFirstValue(ClaimTypes_.ShopId);
        return v is null ? null : Guid.Parse(v);
    }

    public static string? GetShopRole(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes_.Role);
}
