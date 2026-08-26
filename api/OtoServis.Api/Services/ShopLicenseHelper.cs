using Dapper;
using Microsoft.Data.SqlClient;
using OtoServis.Api.Models;

namespace OtoServis.Api.Services;

public static class ShopLicenseHelper
{
    public const int WarningDays = 7;
    public const string ExpiredCode = "SHOP_LICENSE_EXPIRED";

    public static ShopLicenseDto Evaluate(string? licenseType, DateTime? expiresAt)
    {
        var type = string.IsNullOrWhiteSpace(licenseType) ? "unlimited" : licenseType.Trim().ToLowerInvariant();
        if (type == "unlimited" || expiresAt is null)
        {
            return new ShopLicenseDto(type, null, "active", null);
        }

        var todayTr = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var expDay = DateOnly.FromDateTime(expiresAt.Value);
        var days = expDay.DayNumber - todayTr.DayNumber;

        if (days < 0)
            return new ShopLicenseDto(type, expiresAt, "expired", days);

        if (days <= WarningDays)
            return new ShopLicenseDto(type, expiresAt, "warning", days);

        return new ShopLicenseDto(type, expiresAt, "active", days);
    }

    public static async Task<ShopLicenseDto?> GetForShopAsync(SqlConnection conn, Guid shopId)
    {
        var row = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT license_type AS LicenseType, license_expires_at AS LicenseExpiresAt
              FROM dbo.shops WHERE id = @shopId",
            new { shopId });
        if (row is null) return null;
        return Evaluate((string?)row.LicenseType, (DateTime?)row.LicenseExpiresAt);
    }

    public static DateTime? ComputeNewExpiry(string licenseType, DateTime? currentExpiry)
    {
        var todayTr = DateTime.UtcNow.AddHours(3).Date;
        var type = licenseType.Trim().ToLowerInvariant();
        return type switch
        {
            "unlimited" => null,
            "trial" => todayTr.AddDays(14),
            "monthly" => BaseFrom(currentExpiry, todayTr).AddMonths(1),
            "yearly" => BaseFrom(currentExpiry, todayTr).AddYears(1),
            _ => throw new ArgumentException("Geçersiz lisans tipi."),
        };
    }

    private static DateTime BaseFrom(DateTime? currentExpiry, DateTime todayTr)
    {
        if (currentExpiry is null) return todayTr;
        var expDay = currentExpiry.Value.Date;
        return expDay >= todayTr ? expDay : todayTr;
    }
}

public class ShopLicenseExpiredException() : Exception("Servis lisans süreniz dolmuştur. Yenileme için lütfen iletişime geçin.");
