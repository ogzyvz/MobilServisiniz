using Dapper;
using Microsoft.Data.SqlClient;

namespace OtoServis.Admin.Services;

public record AdminShopLicense(string LicenseType, DateTime? LicenseExpiresAt, string LicenseStatus, int? DaysRemaining);

public static class ShopLicenseHelper
{
    public const int WarningDays = 7;

    public static AdminShopLicense Evaluate(string? licenseType, DateTime? expiresAt)
    {
        var type = string.IsNullOrWhiteSpace(licenseType) ? "unlimited" : licenseType.Trim().ToLowerInvariant();
        if (type == "unlimited" || expiresAt is null)
            return new AdminShopLicense(type, null, "active", null);

        var todayTr = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var expDay = DateOnly.FromDateTime(expiresAt.Value);
        var days = expDay.DayNumber - todayTr.DayNumber;
        if (days < 0) return new AdminShopLicense(type, expiresAt, "expired", days);
        if (days <= WarningDays) return new AdminShopLicense(type, expiresAt, "warning", days);
        return new AdminShopLicense(type, expiresAt, "active", days);
    }

    public static async Task<AdminShopLicense?> GetForShopAsync(SqlConnection conn, Guid shopId)
    {
        var row = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT license_type AS LicenseType, license_expires_at AS LicenseExpiresAt
              FROM dbo.shops WHERE id = @shopId",
            new { shopId });
        if (row is null) return null;
        return Evaluate((string?)row.LicenseType, (DateTime?)row.LicenseExpiresAt);
    }
}

public class ShopLicenseExpiredException()
    : Exception("Servis lisans süreniz dolmuştur. Yenileme için lütfen iletişime geçin.");
