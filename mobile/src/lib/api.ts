import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE_URL } from './api-config'
import type {
  Customer,
  JobStatus,
  ProductItem,
  ServiceItem,
  StockCategory,
  StockProduct,
  Supplier,
  Vehicle,
} from './types'

const TOKEN_KEY = 'otoservis_token'
const USER_KEY = 'otoservis_user'
const USER_ID_KEY = 'otoservis_user_id'
const USER_ROLE_KEY = 'otoservis_user_role'
const TENANT_CODE_KEY = 'otoservis_tenant_code'
const SHOP_NAME_KEY = 'otoservis_shop_name'

export type AuthResult =
  | { ok: true; name: string }
  | { ok: false; error: string }

export type PlateConflictInfo = {
  vehicleId: string
  customerId: string
  customerName: string
  brand: string
  model: string
}

export class PlateConflictError extends Error {
  conflict: PlateConflictInfo
  /** Devret akışında bu araca atanacak müşteri — çağıran taraf doldurur. */
  resolvedCustomerId?: string

  constructor(conflict: PlateConflictInfo) {
    super(`Bu plaka zaten ${conflict.customerName} adlı müşteriye kayıtlı.`)
    this.name = 'PlateConflictError'
    this.conflict = conflict
  }
}

export class PhoneConflictError extends Error {
  constructor(message?: string) {
    super(message || 'Bu telefon numarasıyla kayıtlı bir müşteri zaten var.')
    this.name = 'PhoneConflictError'
  }
}

export class WorkOrderCompletedError extends Error {
  constructor(message?: string) {
    super(message || 'Bu iş tamamlanmış.')
    this.name = 'WorkOrderCompletedError'
  }
}

export class WorkOrderReopenBlockedError extends Error {
  constructor(message?: string) {
    super(
      message ||
        'Bu iş farklı bir günde tamamlandı, durumu geri alamazsınız. Yeni bir servis kaydı açabilirsiniz.',
    )
    this.name = 'WorkOrderReopenBlockedError'
  }
}

export type CustomerVehicleSummary = {
  id: string
  plate: string
  brand: string
  model: string
  status: JobStatus
}

export type CurrentUser = { id: string; name: string; role: string }

export type StaffMember = { id: string; fullName: string; role: string }

export type ServiceCatalogItem = {
  id: string
  code?: string
  name: string
  category: string
  defaultPrice: number
}

let token: string | null = null

async function loadToken() {
  if (!token) token = await AsyncStorage.getItem(TOKEN_KEY)
  return token
}

export async function getStoredUser(): Promise<string | null> {
  return AsyncStorage.getItem(USER_KEY)
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const [name, id, role] = await Promise.all([
    AsyncStorage.getItem(USER_KEY),
    AsyncStorage.getItem(USER_ID_KEY),
    AsyncStorage.getItem(USER_ROLE_KEY),
  ])
  if (!name || !id) return null
  return { id, name, role: role ?? 'personel' }
}

export async function clearSession() {
  token = null
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, USER_ID_KEY, USER_ROLE_KEY, SHOP_NAME_KEY])
}

export async function getStoredTenantCode(): Promise<string | null> {
  return AsyncStorage.getItem(TENANT_CODE_KEY)
}

export async function lookupTenant(code: string): Promise<{ shopName: string; city?: string } | null> {
  try {
    const q = encodeURIComponent(code.trim())
    return await api<{ shopName: string; city?: string }>(
      `/api/auth/lookup-tenant?code=${q}`,
      {},
      false,
    )
  } catch {
    return null
  }
}

