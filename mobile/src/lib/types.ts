export type JobStatus = 'bekliyor' | 'islemde' | 'tamamlandi'

export interface Customer {
  id: string
  name: string
  phone: string
  address?: string
  isSupplier?: boolean
  isCustomer?: boolean
}

export interface Complaint {
  id: string
  text: string
  createdAt: string
}

export interface ServiceItem {
  id: string
  title: string
  price: number
}

export interface ProductItem {
  id: string
  name: string
  quantity: number
  price: number
  source: 'stok' | 'disaridan'
  supplierId?: string
  supplierName?: string
  purchasePrice?: number
  returnedAt?: string
  /** Stok kataloğundan seçildiyse — sadece ekleme sırasında kullanılır (stok düşümü için). */
  stockProductId?: string
}

export interface Supplier {
  id: string
  name: string
  contact?: string
  phone?: string
  email?: string
  address?: string
  taxNo?: string
  balance: number
}

export type StockCategory = 'yag' | 'filtre' | 'fren' | 'lastik' | 'elektrik' | 'diger'

export interface StockProduct {
  id: string
  name: string
  category: StockCategory
  code: string
  price: number
  stock: number
}

export const STOCK_CATEGORY_LABELS: Record<StockCategory, string> = {
  yag: 'Yağ',
  filtre: 'Filtre',
  fren: 'Fren',
  lastik: 'Lastik',
  elektrik: 'Elektrik',
  diger: 'Diğer',
}

export interface Vehicle {
  id: string
  /** SQL Server iş emri — API işlemleri için gerekli */
  workOrderId: string
  plate: string
  brand: string
  model: string
  year: string
  color: string
  fuel: string
  chassis: string
  engineNo: string
  engineVolume: string
  km: string
  status: JobStatus
  assignedTo?: string
  createdAt: string
  startedAt?: string
  closedAt?: string
  laborTotal?: number
  partsTotal?: number
  grandTotal?: number
  customer: Customer
  complaints: Complaint[]
  services: ServiceItem[]
  products: ProductItem[]
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  bekliyor: 'Bekliyor',
  islemde: 'İşlemde',
  tamamlandi: 'Tamamlandı',
}
