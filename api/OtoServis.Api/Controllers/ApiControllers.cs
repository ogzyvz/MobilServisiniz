using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Api.Models;
using OtoServis.Api.Services;

namespace OtoServis.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(AuthService auth) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.TenantCode))
            return BadRequest(new { error = "Servis kodu gerekli." });

        var shop = await auth.LookupTenantAsync(req.TenantCode);
        if (shop is null)
            return Unauthorized(new { error = "Servis kodu geçersiz." });

        var result = await auth.LoginAsync(req.TenantCode, req.Phone, req.Password);
        if (result is null)
            return Unauthorized(new { error = "Telefon, şifre veya servis yetkisi hatalı." });
        return Ok(result);
    }

    [HttpGet("lookup-tenant")]
    [AllowAnonymous]
    public async Task<ActionResult<ShopPreviewDto>> LookupTenant([FromQuery] string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { error = "Servis kodu gerekli." });
        var shop = await auth.LookupTenantAsync(code);
        return shop is null ? NotFound(new { error = "Servis bulunamadı." }) : Ok(shop);
    }

    [HttpPost("select-shop")]
    [Authorize]
    public async Task<ActionResult<AuthResponse>> SelectShop([FromBody] SelectShopRequest req)
    {
        var userId = User.GetUserId();
        var result = await auth.SelectShopAsync(userId, req.ShopId);
        if (result is null) return Forbid();
        return Ok(result);
    }

    [HttpGet("shops")]
    [Authorize]
    public async Task<ActionResult> GetMyShops()
    {
        var userId = User.GetUserId();
        await using var conn = new Microsoft.Data.SqlClient.SqlConnection(
            HttpContext.RequestServices.GetRequiredService<DbFactory>().ConnectionString);
        await conn.OpenAsync();
        var shops = await Dapper.SqlMapper.QueryAsync<ShopMembershipDto>(conn,
            @"SELECT shop_id AS ShopId, tenant_code AS TenantCode, slug AS Slug,
                     shop_name AS ShopName, city AS City, role AS Role, title AS Title,
                     is_owner AS IsOwner, CAST(is_default AS bit) AS IsDefault
              FROM dbo.vw_UserShops WHERE user_id = @userId", new { userId });
        return Ok(shops);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get()
    {
        var d = await data.GetDashboardAsync();
        return d is null ? NotFound() : Ok(d);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CustomersController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? search)
        => Ok(await data.GetCustomersAsync(search));

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Create([FromBody] CreateCustomerRequest req)
    {
        try
        {
            var created = await data.CreateCustomerAsync(req, User.GetUserId());
            return created is null ? BadRequest() : Ok(created);
        }
        catch (CustomerPhoneConflictException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> Update(Guid id, [FromBody] UpdateCustomerRequest req)
    {
        try
        {
            var updated = await data.UpdateCustomerAsync(id, req);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (CustomerPhoneConflictException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VehiclesController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? status, [FromQuery] string? search, [FromQuery] Guid? customerId)
        => Ok(await data.GetVehiclesAsync(status, search, customerId));

    [HttpPost]
    public async Task<ActionResult<CreateVehicleResponse>> Create([FromBody] CreateVehicleRequest req)
    {
        try
        {
            var created = await data.CreateVehicleAsync(req, User.GetUserId());
            return created is null ? BadRequest() : Ok(created);
        }
        catch (VehiclePlateConflictException ex)
        {
            return Conflict(ex.Conflict);
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number is 2601 or 2627)
        {
            return Conflict(new { error = "Bu plaka zaten kayıtlı." });
        }
    }

    [HttpPost("{id:guid}/transfer")]
    public async Task<ActionResult<TransferVehicleResponse>> Transfer(Guid id, [FromBody] TransferVehicleRequest req)
    {
        var result = await data.TransferVehicleOwnerAsync(id, req, User.GetUserId());
        return result is null ? NotFound(new { error = "Araç veya müşteri bulunamadı." }) : Ok(result);
    }

    [HttpPost("{id:guid}/new-visit")]
    public async Task<ActionResult<OpenNewVisitResponse>> NewVisit(Guid id, [FromBody] OpenNewVisitRequest req)
    {
        var result = await data.OpenNewVisitAsync(id, User.GetUserId(), req.Complaint);
        return result is null ? NotFound(new { error = "Araç bulunamadı." }) : Ok(result);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ServiceCatalogController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List()
        => Ok(await data.GetServiceCatalogAsync());
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StockController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? category, [FromQuery] string? search)
        => Ok(await data.GetStockAsync(category, search));

    [HttpPost]
    public async Task<ActionResult<StockProductDto>> Create([FromBody] CreateStockRequest req)
    {
        var created = await data.CreateStockAsync(req);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StockProductDto>> Update(Guid id, [FromBody] UpdateStockRequest req)
    {
        var updated = await data.UpdateStockAsync(id, req);
        return updated is null ? NotFound() : Ok(updated);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkOrdersController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? status)
        => Ok(await data.GetWorkOrdersAsync(status));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkOrderDetailDto>> Get(Guid id)
    {
        var wo = await data.GetWorkOrderDetailAsync(id);
        return wo is null ? NotFound() : Ok(wo);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest req)
    {
        try
        {
            var ok = await data.UpdateWorkOrderStatusAsync(
                id, req.Status, User.GetShopRole(), User.GetUserId(), req.AssignedUserId, req.AssignedUserName);
            return ok ? NoContent() : NotFound();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (WorkOrderReopenBlockedException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}/history")]
    public async Task<ActionResult> GetHistory(Guid id)
    {
        var rows = await data.GetWorkOrderStatusHistoryAsync(id);
        return rows is null ? NotFound() : Ok(rows);
    }

    [HttpPost("{id:guid}/complaints")]
    public async Task<ActionResult> AddComplaint(Guid id, [FromBody] AddComplaintRequest req)
    {
        var ok = await data.AddComplaintAsync(id, req.Description);
        return ok ? NoContent() : NotFound();
    }

    [HttpPut("{id:guid}/complaints/{complaintId:guid}")]
    public async Task<ActionResult> UpdateComplaint(Guid id, Guid complaintId, [FromBody] UpdateComplaintRequest req)
    {
        var ok = await data.UpdateComplaintAsync(id, complaintId, req.Description);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/services")]
    public async Task<ActionResult> AddService(Guid id, [FromBody] AddServiceRequest req)
    {
        try
        {
            var ok = await data.AddServiceAsync(id, req, User.GetUserId());
            return ok ? NoContent() : NotFound();
        }
        catch (WorkOrderCompletedException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("{id:guid}/parts")]
    public async Task<ActionResult> AddPart(Guid id, [FromBody] AddPartRequest req)
    {
        try
        {
            await data.AddPartAsync(id, req, User.GetUserId());
            return NoContent();
        }
        catch (WorkOrderCompletedException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number >= 50000)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:guid}/images")]
    [RequestSizeLimit(6_000_000)]
    public async Task<ActionResult<WorkOrderImageDto>> UploadImage(Guid id, IFormFile file, [FromForm] string imageType)
    {
        try
        {
            var img = await data.AddWorkOrderImageAsync(id, file, imageType, User.GetUserId());
            return img is null ? NotFound() : Ok(img);
        }
        catch (ImageTooLargeException ex)
        {
            return StatusCode(413, new { error = ex.Message });
        }
        catch (ImageLimitExceededException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}/images")]
    public async Task<ActionResult> ListImages(Guid id)
    {
        var rows = await data.GetWorkOrderImagesAsync(id);
        return rows is null ? NotFound() : Ok(rows);
    }

    [HttpPatch("{id:guid}/services/{serviceId:guid}")]
    public async Task<ActionResult> UpdateService(Guid id, Guid serviceId, [FromBody] UpdateServiceRequest req)
    {
        var ok = await data.UpdateServiceAsync(id, serviceId, req);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}/services/{serviceId:guid}")]
    public async Task<ActionResult> DeleteService(Guid id, Guid serviceId)
    {
        var ok = await data.DeleteServiceAsync(id, serviceId);
        return ok ? NoContent() : NotFound();
    }

    [HttpPatch("{id:guid}/parts/{partId:guid}")]
    public async Task<ActionResult> UpdatePart(Guid id, Guid partId, [FromBody] UpdatePartRequest req)
    {
        var ok = await data.UpdatePartAsync(id, partId, req);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}/parts/{partId:guid}")]
    public async Task<ActionResult> DeletePart(Guid id, Guid partId)
    {
        var ok = await data.DeletePartAsync(id, partId);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/parts/{partId:guid}/return-to-supplier")]
    public async Task<ActionResult> ReturnPartToSupplier(Guid id, Guid partId)
    {
        try
        {
            await data.ReturnPartToSupplierAsync(id, partId, User.GetUserId());
            return NoContent();
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number >= 50000)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

[ApiController]
[Route("api/app")]
[Authorize]
public class AppController(DataService data) : ControllerBase
{
    [HttpGet("vehicles")]
    public async Task<ActionResult> GetVehicles()
        => Ok(await data.GetMobileVehiclesAsync());
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StaffController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List()
        => Ok(await data.GetStaffAsync(User.GetShopRole(), User.GetUserId()));

    [HttpGet("performance")]
    public async Task<ActionResult> GetPerformance([FromQuery] DateOnly? date, [FromQuery] Guid? userId)
    {
        var d = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var rows = await data.GetStaffPerformanceAsync(d, User.GetShopRole(), User.GetUserId(), userId);
        return Ok(rows);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SuppliersController(DataService data) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? search)
        => Ok(await data.GetSuppliersAsync(search));

    [HttpPost]
    public async Task<ActionResult<SupplierDto>> Create([FromBody] CreateSupplierRequest req)
    {
        try
        {
            var created = await data.CreateSupplierAsync(req, User.GetUserId());
            return created is null ? BadRequest() : Ok(created);
        }
        catch (SupplierPhoneConflictException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpGet("report")]
    public async Task<ActionResult> Report([FromQuery] string? period, [FromQuery] DateOnly? date)
    {
        var p = period == "weekly" ? "weekly" : "daily";
        var d = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        return Ok(await data.GetSupplierReportAsync(p, d));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SupplierLedgerDto>> Get(Guid id)
    {
        var ledger = await data.GetSupplierLedgerAsync(id);
        return ledger is null ? NotFound() : Ok(ledger);
    }

    [HttpPost("{id:guid}/payments")]
    public async Task<ActionResult<SupplierLedgerDto>> RecordPayment(Guid id, [FromBody] RecordSupplierPaymentRequest req)
    {
        var ledger = await data.RecordSupplierPaymentAsync(id, req, User.GetUserId());
        return ledger is null ? NotFound() : Ok(ledger);
    }
}
