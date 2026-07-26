using Dapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using OtoServis.Api.Models;

namespace OtoServis.Api.Services;

public class DataService(TenantService tenant, IWebHostEnvironment env)
{
    private static readonly string[] AllowedImageTypes = ["ruhsat", "arac", "hasar", "diger"];
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private const int MaxImagesPerWorkOrder = 8;

    public async Task<DashboardDto?> GetDashboardAsync()
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var dash = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT waiting AS Waiting, in_progress AS InProgress, customers AS Customers,
                     vehicles AS Vehicles, staff_count AS StaffCount, low_stock AS LowStock
              FROM dbo.vw_ShopDashboard WHERE shop_id = @shopId",
            new { shopId });
        if (dash is null) return null;

        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var month = await conn.QuerySingleAsync<dynamic>(
            @"SELECT
                (SELECT COUNT(DISTINCT wo.vehicle_id) FROM dbo.work_orders wo
                 WHERE wo.shop_id = @shopId AND wo.opened_at >= @monthStart) AS VehiclesServiced,
                ((SELECT COUNT(*) FROM dbo.services s WHERE s.shop_id = @shopId AND s.created_at >= @monthStart) +
                 (SELECT COUNT(*) FROM dbo.work_order_parts p WHERE p.shop_id = @shopId AND p.created_at >= @monthStart)
                ) AS Operations",
            new { shopId, monthStart });

        return new DashboardDto(
            (int)dash.Waiting, (int)dash.InProgress, (int)dash.Customers, (int)dash.Vehicles,
            (int)dash.StaffCount, (int)dash.LowStock, (int)month.VehiclesServiced, (int)month.Operations);
    }

    public async Task<IReadOnlyList<CustomerDto>> GetCustomersAsync(string? search = null)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var sql = @"SELECT id AS Id, customer_type AS CustomerType, full_name AS FullName,
                           company_name AS CompanyName, phone AS Phone, email AS Email,
                           address AS Address, city AS City, is_supplier AS IsSupplier, is_customer AS IsCustomer
                    FROM dbo.customers
                    WHERE shop_id = @shopId AND is_active = 1 AND is_customer = 1";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (full_name LIKE @q OR phone LIKE @q)";
        sql += " ORDER BY full_name";
        var rows = await conn.QueryAsync<CustomerDto>(sql,
            new { shopId, q = $"%{search?.Trim()}%" });
        return rows.ToList();
    }

    private async Task<CustomerDto?> GetCustomerByIdAsync(SqlConnection conn, Guid id, Guid shopId)
    {
        return await conn.QuerySingleOrDefaultAsync<CustomerDto>(
            @"SELECT id AS Id, customer_type AS CustomerType, full_name AS FullName,
                     company_name AS CompanyName, phone AS Phone, email AS Email,
                     address AS Address, city AS City, is_supplier AS IsSupplier, is_customer AS IsCustomer
              FROM dbo.customers WHERE id = @id AND shop_id = @shopId",
            new { id, shopId });
    }

    public async Task<CustomerDto?> CreateCustomerAsync(CreateCustomerRequest req, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        var id = Guid.NewGuid();
        await using var conn = await tenant.OpenAsync();
        try
        {
            await conn.ExecuteAsync(
                @"INSERT INTO dbo.customers (id, shop_id, customer_type, full_name, company_name, phone, email, address, city, is_supplier, is_customer, created_by)
                  VALUES (@id, @shopId, @CustomerType, @FullName, @CompanyName, @Phone, @Email, @Address, @City, @IsSupplier, @IsCustomer, @userId)",
                new
                {
                    id, shopId, req.CustomerType, req.FullName, req.CompanyName, req.Phone, req.Email, req.Address,
                    req.City, req.IsSupplier, req.IsCustomer, userId,
                });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            throw new CustomerPhoneConflictException();
        }
        return await GetCustomerByIdAsync(conn, id, shopId);
    }

    public async Task<IReadOnlyList<VehicleDto>> GetVehiclesAsync(string? status = null, string? search = null, Guid? customerId = null)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var sql = @"
            SELECT v.id AS Id, v.customer_id AS CustomerId, c.full_name AS CustomerName,
                   v.plate AS Plate, v.brand AS Brand, v.model AS Model,
                   CAST(v.model_year AS int) AS ModelYear,
                   v.color AS Color, v.fuel AS Fuel, v.chassis_no AS ChassisNo,
                   v.engine_no AS EngineNo, v.engine_volume AS EngineVolume,
                   CAST(v.mileage AS int) AS Mileage,
                   cs.status AS Status
            FROM dbo.vehicles v
            INNER JOIN dbo.customers c ON c.id = v.customer_id
            LEFT JOIN dbo.vw_VehicleCurrentStatus cs ON cs.vehicle_id = v.id
            WHERE v.shop_id = @shopId AND v.is_active = 1";
        if (!string.IsNullOrWhiteSpace(status))
            sql += " AND cs.status = @status";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (v.plate LIKE @q OR c.full_name LIKE @q OR v.brand LIKE @q)";
        if (customerId.HasValue)
            sql += " AND v.customer_id = @customerId";
        sql += " ORDER BY v.created_at DESC";
        var rows = await conn.QueryAsync<VehicleDto>(sql, new { shopId, status, q = $"%{search?.Trim()}%", customerId });
        return rows.ToList();
    }

    private static string NormalizePlate(string plate) => plate.Trim().ToUpperInvariant().Replace(" ", "");

    private async Task<VehicleConflictDto?> FindPlateConflictAsync(SqlConnection conn, Guid shopId, string plateNorm)
    {
        return await conn.QuerySingleOrDefaultAsync<VehicleConflictDto>(
            @"SELECT TOP 1 v.id AS VehicleId, v.customer_id AS CustomerId, c.full_name AS CustomerName,
                     v.brand AS Brand, v.model AS Model
              FROM dbo.vehicles v
              INNER JOIN dbo.customers c ON c.id = v.customer_id
              WHERE v.shop_id = @shopId AND v.plate_norm = @plateNorm AND v.is_active = 1",
            new { shopId, plateNorm });
    }

    public async Task<CreateVehicleResponse?> CreateVehicleAsync(CreateVehicleRequest req, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        var vehicleId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var plateNorm = NormalizePlate(req.Plate);

        await using var conn = await tenant.OpenAsync();

        var conflict = await FindPlateConflictAsync(conn, shopId, plateNorm);
        if (conflict is not null && conflict.CustomerId != req.CustomerId)
            throw new VehiclePlateConflictException(conflict);

        await using var tx = await conn.BeginTransactionAsync();
        Guid woId;
        try
        {
            await conn.ExecuteAsync(
                @"INSERT INTO dbo.vehicles (id, shop_id, customer_id, plate, brand, model, model_year, color, fuel, chassis_no, engine_no, engine_volume, mileage)
                  VALUES (@vehicleId, @shopId, @CustomerId, @Plate, @Brand, @Model, @ModelYear, @Color, @Fuel, @ChassisNo, @EngineNo, @EngineVolume, @Mileage)",
                new
                {
                    vehicleId,
                    shopId,
                    req.CustomerId,
                    Plate = req.Plate.Trim().ToUpperInvariant(),
                    req.Brand,
                    req.Model,
                    req.ModelYear,
                    req.Color,
                    req.Fuel,
                    ChassisNo = req.ChassisNo?.Trim().ToUpperInvariant(),
                    req.EngineNo,
                    req.EngineVolume,
                    req.Mileage,
                },
                tx);

            var orderNo = await conn.ExecuteScalarAsync<long>(
                "DECLARE @n bigint; EXEC dbo.usp_NextTenantCounter @shopId, N'work_order_no', @n OUTPUT; SELECT @n",
                new { shopId }, tx);

            woId = Guid.NewGuid();
            await conn.ExecuteAsync(
                @"INSERT INTO dbo.work_orders (id, shop_id, order_no, vehicle_id, customer_id, opened_by, status, mileage_in, opened_at)
                  VALUES (@woId, @shopId, @orderNo, @vehicleId, @CustomerId, @userId, N'bekliyor', @Mileage, @now)",
                new { woId, shopId, orderNo, vehicleId, req.CustomerId, userId, req.Mileage, now }, tx);

            if (!string.IsNullOrWhiteSpace(req.Complaint))
            {
                await conn.ExecuteAsync(
                    @"INSERT INTO dbo.complaints (shop_id, work_order_id, description, created_at)
                      VALUES (@shopId, @woId, @Complaint, @now)",
                    new { shopId, woId, Complaint = req.Complaint, now }, tx);
            }

            await tx.CommitAsync();
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            await tx.RollbackAsync();
            var raceConflict = await FindPlateConflictAsync(conn, shopId, plateNorm);
            if (raceConflict is not null)
                throw new VehiclePlateConflictException(raceConflict);
            throw;
        }

        var vehicle = (await GetVehiclesAsync()).FirstOrDefault(v => v.Id == vehicleId);
        return vehicle is null ? null : new CreateVehicleResponse(vehicleId, woId, vehicle);
    }

    public async Task<TransferVehicleResponse?> TransferVehicleOwnerAsync(Guid vehicleId, TransferVehicleRequest req, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        var now = DateTime.UtcNow;

        await using var conn = await tenant.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();

        var vehicle = await conn.QuerySingleOrDefaultAsync<dynamic>(
            "SELECT mileage FROM dbo.vehicles WHERE id=@vehicleId AND shop_id=@shopId AND is_active=1",
            new { vehicleId, shopId }, tx);
        if (vehicle is null)
        {
            await tx.RollbackAsync();
            return null;
        }

        var customerExists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.customers WHERE id=@NewCustomerId AND shop_id=@shopId AND is_active=1",
            new { req.NewCustomerId, shopId }, tx) > 0;
        if (!customerExists)
        {
            await tx.RollbackAsync();
            return null;
        }

        await conn.ExecuteAsync(
            @"UPDATE dbo.vehicles SET customer_id=@NewCustomerId, updated_at=SYSUTCDATETIME()
              WHERE id=@vehicleId AND shop_id=@shopId AND is_active=1",
            new { req.NewCustomerId, vehicleId, shopId }, tx);

        var orderNo = await conn.ExecuteScalarAsync<long>(
            "DECLARE @n bigint; EXEC dbo.usp_NextTenantCounter @shopId, N'work_order_no', @n OUTPUT; SELECT @n",
            new { shopId }, tx);

        int? mileage = vehicle.mileage;
        var woId = Guid.NewGuid();
        await conn.ExecuteAsync(
            @"INSERT INTO dbo.work_orders (id, shop_id, order_no, vehicle_id, customer_id, opened_by, status, mileage_in, opened_at)
              VALUES (@woId, @shopId, @orderNo, @vehicleId, @NewCustomerId, @userId, N'bekliyor', @mileage, @now)",
            new { woId, shopId, orderNo, vehicleId, req.NewCustomerId, userId, mileage, now }, tx);

        if (!string.IsNullOrWhiteSpace(req.Complaint))
        {
            await conn.ExecuteAsync(
                @"INSERT INTO dbo.complaints (shop_id, work_order_id, description, created_at)
                  VALUES (@shopId, @woId, @Complaint, @now)",
                new { shopId, woId, req.Complaint, now }, tx);
        }

        await tx.CommitAsync();
        return new TransferVehicleResponse(vehicleId, woId);
    }

    public async Task<CustomerDto?> UpdateCustomerAsync(Guid id, UpdateCustomerRequest req)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        int n;
        try
        {
            n = await conn.ExecuteAsync(
                @"UPDATE dbo.customers SET customer_type=@CustomerType, full_name=@FullName, company_name=@CompanyName,
                  phone=@Phone, email=@Email, address=@Address, city=@City, is_supplier=@IsSupplier, is_customer=@IsCustomer,
                  updated_at=SYSUTCDATETIME()
                  WHERE id=@id AND shop_id=@shopId AND is_active=1",
                new
                {
                    id,
                    shopId,
                    req.CustomerType,
                    req.FullName,
                    req.CompanyName,
                    req.Phone,
                    req.Email,
                    req.Address,
                    req.City,
                    req.IsSupplier,
                    req.IsCustomer,
                });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            throw new CustomerPhoneConflictException();
        }
        if (n == 0) return null;
        return await GetCustomerByIdAsync(conn, id, shopId);
    }

    public async Task<StockProductDto?> CreateStockAsync(CreateStockRequest req)
    {
        var shopId = tenant.RequireShopId();
        var id = Guid.NewGuid();
        await using var conn = await tenant.OpenAsync();
        await conn.ExecuteAsync(
            @"INSERT INTO dbo.stock_products (id, shop_id, name, category, code, price, quantity, min_quantity)
              VALUES (@id, @shopId, @Name, @Category, @Code, @Price, @Quantity, @MinQuantity)",
            new { id, shopId, req.Name, req.Category, req.Code, req.Price, req.Quantity, req.MinQuantity });
        return (await GetStockAsync()).FirstOrDefault(s => s.Id == id);
    }

    public async Task<StockProductDto?> UpdateStockAsync(Guid id, UpdateStockRequest req)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            @"UPDATE dbo.stock_products SET name=@Name, category=@Category, code=@Code,
              price=@Price, quantity=@Quantity, min_quantity=@MinQuantity, updated_at=SYSUTCDATETIME()
              WHERE id=@id AND shop_id=@shopId AND is_active=1",
            new { id, shopId, req.Name, req.Category, req.Code, req.Price, req.Quantity, req.MinQuantity });
        if (n == 0) return null;
        return (await GetStockAsync()).FirstOrDefault(s => s.Id == id);
    }

    public async Task<IReadOnlyList<WorkOrderDetailDto>> GetMobileVehiclesAsync()
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var woIds = (await conn.QueryAsync<Guid>(
            @"SELECT wo.id FROM dbo.work_orders wo
              INNER JOIN (
                SELECT vehicle_id, MAX(opened_at) AS max_opened
                FROM dbo.work_orders WHERE shop_id=@shopId GROUP BY vehicle_id
              ) latest ON latest.vehicle_id=wo.vehicle_id AND latest.max_opened=wo.opened_at
              WHERE wo.shop_id=@shopId ORDER BY wo.opened_at DESC",
            new { shopId })).ToList();

        var list = new List<WorkOrderDetailDto>();
        foreach (var woId in woIds)
        {
            var d = await GetWorkOrderDetailAsync(woId);
            if (d is not null) list.Add(d);
        }
        return list;
    }

    public async Task<bool> UpdateServiceAsync(Guid woId, Guid serviceId, UpdateServiceRequest req)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            @"UPDATE dbo.services SET title=@Title, price=@Price
              WHERE id=@serviceId AND work_order_id=@woId AND shop_id=@shopId",
            new { serviceId, woId, shopId, req.Title, req.Price });
        return n > 0;
    }

    public async Task<bool> DeleteServiceAsync(Guid woId, Guid serviceId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            "DELETE FROM dbo.services WHERE id=@serviceId AND work_order_id=@woId AND shop_id=@shopId",
            new { serviceId, woId, shopId });
        return n > 0;
    }

    public async Task<bool> UpdatePartAsync(Guid woId, Guid partId, UpdatePartRequest req)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            @"UPDATE dbo.work_order_parts SET name=@Name, quantity=@Quantity, unit_price=@UnitPrice
              WHERE id=@partId AND work_order_id=@woId AND shop_id=@shopId",
            new { partId, woId, shopId, req.Name, req.Quantity, req.UnitPrice });
        return n > 0;
    }

    public async Task<bool> DeletePartAsync(Guid woId, Guid partId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            "DELETE FROM dbo.work_order_parts WHERE id=@partId AND work_order_id=@woId AND shop_id=@shopId",
            new { partId, woId, shopId });
        return n > 0;
    }

    public async Task<IReadOnlyList<ServiceCatalogDto>> GetServiceCatalogAsync()
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var rows = await conn.QueryAsync<ServiceCatalogDto>(
            @"SELECT id AS Id, code AS Code, name AS Name, category AS Category,
                     default_price AS DefaultPrice, estimated_minutes AS EstimatedMinutes
              FROM dbo.service_catalog WHERE shop_id = @shopId AND is_active = 1 ORDER BY sort_order",
            new { shopId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<StockProductDto>> GetStockAsync(string? category = null, string? search = null)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var sql = @"SELECT id AS Id, name AS Name, category AS Category, code AS Code,
                           price AS Price, quantity AS Quantity, min_quantity AS MinQuantity
                    FROM dbo.stock_products WHERE shop_id = @shopId AND is_active = 1";
        if (!string.IsNullOrWhiteSpace(category))
            sql += " AND category = @category";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (name LIKE @q OR code LIKE @q)";
        sql += " ORDER BY name";
        var rows = await conn.QueryAsync<StockProductDto>(sql, new { shopId, category, q = $"%{search?.Trim()}%" });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<WorkOrderDto>> GetWorkOrdersAsync(string? status = null)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var sql = @"
            SELECT wo.id AS Id, wo.order_no AS OrderNo, wo.status AS Status,
                   v.plate AS Plate, c.full_name AS CustomerName, c.phone AS CustomerPhone,
                   wo.mileage_in AS MileageIn, t.grand_total AS GrandTotal, t.paid_total AS PaidTotal,
                   wo.opened_at AS OpenedAt
            FROM dbo.work_orders wo
            INNER JOIN dbo.vehicles v ON v.id = wo.vehicle_id
            INNER JOIN dbo.customers c ON c.id = wo.customer_id
            LEFT JOIN dbo.vw_WorkOrderTotals t ON t.id = wo.id
            WHERE wo.shop_id = @shopId";
        if (!string.IsNullOrWhiteSpace(status))
            sql += " AND wo.status = @status";
        sql += " ORDER BY wo.opened_at DESC";
        var rows = await conn.QueryAsync<WorkOrderDto>(sql, new { shopId, status });
        return rows.ToList();
    }

    public async Task<WorkOrderDetailDto?> GetWorkOrderDetailAsync(Guid id)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var wo = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT wo.id, wo.order_no AS OrderNo, wo.status, wo.mileage_in AS MileageIn,
                     wo.discount_amount AS Discount, wo.opened_at AS OpenedAt,
                     wo.started_at AS StartedAt, wo.closed_at AS ClosedAt,
                     wo.assigned_user_name AS AssignedUserNameRaw, au.full_name AS AssignedUserFullName,
                     v.id AS VehicleId, v.customer_id AS CustomerId, v.plate, v.brand, v.model,
                     v.model_year AS ModelYear, v.color, v.fuel, v.chassis_no AS ChassisNo,
                     v.engine_no AS EngineNo, v.engine_volume AS EngineVolume, v.mileage,
                     c.full_name AS CustomerName, c.phone AS CustomerPhone, c.customer_type AS CustomerType,
                     c.email AS CustomerEmail, c.address AS CustomerAddress, c.city AS CustomerCity
              FROM dbo.work_orders wo
              INNER JOIN dbo.vehicles v ON v.id = wo.vehicle_id
              INNER JOIN dbo.customers c ON c.id = wo.customer_id
              LEFT JOIN dbo.users au ON au.id = wo.assigned_user_id
              WHERE wo.id = @id AND wo.shop_id = @shopId",
            new { id, shopId });

        if (wo is null) return null;

        var complaints = (await conn.QueryAsync<ComplaintDto>(
            "SELECT id AS Id, description AS Description, created_at AS CreatedAt FROM dbo.complaints WHERE work_order_id=@id",
            new { id })).ToList();

        var services = (await conn.QueryAsync<ServiceLineDto>(
            "SELECT id AS Id, title AS Title, price AS Price FROM dbo.services WHERE work_order_id=@id",
            new { id })).ToList();

        var parts = (await conn.QueryAsync<PartLineDto>(
            @"SELECT p.id AS Id, p.name AS Name, p.quantity AS Quantity, p.unit_price AS UnitPrice,
                     p.source AS Source, p.supplier_id AS SupplierId, s.full_name AS SupplierName,
                     p.purchase_price AS PurchasePrice, p.returned_at AS ReturnedAt
              FROM dbo.work_order_parts p
              LEFT JOIN dbo.customers s ON s.id = p.supplier_id AND s.is_supplier = 1
              WHERE p.work_order_id=@id",
            new { id })).ToList();

        var totals = await conn.QuerySingleAsync<dynamic>(
            "SELECT labor_total AS LaborTotal, parts_total AS PartsTotal, grand_total AS GrandTotal, paid_total AS PaidTotal FROM dbo.vw_WorkOrderTotals WHERE id=@id",
            new { id });

        string? assignedTo = (string?)wo.AssignedUserFullName ?? (string?)wo.AssignedUserNameRaw;

        return new WorkOrderDetailDto(
            wo.id, (long)wo.OrderNo, (string)wo.status,
            new VehicleDto(wo.VehicleId, wo.CustomerId, (string)wo.CustomerName, (string)wo.plate,
                (string)wo.brand, (string)wo.model, wo.ModelYear, wo.color, (string)wo.fuel,
                wo.ChassisNo, wo.EngineNo, wo.EngineVolume, wo.mileage, (string)wo.status),
            new CustomerDto(wo.CustomerId, (string)wo.CustomerType, (string)wo.CustomerName, null,
                (string)wo.CustomerPhone, wo.CustomerEmail, wo.CustomerAddress, wo.CustomerCity),
            complaints, services, parts,
            (decimal)totals.LaborTotal, (decimal)totals.PartsTotal, (decimal)wo.Discount,
            (decimal)totals.GrandTotal, (decimal)totals.PaidTotal, assignedTo,
            (DateTime?)wo.StartedAt, (DateTime?)wo.ClosedAt);
    }

    public async Task<IReadOnlyList<StaffDto>> GetStaffAsync(string? callerRole, Guid callerUserId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var sql = @"SELECT u.id AS Id, u.full_name AS FullName, su.role AS Role
                    FROM dbo.shop_users su
                    INNER JOIN dbo.users u ON u.id = su.user_id
                    WHERE su.shop_id = @shopId AND su.is_active = 1";
        if (callerRole != "admin" && callerRole != "usta")
            sql += " AND su.user_id = @callerUserId";
        sql += " ORDER BY u.full_name";
        var rows = await conn.QueryAsync<StaffDto>(sql, new { shopId, callerUserId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<StaffPerformanceRow>> GetStaffPerformanceAsync(
        DateOnly date, string? callerRole, Guid callerUserId, Guid? userId)
    {
        var shopId = tenant.RequireShopId();
        var effectiveUserId = callerRole == "personel" ? callerUserId : userId;
        var from = date.ToDateTime(TimeOnly.MinValue);
        var to = date.AddDays(1).ToDateTime(TimeOnly.MinValue);

        await using var conn = await tenant.OpenAsync();
        var rows = await conn.QueryAsync<StaffPerformanceRow>(
            @"WITH completed_today AS (
                  SELECT DISTINCT h.work_order_id
                  FROM dbo.work_order_status_history h
                  WHERE h.shop_id = @shopId AND h.new_status IN (N'tamamlandi', N'teslim_edildi')
                    AND h.changed_at >= @from AND h.changed_at < @to
              )
              SELECT wo.assigned_user_id AS UserId,
                     ISNULL(u.full_name, ISNULL(wo.assigned_user_name, N'Atanmamış')) AS FullName,
                     COUNT(DISTINCT ct.work_order_id) AS JobCount,
                     ISNULL(SUM(t.grand_total), 0) AS Revenue
              FROM completed_today ct
              INNER JOIN dbo.work_orders wo ON wo.id = ct.work_order_id AND wo.shop_id = @shopId
              LEFT JOIN dbo.users u ON u.id = wo.assigned_user_id
              LEFT JOIN dbo.vw_WorkOrderTotals t ON t.id = wo.id
              WHERE (wo.assigned_user_id IS NOT NULL OR wo.assigned_user_name IS NOT NULL)
                AND (@effectiveUserId IS NULL OR wo.assigned_user_id = @effectiveUserId)
              GROUP BY wo.assigned_user_id, u.full_name, wo.assigned_user_name
              ORDER BY Revenue DESC",
            new { shopId, from, to, effectiveUserId });
        return rows.ToList();
    }

    public async Task<bool> UpdateWorkOrderStatusAsync(
        Guid id, string status, string? callerRole, Guid callerUserId,
        Guid? assignedUserId, string? assignedUserName)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var current = await conn.QuerySingleOrDefaultAsync<dynamic>(
            @"SELECT status, closed_at,
                     CASE WHEN closed_at IS NOT NULL
                          AND CAST(DATEADD(HOUR, 3, closed_at) AS date) = CAST(DATEADD(HOUR, 3, SYSUTCDATETIME()) AS date)
                          THEN 1 ELSE 0 END AS same_local_day
              FROM dbo.work_orders WHERE id=@id AND shop_id=@shopId",
            new { id, shopId });
        if (current is null) return false;

        string currentStatus = (string)current.status;
        bool sameLocalDay = (int)current.same_local_day == 1;
        bool currentIsTerminal = currentStatus is "tamamlandi" or "teslim_edildi";
        bool targetReopensWork = status is "bekliyor" or "islemde";

        // "Same day" is evaluated in Turkey local time (UTC+3, fixed offset — no DST since 2016),
        // even though closed_at is stored in UTC.
        if (currentIsTerminal && targetReopensWork)
        {
            if (!sameLocalDay)
                throw new WorkOrderReopenBlockedException();
        }

        if (status is "tamamlandi" or "teslim_edildi")
        {
            var n0 = await conn.ExecuteAsync(
                "UPDATE dbo.work_orders SET status=@status, closed_at=SYSUTCDATETIME() WHERE id=@id AND shop_id=@shopId",
                new { id, status, shopId });
            return n0 > 0;
        }

        if (status != "islemde")
        {
            var n0 = await conn.ExecuteAsync(
                "UPDATE dbo.work_orders SET status=@status WHERE id=@id AND shop_id=@shopId",
                new { id, status, shopId });
            return n0 > 0;
        }

        Guid? finalUserId;
        string? finalUserName;

        if (callerRole == "admin" || callerRole == "usta")
        {
            if (assignedUserId is Guid uid)
            {
                var isMember = await conn.ExecuteScalarAsync<int>(
                    "SELECT COUNT(1) FROM dbo.shop_users WHERE shop_id=@shopId AND user_id=@uid AND is_active=1",
                    new { shopId, uid });
                if (isMember == 0)
                    throw new ArgumentException("Seçilen kişi bu servisin kayıtlı personeli değil.");
                finalUserId = uid;
                finalUserName = null;
            }
            else if (!string.IsNullOrWhiteSpace(assignedUserName))
            {
                finalUserId = null;
                finalUserName = assignedUserName.Trim();
            }
            else
            {
                finalUserId = callerUserId;
                finalUserName = null;
            }
        }
        else
        {
            finalUserId = callerUserId;
            finalUserName = null;
        }

        var n = await conn.ExecuteAsync(
            @"UPDATE dbo.work_orders SET status=@status, assigned_user_id=@finalUserId, assigned_user_name=@finalUserName,
              started_at=ISNULL(started_at, SYSUTCDATETIME())
              WHERE id=@id AND shop_id=@shopId",
            new { id, status, shopId, finalUserId, finalUserName });
        return n > 0;
    }

    public async Task<OpenNewVisitResponse?> OpenNewVisitAsync(Guid vehicleId, Guid userId, string? complaint)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var vehicle = await conn.QuerySingleOrDefaultAsync<dynamic>(
            "SELECT customer_id, mileage FROM dbo.vehicles WHERE id=@vehicleId AND shop_id=@shopId AND is_active=1",
            new { vehicleId, shopId });
        if (vehicle is null) return null;

        Guid customerId = vehicle.customer_id;

        await using var tx = await conn.BeginTransactionAsync();

        var orderNo = await conn.ExecuteScalarAsync<long>(
            "DECLARE @n bigint; EXEC dbo.usp_NextTenantCounter @shopId, N'work_order_no', @n OUTPUT; SELECT @n",
            new { shopId }, tx);

        var woId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        int? mileage = vehicle.mileage;
        await conn.ExecuteAsync(
            @"INSERT INTO dbo.work_orders (id, shop_id, order_no, vehicle_id, customer_id, opened_by, status, mileage_in, opened_at)
              VALUES (@woId, @shopId, @orderNo, @vehicleId, @customerId, @userId, N'bekliyor', @mileage, @now)",
            new { woId, shopId, orderNo, vehicleId, customerId, userId, mileage, now }, tx);

        if (!string.IsNullOrWhiteSpace(complaint))
        {
            await conn.ExecuteAsync(
                @"INSERT INTO dbo.complaints (shop_id, work_order_id, description, created_at)
                  VALUES (@shopId, @woId, @complaint, @now)",
                new { shopId, woId, complaint, now }, tx);
        }

        await tx.CommitAsync();
        return new OpenNewVisitResponse(vehicleId, woId);
    }

    public async Task<IReadOnlyList<WorkOrderStatusHistoryDto>?> GetWorkOrderStatusHistoryAsync(Guid woId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var exists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.work_orders WHERE id=@woId AND shop_id=@shopId", new { woId, shopId });
        if (exists == 0) return null;

        var rows = await conn.QueryAsync<WorkOrderStatusHistoryDto>(
            @"SELECT h.id AS Id, h.old_status AS OldStatus, h.new_status AS NewStatus, h.changed_at AS ChangedAt,
                     u.full_name AS ChangedByName
              FROM dbo.work_order_status_history h
              LEFT JOIN dbo.users u ON u.id = h.changed_by
              WHERE h.work_order_id = @woId AND h.shop_id = @shopId
              ORDER BY h.changed_at ASC",
            new { woId, shopId });
        return rows.ToList();
    }

    public async Task<bool> UpdateComplaintAsync(Guid woId, Guid complaintId, string description)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            @"UPDATE dbo.complaints SET description=@description
              WHERE id=@complaintId AND work_order_id=@woId AND shop_id=@shopId",
            new { complaintId, woId, shopId, description });
        return n > 0;
    }

    public async Task<bool> AddComplaintAsync(Guid woId, string description)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            @"INSERT INTO dbo.complaints (shop_id, work_order_id, description)
              SELECT @shopId, @woId, @description WHERE EXISTS (SELECT 1 FROM dbo.work_orders WHERE id=@woId AND shop_id=@shopId)",
            new { shopId, woId, description });
        return n > 0;
    }

    private async Task<string?> GetWorkOrderStatusAsync(SqlConnection conn, Guid woId, Guid shopId) =>
        await conn.ExecuteScalarAsync<string?>(
            "SELECT status FROM dbo.work_orders WHERE id=@woId AND shop_id=@shopId", new { woId, shopId });

    private static bool IsCompletedStatus(string status) => status is "tamamlandi" or "teslim_edildi";

    public async Task<bool> AddServiceAsync(Guid woId, AddServiceRequest req, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var status = await GetWorkOrderStatusAsync(conn, woId, shopId);
        if (status is null) return false;
        if (!req.Force && IsCompletedStatus(status))
            throw new WorkOrderCompletedException();

        var n = await conn.ExecuteAsync(
            @"INSERT INTO dbo.services (shop_id, work_order_id, service_catalog_id, title, price, performed_by)
              SELECT @shopId, @woId, @ServiceCatalogId, @Title, @Price, @userId
              WHERE EXISTS (SELECT 1 FROM dbo.work_orders WHERE id=@woId AND shop_id=@shopId)",
            new { shopId, woId, req.ServiceCatalogId, req.Title, req.Price, userId });
        return n > 0;
    }

    public async Task<bool> AddPartAsync(Guid woId, AddPartRequest req, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var status = await GetWorkOrderStatusAsync(conn, woId, shopId);
        if (status is null) return false;
        if (!req.Force && IsCompletedStatus(status))
            throw new WorkOrderCompletedException();

        await conn.ExecuteAsync(
            @"EXEC dbo.usp_AddPartToWorkOrder
                @shop_id=@shopId,
                @work_order_id=@woId,
                @stock_product_id=@StockProductId,
                @name=@Name,
                @quantity=@Quantity,
                @unit_price=@UnitPrice,
                @created_by=@userId,
                @source=@Source,
                @supplier_id=@SupplierId,
                @purchase_price=@PurchasePrice",
            new
            {
                shopId, woId, req.StockProductId, req.Name, req.Quantity, req.UnitPrice, userId,
                req.Source, req.SupplierId, req.PurchasePrice,
            });
        return true;
    }

    public async Task ReturnPartToSupplierAsync(Guid woId, Guid partId, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        await conn.ExecuteAsync(
            "EXEC dbo.usp_ReturnPartToSupplier @shop_id=@shopId, @work_order_part_id=@partId, @created_by=@userId",
            new { shopId, partId, userId });
    }

    public async Task<IReadOnlyList<SupplierDto>> GetSuppliersAsync(string? search = null)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var sql = @"SELECT s.id AS Id, s.full_name AS Name, s.contact_person AS Contact, NULLIF(s.phone, N'') AS Phone,
                           s.email AS Email, s.address AS Address, s.tax_no AS TaxNo,
                           ISNULL(b.balance, s.opening_balance) AS Balance
                    FROM dbo.customers s
                    LEFT JOIN dbo.vw_SupplierBalance b ON b.supplier_id = s.id
                    WHERE s.shop_id = @shopId AND s.is_active = 1 AND s.is_supplier = 1";
        if (!string.IsNullOrWhiteSpace(search))
            sql += " AND (s.full_name LIKE @q OR s.phone LIKE @q)";
        sql += " ORDER BY s.full_name";
        var rows = await conn.QueryAsync<SupplierDto>(sql, new { shopId, q = $"%{search?.Trim()}%" });
        return rows.ToList();
    }

    public async Task<SupplierDto?> CreateSupplierAsync(CreateSupplierRequest req, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        var id = Guid.NewGuid();
        var phone = string.IsNullOrWhiteSpace(req.Phone) ? "" : req.Phone.Trim();
        await using var conn = await tenant.OpenAsync();
        try
        {
            await conn.ExecuteAsync(
                @"INSERT INTO dbo.customers
                    (id, shop_id, customer_type, full_name, contact_person, phone, email, address, tax_no, opening_balance, is_supplier, is_customer, created_by)
                  VALUES
                    (@id, @shopId, N'kurumsal', @Name, @Contact, @phone, @Email, @Address, @TaxNo, @OpeningBalance, 1, 0, @userId)",
                new { id, shopId, req.Name, req.Contact, phone, req.Email, req.Address, req.TaxNo, req.OpeningBalance, userId });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            throw new SupplierPhoneConflictException();
        }
        return (await GetSuppliersAsync()).FirstOrDefault(s => s.Id == id);
    }

    public async Task<SupplierLedgerDto?> GetSupplierLedgerAsync(Guid id)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var supplier = await conn.QuerySingleOrDefaultAsync<SupplierDto>(
            @"SELECT s.id AS Id, s.full_name AS Name, s.contact_person AS Contact, NULLIF(s.phone, N'') AS Phone,
                     s.email AS Email, s.address AS Address, s.tax_no AS TaxNo,
                     ISNULL(b.balance, s.opening_balance) AS Balance
              FROM dbo.customers s
              LEFT JOIN dbo.vw_SupplierBalance b ON b.supplier_id = s.id
              WHERE s.id = @id AND s.shop_id = @shopId AND s.is_active = 1 AND s.is_supplier = 1",
            new { id, shopId });
        if (supplier is null) return null;

        var transactions = (await conn.QueryAsync<SupplierTransactionDto>(
            @"SELECT id AS Id, type AS Type, amount AS Amount, description AS Description, created_at AS CreatedAt
              FROM dbo.supplier_transactions
              WHERE supplier_id = @id AND shop_id = @shopId
              ORDER BY created_at DESC",
            new { id, shopId })).ToList();

        return new SupplierLedgerDto(supplier, transactions);
    }

    public async Task<SupplierLedgerDto?> RecordSupplierPaymentAsync(Guid id, RecordSupplierPaymentRequest req, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();
        var n = await conn.ExecuteAsync(
            @"INSERT INTO dbo.supplier_transactions (shop_id, supplier_id, type, amount, description, created_by)
              SELECT @shopId, @id, N'odeme', @Amount, @Description, @userId
              WHERE EXISTS (SELECT 1 FROM dbo.customers WHERE id=@id AND shop_id=@shopId AND is_active=1 AND is_supplier=1)",
            new { shopId, id, req.Amount, req.Description, userId });
        if (n == 0) return null;
        return await GetSupplierLedgerAsync(id);
    }

    public async Task<IReadOnlyList<SupplierReportRow>> GetSupplierReportAsync(string period, DateOnly date)
    {
        var shopId = tenant.RequireShopId();
        var (from, to) = period == "weekly" ? WeekRange(date) : (date, date.AddDays(1));
        await using var conn = await tenant.OpenAsync();
        var rows = await conn.QueryAsync<SupplierReportRow>(
            @"SELECT s.id AS SupplierId, s.full_name AS SupplierName,
                     ISNULL(SUM(CASE WHEN st.type = N'alis' THEN st.amount ELSE 0 END), 0) AS TotalPurchases,
                     ISNULL(SUM(CASE WHEN st.type = N'iade' THEN st.amount ELSE 0 END), 0) AS TotalReturns,
                     COUNT(st.id) AS TransactionCount
              FROM dbo.customers s
              INNER JOIN dbo.supplier_transactions st ON st.supplier_id = s.id
              WHERE s.shop_id = @shopId AND st.shop_id = @shopId AND s.is_supplier = 1
                AND st.created_at >= @from AND st.created_at < @to
              GROUP BY s.id, s.full_name
              ORDER BY TotalPurchases DESC",
            new { shopId, from = from.ToDateTime(TimeOnly.MinValue), to = to.ToDateTime(TimeOnly.MinValue) });
        return rows.ToList();
    }

    private static (DateOnly From, DateOnly To) WeekRange(DateOnly date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        var monday = date.AddDays(-diff);
        return (monday, monday.AddDays(7));
    }

    public async Task<WorkOrderImageDto?> AddWorkOrderImageAsync(Guid woId, IFormFile file, string imageType, Guid userId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var woExists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.work_orders WHERE id=@woId AND shop_id=@shopId", new { woId, shopId });
        if (woExists == 0) return null;

        if (file.Length > MaxImageBytes)
            throw new ImageTooLargeException();

        var count = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.work_order_images WHERE work_order_id=@woId AND shop_id=@shopId", new { woId, shopId });
        if (count >= MaxImagesPerWorkOrder)
            throw new ImageLimitExceededException();

        var type = AllowedImageTypes.Contains(imageType) ? imageType : "diger";
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
        var id = Guid.NewGuid();

        var relDir = $"uploads/{shopId}/{woId}";
        var absDir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", shopId.ToString(), woId.ToString());
        Directory.CreateDirectory(absDir);
        var fileName = $"{id}{ext}";
        var absPath = Path.Combine(absDir, fileName);
        await using (var stream = new FileStream(absPath, FileMode.Create))
            await file.CopyToAsync(stream);

        var relPath = $"{relDir}/{fileName}";
        var now = DateTime.UtcNow;
        await conn.ExecuteAsync(
            @"INSERT INTO dbo.work_order_images (id, shop_id, work_order_id, image_type, file_path, mime_type, uploaded_by, created_at)
              VALUES (@id, @shopId, @woId, @type, @relPath, @mimeType, @userId, @now)",
            new { id, shopId, woId, type, relPath, mimeType = file.ContentType, userId, now });

        return new WorkOrderImageDto(id, type, $"/{relPath}", now);
    }

    public async Task<IReadOnlyList<WorkOrderImageDto>?> GetWorkOrderImagesAsync(Guid woId)
    {
        var shopId = tenant.RequireShopId();
        await using var conn = await tenant.OpenAsync();

        var woExists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.work_orders WHERE id=@woId AND shop_id=@shopId", new { woId, shopId });
        if (woExists == 0) return null;

        var rows = await conn.QueryAsync<dynamic>(
            @"SELECT id AS Id, image_type AS ImageType, file_path AS FilePath, created_at AS CreatedAt
              FROM dbo.work_order_images WHERE work_order_id=@woId AND shop_id=@shopId
              ORDER BY created_at DESC",
            new { woId, shopId });
        return rows.Select(r => new WorkOrderImageDto(r.Id, (string)r.ImageType, $"/{(string)r.FilePath}", (DateTime)r.CreatedAt)).ToList();
    }
}
