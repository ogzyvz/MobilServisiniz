using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

namespace OtoServis.Platform.Services;

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

    public async Task<SqlConnection> OpenAsync()
    {
        var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        return conn;
    }
}

public static class PlatformClaims
{
    public const string IsPlatformAdmin = "is_platform_admin";
}

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static bool IsPlatformAdmin(this ClaimsPrincipal user) =>
        user.FindFirstValue(PlatformClaims.IsPlatformAdmin) == "1";
}
