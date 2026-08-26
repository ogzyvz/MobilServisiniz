using Dapper;
using Microsoft.Data.SqlClient;

namespace OtoServis.Api.Services;

/// <summary>
/// Müşteri/araç/iş emri üzerinde yapılan önemli işlemleri dbo.audit_log'a
/// insan tarafından okunabilir Türkçe bir açıklamayla kaydeder.
/// Mobilde "Aktivite Geçmişi" olarak müşteri detayında gösterilir.
/// </summary>
public static class ActivityLogService
{
    public static async Task LogAsync(
        SqlConnection conn,
        Guid shopId,
        Guid? userId,
        string action,
        string entityType,
        Guid? entityId,
        string description,
        Guid? customerId = null,
        Guid? vehicleId = null)
    {
        try
        {
            await conn.ExecuteAsync(
                @"INSERT INTO dbo.audit_log
                    (shop_id, user_id, action, entity_type, entity_id, customer_id, vehicle_id, description)
                  VALUES
                    (@shopId, @userId, @action, @entityType, @entityId, @customerId, @vehicleId, @description)",
                new { shopId, userId, action, entityType, entityId, customerId, vehicleId, description });
        }
        catch
        {
            // Log yazımı asla ana iş akışını bozmamalı.
        }
    }
}
