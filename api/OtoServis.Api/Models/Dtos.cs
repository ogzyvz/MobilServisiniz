namespace OtoServis.Api.Models;

public record LoginRequest(string TenantCode, string Phone, string Password);
public record SelectShopRequest(Guid ShopId);
public record ShopPreviewDto(Guid ShopId, string TenantCode, string ShopName, string? City);

public record AuthResponse(
    string Token,
    UserDto User,
    IReadOnlyList<ShopMembershipDto> Shops,
    ShopMembershipDto? ActiveShop);

public record UserDto(Guid Id, string FullName, string Phone, string? Email);

public record ShopMembershipDto(
    Guid ShopId,
    string TenantCode,
    string Slug,
    string ShopName,
    string? City,
    string Role,
    string? Title,
    bool IsOwner,
    bool IsDefault);

public record DashboardDto(
    int Waiting,
    int InProgress,
    int Customers,
    int Vehicles,
    int StaffCount,
    int LowStock,
    int MonthVehiclesServiced = 0,
    int MonthOperations = 0);

public record CustomerDto(
    Guid Id,
    string CustomerType,
    string FullName,
    string? CompanyName,
    string Phone,
    string? Email,
    string? Address,
    string? City,
    bool IsSupplier = false,
    bool IsCustomer = true);

public record CreateCustomerRequest(
    string FullName,
    string Phone,
    string CustomerType = "bireysel",
    string? CompanyName = null,
    string? Email = null,
    string? Address = null,
    string? City = null,
    bool IsSupplier = false,
    bool IsCustomer = true);

public record UpdateCustomerRequest(
    string FullName,
    string Phone,
    string CustomerType = "bireysel",
    string? CompanyName = null,
    string? Email = null,
    string? Address = null,
    string? City = null,
    bool IsSupplier = false,
    bool IsCustomer = true);

public class CustomerPhoneConflictException()
    : Exception("Bu telefon numarasıyla kayıtlı bir müşteri zaten var.");

public record CreateStockRequest(
    string Name,
    string Category = "diger",
    string? Code = null,
    decimal Price = 0,
    int Quantity = 0,
    int MinQuantity = 0);

public record UpdateStockRequest(
    string Name,
    string Category,
    string? Code,
    decimal Price,
    int Quantity,
    int MinQuantity);

public record UpdateServiceRequest(string Title, decimal Price);
public record UpdatePartRequest(string Name, int Quantity, decimal UnitPrice);

public record CreateVehicleResponse(Guid VehicleId, Guid WorkOrderId, VehicleDto Vehicle);

public record VehicleDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    string Plate,
    string Brand,
    string Model,
    int? ModelYear,
    string? Color,
    string Fuel,
    string? ChassisNo,
    string? EngineNo,
    string? EngineVolume,
    int? Mileage,
    string? Status);

public record CreateVehicleRequest(
    Guid CustomerId,
    string Plate,
    string Brand,
    string Model,
    int? ModelYear = null,
    string? Color = null,
    string Fuel = "diger",
    string? ChassisNo = null,
    string? EngineNo = null,
    string? EngineVolume = null,
    int? Mileage = null,
    string? Complaint = null);

public record VehicleConflictDto(
    Guid VehicleId,
    Guid CustomerId,
    string CustomerName,
    string Brand,
    string Model);

public class VehiclePlateConflictException(VehicleConflictDto conflict)
    : Exception("Bu plaka zaten başka bir müşteriye kayıtlı.")
{
    public VehicleConflictDto Conflict { get; } = conflict;
}

public record TransferVehicleRequest(Guid NewCustomerId, string? Complaint = null);
public record TransferVehicleResponse(Guid VehicleId, Guid WorkOrderId);

public record ServiceCatalogDto(
    Guid Id,
    string? Code,
    string Name,
    string Category,
    decimal DefaultPrice,
    int? EstimatedMinutes);

