namespace OtoServis.Platform.Services;

public static class LicenseHelper
{
    public const int WarningDays = 7;

    public static readonly (string Code, string Label)[] Types =
    [
        ("trial", "14 gün deneme"),
        ("monthly", "Aylık"),
        ("yearly", "Yıllık"),
        ("unlimited", "Sınırsız"),
    ];

    public static string TypeLabel(string? code) => code switch
    {
        "trial" => "14 gün deneme",
        "monthly" => "Aylık",
        "yearly" => "Yıllık",
        "unlimited" => "Sınırsız",
        _ => code ?? "-",
    };

    public static (string Status, int? DaysRemaining) Evaluate(string? licenseType, DateTime? expiresAt)
    {
        var type = string.IsNullOrWhiteSpace(licenseType) ? "unlimited" : licenseType.Trim().ToLowerInvariant();
        if (type == "unlimited" || expiresAt is null)
            return ("active", null);

        var todayTr = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var expDay = DateOnly.FromDateTime(expiresAt.Value);
        var days = expDay.DayNumber - todayTr.DayNumber;
        if (days < 0) return ("expired", days);
        if (days <= WarningDays) return ("warning", days);
        return ("active", days);
    }

    public static string StatusLabel(string status, int? days) => status switch
    {
        "expired" => "Süresi doldu",
        "warning" => days is null ? "Bitmek üzere" : $"{days} gün kaldı",
        _ => "Aktif",
    };

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