async function api<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (auth) {
    const t = await loadToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    let body: any = null
    try {
      body = await res.json()
    } catch {
      /* ignore */
    }
    if (res.status === 409 && body?.vehicleId) {
      throw new PlateConflictError({
        vehicleId: body.vehicleId,
        customerId: body.customerId,
        customerName: body.customerName,
        brand: body.brand,
        model: body.model,
      })
    }
    if (res.status === 409 && body?.error) {
      if (body.error.includes('telefon numarasıyla')) throw new PhoneConflictError(body.error)
      if (body.error.includes('tamamlanmış')) throw new WorkOrderCompletedError(body.error)
      if (body.error.includes('farklı bir günde')) throw new WorkOrderReopenBlockedError(body.error)
    }
    let msg = `HTTP ${res.status}`
    if (body?.error) msg = body.error
    else if (body?.title) msg = body.title
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function mapStatus(s: string): JobStatus {
  if (s === 'islemde') return 'islemde'
  if (s === 'tamamlandi' || s === 'teslim_edildi') return 'tamamlandi'
  return 'bekliyor'
}

function mapFuel(f: string): string {
  const x = f.trim().toLowerCase()
  if (x.includes('diz')) return 'dizel'
  if (x.includes('benz')) return 'benzin'
  if (x.includes('lpg')) return 'lpg'
  if (x.includes('elek')) return 'elektrik'
  if (x.includes('hib')) return 'hibrit'
  if (['benzin', 'dizel', 'lpg', 'elektrik', 'hibrit', 'diger'].includes(x)) return x
  return 'diger'
}

type WoDetail = {
  id: string
  status: string
  vehicle: {
    id: string
    customerId: string
    customerName: string
    plate: string
    brand: string
    model: string
    modelYear?: number
    color?: string
    fuel: string
    chassisNo?: string
    engineNo?: string
    engineVolume?: string
    mileage?: number
  }
  customer: {
    id: string
    fullName: string
    phone: string
    address?: string
    city?: string
  }
  complaints: { id: string; description: string; createdAt: string }[]
  services: { id: string; title: string; price: number }[]
  parts: {
    id: string
    name: string
    quantity: number
    unitPrice: number
    source: string
    supplierId?: string
    supplierName?: string
    purchasePrice?: number
    returnedAt?: string
  }[]
  assignedTo?: string | null
  laborTotal?: number
  partsTotal?: number
  grandTotal?: number
  startedAt?: string | null
  closedAt?: string | null
}

function mapWorkOrder(wo: WoDetail): Vehicle {
  const v = wo.vehicle
  const c = wo.customer
  return {
    id: v.id,
    workOrderId: wo.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    year: v.modelYear ? String(v.modelYear) : '',
    color: v.color ?? '',
    fuel: v.fuel,
    chassis: v.chassisNo ?? '',
    engineNo: v.engineNo ?? '',
    engineVolume: v.engineVolume ?? '',
    km: v.mileage != null ? String(v.mileage) : '',
    status: mapStatus(wo.status),
    assignedTo: wo.assignedTo ?? undefined,
    createdAt: new Date().toISOString(),
    startedAt: wo.startedAt ?? undefined,
    closedAt: wo.closedAt ?? undefined,
    laborTotal: wo.laborTotal != null ? Number(wo.laborTotal) : undefined,
    partsTotal: wo.partsTotal != null ? Number(wo.partsTotal) : undefined,
    grandTotal: wo.grandTotal != null ? Number(wo.grandTotal) : undefined,
    customer: {
      id: c.id,
      name: c.fullName,
      phone: c.phone,
      address: c.address ?? c.city,
    },
    complaints: wo.complaints.map((k) => ({
      id: k.id,
      text: k.description,
      createdAt: k.createdAt,
    })),
    services: wo.services.map((s) => ({
      id: s.id,
      title: s.title,
      price: Number(s.price),
    })),
    products: wo.parts.map((p) => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      price: Number(p.unitPrice),
      source: p.source === 'disaridan' ? 'disaridan' : 'stok',
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : undefined,
      returnedAt: p.returnedAt ?? undefined,
    })),
  }
}

export async function loginUser(
  tenantCode: string,
  phone: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await api<{
      token: string
      user: { id: string; fullName: string }
      activeShop?: { shopName: string; tenantCode: string; role?: string }
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        tenantCode: tenantCode.trim().toUpperCase(),
        phone: phone.trim(),
        password,
      }),
    }, false)

    token = res.token
    await AsyncStorage.setItem(TOKEN_KEY, res.token)
    await AsyncStorage.setItem(USER_KEY, res.user.fullName)
    await AsyncStorage.setItem(USER_ID_KEY, res.user.id)
    await AsyncStorage.setItem(USER_ROLE_KEY, res.activeShop?.role ?? 'personel')
    await AsyncStorage.setItem(TENANT_CODE_KEY, tenantCode.trim().toUpperCase())
    if (res.activeShop?.shopName) {
      await AsyncStorage.setItem(SHOP_NAME_KEY, res.activeShop.shopName)
    }
    return { ok: true, name: res.user.fullName }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Giriş başarısız.' }
  }
}

