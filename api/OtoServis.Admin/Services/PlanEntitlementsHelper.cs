using Dapper;
using Microsoft.Data.SqlClient;

namespace OtoServis.Admin.Services;

public record AdminPlanFeatures(
    bool Stock,
    bool Suppliers,
    bool StaffPerformance,
    bool AiRuhsat,
    bool AiInvoice,
    bool ApiAccess);

public record AdminPlanEntitlements(
    string PlanCode,
    string PlanLabel,
    int? MaxUsers,
    int? MaxVehiclesPerMonth,
    AdminPlanFeatures Features);

public static class PlanEntitlementsHelper
{
    public static async Task<AdminPlanEntitlements?> GetForShopAsync(SqlConnection conn, Guid shopId)
    {
        var row = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT p.code AS PlanCode, p.label AS PlanLabel,
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
        return new AdminPlanEntitlements(
            (string)row.PlanCode,
            (string)row.PlanLabel,
            (int?)row.MaxUsers,
            (int?)row.MaxVehiclesPerMonth,
            new AdminPlanFeatures(
                (bool)row.Stock,
                (bool)row.Suppliers,
                (bool)row.StaffPerformance,
                (bool)row.AiRuhsat,
                (bool)row.AiInvoice,
                (bool)row.ApiAccess));
    }
}