public record WorkOrderDto(
    Guid Id,
    long OrderNo,
    string Status,
    string Plate,
    string CustomerName,
    string CustomerPhone,
    int? MileageIn,
    decimal GrandTotal,
    decimal PaidTotal,
    DateTime OpenedAt);

public record WorkOrderDetailDto(
    Guid Id,
    long OrderNo,
    string Status,
    VehicleDto Vehicle,
    CustomerDto Customer,
    IReadOnlyList<ComplaintDto> Complaints,
    IReadOnlyList<ServiceLineDto> Services,
    IReadOnlyList<PartLineDto> Parts,
    decimal LaborTotal,
    decimal PartsTotal,
    decimal Discount,
    decimal GrandTotal,
    decimal PaidTotal,
    string? AssignedTo,
    DateTime? StartedAt = null,
    DateTime? ClosedAt = null);

public record ComplaintDto(Guid Id, string Description, DateTime CreatedAt);
public record ServiceLineDto(Guid Id, string Title, decimal Price);
public record PartLineDto(
    Guid Id,
    string Name,
    int Quantity,
    decimal UnitPrice,
    string Source,
    Guid? SupplierId,
    string? SupplierName,
    decimal? PurchasePrice,
    DateTime? ReturnedAt);

public record StockProductDto(
    Guid Id,
    string Name,
    string Category,
    string? Code,
    decimal Price,
    int Quantity,
    int MinQuantity);

public record AddServiceRequest(Guid? ServiceCatalogId, string Title, decimal Price, bool Force = false);
public record AddPartRequest(
    Guid? StockProductId,
    string Name,
    int Quantity,
    decimal UnitPrice,
    string Source = "stok",
    Guid? SupplierId = null,
    decimal? PurchasePrice = null,
    bool Force = false);
public record AddComplaintRequest(string Description);
public record UpdateComplaintRequest(string Description);
public record UpdateStatusRequest(string Status, Guid? AssignedUserId = null, string? AssignedUserName = null);

public class WorkOrderCompletedException() : Exception("Bu iş tamamlanmış.");

public class WorkOrderReopenBlockedException()
    : Exception("Bu iş farklı bir günde tamamlandı, durumu geri alamazsınız. Yeni bir servis kaydı açabilirsiniz.");

public record OpenNewVisitRequest(string? Complaint = null);
public record OpenNewVisitResponse(Guid VehicleId, Guid WorkOrderId);

public record WorkOrderStatusHistoryDto(
    Guid Id,
    string? OldStatus,
    string NewStatus,
    DateTime ChangedAt,
    string? ChangedByName);

public record WorkOrderImageDto(Guid Id, string ImageType, string Url, DateTime CreatedAt);

public class ImageTooLargeException() : Exception("Fotoğraf 5MB'den büyük olamaz.");
public class ImageLimitExceededException() : Exception("Bu iş emri için fotoğraf limiti (8) doldu.");

public record StaffDto(Guid Id, string FullName, string Role);

public record StaffPerformanceRow(Guid? UserId, string FullName, int JobCount, decimal Revenue);

public record SupplierDto(
    Guid Id,
    string Name,
    string? Contact,
    string? Phone,
    string? Email,
    string? Address,
    string? TaxNo,
    decimal Balance);

public record CreateSupplierRequest(
    string Name,
    string? Contact = null,
    string? Phone = null,
    string? Email = null,
    string? Address = null,
    string? TaxNo = null,
    decimal OpeningBalance = 0);

public record SupplierTransactionDto(Guid Id, string Type, decimal Amount, string? Description, DateTime CreatedAt);
public record SupplierLedgerDto(SupplierDto Supplier, IReadOnlyList<SupplierTransactionDto> Transactions);
public record RecordSupplierPaymentRequest(decimal Amount, string? Description);
public record SupplierReportRow(Guid SupplierId, string SupplierName, decimal TotalPurchases, decimal TotalReturns, int TransactionCount);

public class SupplierPhoneConflictException()
    : Exception("Bu telefon numarasıyla kayıtlı bir cari zaten var.");