export async function registerUser(): Promise<AuthResult> {
  return {
    ok: false,
    error: 'Yeni hesap oluşturma yalnızca yönetici tarafından yapılabilir.',
  }
}

export async function initSession(): Promise<string | null> {
  const name = await getStoredUser()
  const t = await loadToken()
  if (!name || !t) return null
  try {
    await api('/api/dashboard')
    return name
  } catch {
    await clearSession()
    return null
  }
}

export type DashboardStats = {
  waiting: number
  inProgress: number
  customers: number
  vehicles: number
  staffCount: number
  lowStock: number
  monthVehiclesServiced: number
  monthOperations: number
}

export async function loadDashboardStats(): Promise<DashboardStats> {
  const d = await api<{
    waiting: number
    inProgress: number
    customers: number
    vehicles: number
    staffCount: number
    lowStock: number
    monthVehiclesServiced?: number
    monthOperations?: number
  }>('/api/dashboard')
  return {
    waiting: d.waiting,
    inProgress: d.inProgress,
    customers: d.customers,
    vehicles: d.vehicles,
    staffCount: d.staffCount,
    lowStock: d.lowStock,
    monthVehiclesServiced: d.monthVehiclesServiced ?? 0,
    monthOperations: d.monthOperations ?? 0,
  }
}

export type StaffPerformanceRow = {
  userId?: string
  fullName: string
  jobCount: number
  revenue: number
}

export async function getStaffPerformance(date?: string, userId?: string): Promise<StaffPerformanceRow[]> {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (userId) params.set('userId', userId)
  const q = params.toString()
  const rows = await api<{ userId?: string; fullName: string; jobCount: number; revenue: number }[]>(
    `/api/staff/performance${q ? `?${q}` : ''}`,
  )
  return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }))
}

export async function loadVehicles(): Promise<Vehicle[]> {
  const rows = await api<WoDetail[]>('/api/app/vehicles')
  return rows.map(mapWorkOrder)
}

export async function loadCustomers(): Promise<Customer[]> {
  const rows = await api<{
    id: string
    fullName: string
    phone: string
    address?: string
    city?: string
    isSupplier?: boolean
    isCustomer?: boolean
  }[]>('/api/customers')
  return rows.map((c) => ({
    id: c.id,
    name: c.fullName,
    phone: c.phone,
    address: c.address ?? c.city,
    isSupplier: c.isSupplier ?? false,
    isCustomer: c.isCustomer ?? true,
  }))
}

export async function loadStock(): Promise<StockProduct[]> {
  const rows = await api<{
    id: string
    name: string
    category: string
    code?: string
    price: number
    quantity: number
  }[]>('/api/stock')
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category as StockCategory,
    code: s.code ?? '-',
    price: Number(s.price),
    stock: s.quantity,
  }))
}

export async function loadServiceCatalog(): Promise<ServiceCatalogItem[]> {
  const rows = await api<{
    id: string
    code?: string
    name: string
    category: string
    defaultPrice: number
  }[]>('/api/servicecatalog')
  return rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    category: s.category,
    defaultPrice: Number(s.defaultPrice),
  }))
}

type CustomerApiRow = {
  id: string
  fullName: string
  phone: string
  address?: string
  city?: string
  isSupplier?: boolean
  isCustomer?: boolean
}

function mapCustomerRow(c: CustomerApiRow): Customer {
  return {
    id: c.id,
    name: c.fullName,
    phone: c.phone,
    address: c.address ?? c.city,
    isSupplier: c.isSupplier ?? false,
    isCustomer: c.isCustomer ?? true,
  }
}

