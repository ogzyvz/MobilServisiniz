using Dapper;
using Microsoft.Data.SqlClient;
using OtoServis.Api.Models;

namespace OtoServis.Api.Services;

public class PlanFeatureDeniedException(string feature, string message) : Exception(message)
{
    public string Feature { get; } = feature;
    public string Code => "PLAN_FEATURE";
}

public class PlanLimitExceededException(string message) : Exception(message)
{
    public string Code => "PLAN_LIMIT";
}

public class PlanEntitlementsService(DbFactory db, TenantContext tenant)
{
    public async Task<PlanEntitlementsDto?> GetForShopAsync(Guid shopId)
    {
        await using var conn = new SqlConnection(db.ConnectionString);
        await conn.OpenAsync();
        return await QueryAsync(conn, shopId);
    }

    public async Task<PlanEntitlementsDto> RequireCurrentAsync()
    {
        if (!tenant.IsSet)
            throw new UnauthorizedAccessException("Servis seçilmedi.");
        var ent = await GetForShopAsync(tenant.ShopId);
        return ent ?? throw new InvalidOperationException("Paket bilgisi bulunamadı.");
    }

    public async Task RequireFeatureAsync(string feature)
    {
        var ent = await RequireCurrentAsync();
        var ok = feature switch
        {
            "stock" => ent.Features.Stock,
            "suppliers" => ent.Features.Suppliers,
            "staff_performance" => ent.Features.StaffPerformance,
            "ai_ruhsat" => ent.Features.AiRuhsat,
            "ai_invoice" => ent.Features.AiInvoice,
            "api_access" => ent.Features.ApiAccess,
            _ => false,
        };
        if (!ok)
        {
            var msg = feature switch
            {
                "stock" => "Stok yönetimi bu pakette yok. Profesyonel veya Kurumsal pakete yükseltin.",
                "suppliers" => "Tedarikçi / cari bu pakette yok. Profesyonel veya Kurumsal pakete yükseltin.",
                "staff_performance" => "Personel performans raporu bu pakette yok. Profesyonel veya Kurumsal pakete yükseltin.",
                "ai_ruhsat" => "AI ruhsat okuma bu pakette yok.",
                "ai_invoice" => "AI ürün / fatura okuma yalnızca Kurumsal pakette vardır.",
                _ => "Bu özellik mevcut paketinizde yok.",
            };
            throw new PlanFeatureDeniedException(feature, msg);
        }
    }

    public async Task EnsureWorkOrderQuotaAsync()
    {
        var ent = await RequireCurrentAsync();
        if (ent.MaxVehiclesPerMonth is null) return;

        await using var conn = new SqlConnection(db.ConnectionString);
        await conn.OpenAsync();
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var count = await conn.ExecuteScalarAsync<int>(
            @"SELECT COUNT(1) FROM dbo.work_orders
              WHERE shop_id = @shopId AND opened_at >= @monthStart",
            new { shopId = tenant.ShopId, monthStart });

        if (count >= ent.MaxVehiclesPerMonth.Value)
        {
            throw new PlanLimitExceededException(
                $"Aylık araç / iş emri limitine ({ent.MaxVehiclesPerMonth}) ulaşıldı. " +
                "Profesyonel veya Kurumsal pakete yükselterek sınırsız kayıt açabilirsiniz.");
        }
    }

    public static async Task<PlanEntitlementsDto?> QueryAsync(SqlConnection conn, Guid shopId)
    {
        var row = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT p.code AS PlanCode, p.label AS PlanLabel, p.monthly_price AS MonthlyPrice,
                     COALESCE(s.max_users, p.max_users) AS MaxUsers,
                     p.max_vehicles_per_month AS MaxVehiclesPerMonth,
                     CAST(p.feature_stock AS bit) AS Stock,
                     CAST(p.feature_suppliers AS bit) AS Suppliers,
                     CAST(p.feature_staff_performance AS bit) AS StaffPerformance,
                     CAST(p.feature_ai_ruhsat AS bit) AS AiRuhsat,
                     CAST(p.feature_ai_invoice AS bit) AS AiInvoice,
                     CAST(p.feature_api_access AS bit) AS ApiAccess
              FROM dbo.shops s
              INNER JOIN dbo.ref_subscription_plans p ON p.code = s.subscription_plan
              WHERE s.id = @shopId",
            new { shopId });
        if (row is null) return null;

        return new PlanEntitlementsDto(
            (string)row.PlanCode,
            (string)row.PlanLabel,
            (decimal)row.MonthlyPrice,
            (int?)row.MaxUsers,
            (int?)row.MaxVehiclesPerMonth,
            new PlanFeaturesDto(
                (bool)row.Stock,
                (bool)row.Suppliers,
                (bool)row.StaffPerformance,
                (bool)row.AiRuhsat,
                (bool)row.AiInvoice,
                (bool)row.ApiAccess));
    }
}