export async function createCustomer(data: Omit<Customer, 'id'>): Promise<Customer> {
  const c = await api<CustomerApiRow>('/api/customers', {
    method: 'POST',
    body: JSON.stringify({
      fullName: data.name,
      phone: data.phone,
      address: data.address,
      isSupplier: data.isSupplier ?? false,
      isCustomer: data.isCustomer ?? true,
    }),
  })
  return mapCustomerRow(c)
}

export async function updateCustomerApi(id: string, data: Omit<Customer, 'id'>): Promise<Customer> {
  const c = await api<CustomerApiRow>(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      fullName: data.name,
      phone: data.phone,
      address: data.address,
      isSupplier: data.isSupplier ?? false,
      isCustomer: data.isCustomer ?? true,
    }),
  })
  return mapCustomerRow(c)
}

export async function createStock(data: Omit<StockProduct, 'id'>): Promise<StockProduct> {
  const s = await api<{
    id: string
    name: string
    category: string
    code?: string
    price: number
    quantity: number
  }>('/api/stock', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      category: data.category,
      code: data.code === '-' ? null : data.code,
      price: data.price,
      quantity: data.stock,
    }),
  })
  return {
    id: s.id,
    name: s.name,
    category: s.category as StockCategory,
    code: s.code ?? '-',
    price: Number(s.price),
    stock: s.quantity,
  }
}

export async function updateStockApi(id: string, data: Omit<StockProduct, 'id'>): Promise<StockProduct> {
  const s = await api<{
    id: string
    name: string
    category: string
    code?: string
    price: number
    quantity: number
    minQuantity: number
  }>(`/api/stock/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: data.name,
      category: data.category,
      code: data.code === '-' ? null : data.code,
      price: data.price,
      quantity: data.stock,
      minQuantity: 0,
    }),
  })
  return {
    id: s.id,
    name: s.name,
    category: s.category as StockCategory,
    code: s.code ?? '-',
    price: Number(s.price),
    stock: s.quantity,
  }
}

export async function createVehicleApi(
  customerId: string,
  plate: string,
  brand: string,
  model: string,
  year: string,
  color: string,
  fuel: string,
  chassis: string,
  engineNo: string,
  engineVolume: string,
  km: string,
  complaint?: string,
): Promise<Vehicle> {
  const res = await api<{ vehicleId: string; workOrderId: string }>('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify({
      customerId,
      plate: plate.trim().toUpperCase(),
      brand,
      model,
      modelYear: year ? parseInt(year, 10) : null,
      color: color || null,
      fuel: mapFuel(fuel),
      chassisNo: chassis ? chassis.trim().toUpperCase() : null,
      engineNo: engineNo || null,
      engineVolume: engineVolume || null,
      mileage: km ? parseInt(km.replace(/\D/g, ''), 10) : null,
      complaint: complaint || null,
    }),
  })
  // Az önce oluşturulan iş emrini doğrudan kendi id'siyle çekiyoruz.
  // Önceden burada tüm araç listesi yüklenip "her aracın en son iş emri"
  // sorgusuyla eşleştirme yapılıyordu; bu, aynı saniye içinde açılan başka
  // iş emirleriyle karışma riski taşıyordu (bkz. opened_at saniye hassasiyeti).
  return refreshVehicle(res.workOrderId)
}

export async function refreshVehicle(workOrderId: string): Promise<Vehicle> {
  const wo = await api<WoDetail>(`/api/workorders/${workOrderId}`)
  return mapWorkOrder(wo)
}

export async function loadVehiclesByCustomer(customerId: string): Promise<CustomerVehicleSummary[]> {
  const rows = await api<{
    id: string
    plate: string
    brand: string
    model: string
    status?: string
  }[]>(`/api/vehicles?customerId=${encodeURIComponent(customerId)}`)
  return rows.map((v) => ({
    id: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    status: mapStatus(v.status ?? 'bekliyor'),
  }))
}

export async function transferVehicleApi(
  vehicleId: string,
  newCustomerId: string,
  complaint?: string,
): Promise<Vehicle> {
  const res = await api<{ vehicleId: string; workOrderId: string }>(
    `/api/vehicles/${vehicleId}/transfer`,
    {
      method: 'POST',
      body: JSON.stringify({ newCustomerId, complaint: complaint || null }),
    },
  )
  return refreshVehicle(res.workOrderId)
}

export async function setWorkOrderStatus(
  workOrderId: string,
  status: JobStatus,
  assignment?: { assignedUserId?: string; assignedUserName?: string },
) {
  await api(`/api/workorders/${workOrderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      assignedUserId: assignment?.assignedUserId ?? null,
      assignedUserName: assignment?.assignedUserName ?? null,
    }),
  })
}

export async function getStaffList(): Promise<StaffMember[]> {
  return api<StaffMember[]>('/api/staff')
}

export async function addComplaintApi(workOrderId: string, text: string) {
  await api(`/api/workorders/${workOrderId}/complaints`, {
    method: 'POST',
    body: JSON.stringify({ description: text }),
  })
}

export async function addServiceApi(
  workOrderId: string,
  service: Omit<ServiceItem, 'id'>,
  force = false,
) {
  await api(`/api/workorders/${workOrderId}/services`, {
    method: 'POST',
    body: JSON.stringify({ title: service.title, price: service.price, force }),
  })
}

export async function updateServiceApi(
  workOrderId: string,
  serviceId: string,
  data: Omit<ServiceItem, 'id'>,
) {
  await api(`/api/workorders/${workOrderId}/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: data.title, price: data.price }),
  })
}

export async function deleteServiceApi(workOrderId: string, serviceId: string) {
  await api(`/api/workorders/${workOrderId}/services/${serviceId}`, { method: 'DELETE' })
}

export async function addPartApi(
  workOrderId: string,
  product: Omit<ProductItem, 'id'>,
  force = false,
) {
  await api(`/api/workorders/${workOrderId}/parts`, {
    method: 'POST',
    body: JSON.stringify({
      stockProductId: product.stockProductId ?? null,
      name: product.name,
      quantity: product.quantity,
      unitPrice: product.price,
      source: product.source,
      supplierId: product.supplierId ?? null,
      purchasePrice: product.purchasePrice ?? null,
      force,
    }),
  })
}

export async function updatePartApi(
  workOrderId: string,
  partId: string,
  data: Omit<ProductItem, 'id'>,
) {
  await api(`/api/workorders/${workOrderId}/parts/${partId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: data.name,
      quantity: data.quantity,
      unitPrice: data.price,
    }),
  })
}

export async function deletePartApi(workOrderId: string, partId: string) {
  await api(`/api/workorders/${workOrderId}/parts/${partId}`, { method: 'DELETE' })
}

export async function returnPartToSupplier(workOrderId: string, partId: string) {
  await api(`/api/workorders/${workOrderId}/parts/${partId}/return-to-supplier`, { method: 'POST' })
}

export async function updateComplaintApi(workOrderId: string, complaintId: string, text: string) {
  await api(`/api/workorders/${workOrderId}/complaints/${complaintId}`, {
    method: 'PUT',
    body: JSON.stringify({ description: text }),
  })
}

export type StatusHistoryEntry = {
  id: string
  oldStatus?: string | null
  newStatus: string
  changedAt: string
  changedByName?: string | null
}

export async function getWorkOrderHistory(workOrderId: string): Promise<StatusHistoryEntry[]> {
  return api<StatusHistoryEntry[]>(`/api/workorders/${workOrderId}/history`)
}

export async function openNewVisit(vehicleId: string, complaint?: string): Promise<Vehicle> {
  const res = await api<{ vehicleId: string; workOrderId: string }>(
    `/api/vehicles/${vehicleId}/new-visit`,
    {
      method: 'POST',
      body: JSON.stringify({ complaint: complaint || null }),
    },
  )
  return refreshVehicle(res.workOrderId)
}

export type StockProductLite = {
  id: string
  name: string
  price: number
  quantity: number
}

export async function listStockProducts(search?: string): Promise<StockProductLite[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : ''
  const rows = await api<{ id: string; name: string; price: number; quantity: number }[]>(
    `/api/stock${q}`,
  )
  return rows.map((s) => ({ id: s.id, name: s.name, price: Number(s.price), quantity: s.quantity }))
}

export type WorkOrderImage = {
  id: string
  imageType: string
  url: string
  createdAt: string
}

export async function getWorkOrderImages(workOrderId: string): Promise<WorkOrderImage[]> {
  return api<WorkOrderImage[]>(`/api/workorders/${workOrderId}/images`)
}

export async function uploadWorkOrderImage(
  workOrderId: string,
  imageUri: string,
  imageType: 'ruhsat' | 'arac' | 'hasar' | 'diger',
): Promise<WorkOrderImage> {
  const fileName = imageUri.split('/').pop() || `foto-${Date.now()}.jpg`
  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'jpg'
  const form = new FormData()
  form.append('file', {
    uri: imageUri,
    name: fileName,
    type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  } as unknown as Blob)
  form.append('imageType', imageType)

  const headers: Record<string, string> = {}
  const t = await loadToken()
  if (t) headers.Authorization = `Bearer ${t}`

  const res = await fetch(`${API_BASE_URL}/api/workorders/${workOrderId}/images`, {
    method: 'POST',
    headers,
    body: form,
  })
  if (!res.ok) {
    let body: any = null
    try {
      body = await res.json()
    } catch {
      /* ignore */
    }
    throw new Error(body?.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function absoluteImageUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

export async function ensureCustomer(data: Omit<Customer, 'id'>): Promise<Customer> {
  return createCustomer(data)
}

export type SupplierTransaction = {
  id: string
  type: 'alis' | 'odeme' | 'iade'
  amount: number
  description?: string
  createdAt: string
}

export type SupplierLedger = {
  supplier: Supplier
  transactions: SupplierTransaction[]
}

export type SupplierReportRow = {
  supplierId: string
  supplierName: string
  totalPurchases: number
  totalReturns: number
  transactionCount: number
}

function mapSupplier(s: {
  id: string
  name: string
  contact?: string
  phone?: string
  email?: string
  address?: string
  taxNo?: string
  balance: number
}): Supplier {
  return {
    id: s.id,
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    email: s.email,
    address: s.address,
    taxNo: s.taxNo,
    balance: Number(s.balance),
  }
}

export async function listSuppliers(search?: string): Promise<Supplier[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : ''
  const rows = await api<Parameters<typeof mapSupplier>[0][]>(`/api/suppliers${q}`)
  return rows.map(mapSupplier)
}

export async function createSupplier(data: {
  name: string
  contact?: string
  phone?: string
  email?: string
  address?: string
  taxNo?: string
  openingBalance?: number
}): Promise<Supplier> {
  const s = await api<Parameters<typeof mapSupplier>[0]>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      contact: data.contact || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      taxNo: data.taxNo || null,
      openingBalance: data.openingBalance ?? 0,
    }),
  })
  return mapSupplier(s)
}

export async function getSupplierLedger(id: string): Promise<SupplierLedger> {
  const res = await api<{
    supplier: Parameters<typeof mapSupplier>[0]
    transactions: SupplierTransaction[]
  }>(`/api/suppliers/${id}`)
  return {
    supplier: mapSupplier(res.supplier),
    transactions: res.transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
  }
}

export async function recordSupplierPayment(
  id: string,
  amount: number,
  description?: string,
): Promise<SupplierLedger> {
  const res = await api<{
    supplier: Parameters<typeof mapSupplier>[0]
    transactions: SupplierTransaction[]
  }>(`/api/suppliers/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ amount, description: description || null }),
  })
  return {
    supplier: mapSupplier(res.supplier),
    transactions: res.transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
  }
}

export async function getSupplierReport(
  period: 'daily' | 'weekly',
  date: string,
): Promise<SupplierReportRow[]> {
  const rows = await api<{
    supplierId: string
    supplierName: string
    totalPurchases: number
    totalReturns: number
    transactionCount: number
  }[]>(`/api/suppliers/report?period=${period}&date=${date}`)
  return rows.map((r) => ({
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    totalPurchases: Number(r.totalPurchases),
    totalReturns: Number(r.totalReturns),
    transactionCount: r.transactionCount,
  }))
}
