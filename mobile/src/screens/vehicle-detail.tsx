import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
  ArrowLeft,
  Phone,
  MapPin,
  Plus,
  Wrench,
  Package,
  MessageSquareWarning,
  Info,
  Check,
  Pencil,
  Trash2,
  User,
  Truck,
  Undo2,
  Search,
  X,
  Share2,
  ChevronDown,
  ChevronUp,
  History,
  Camera,
  ImagePlus,
  PlayCircle,
  CalendarPlus,
} from 'lucide-react-native'
import { cn } from '@/lib/utils'
import {
  STATUS_LABELS,
  type JobStatus,
  type ProductItem,
  type ServiceItem,
  type Supplier,
  type Vehicle,
} from '@/lib/types'
import { TextField, TextArea } from '@/components/form-field'
import { formatCurrency, formatDate, formatTime } from '@/lib/format'
import { colors, withAlpha } from '@/lib/theme'
import { cardShadow } from '@/components/vehicle-card'
import type { CurrentUser, StaffMember, StatusHistoryEntry, StockProductLite, WorkOrderImage } from '@/lib/api'
import {
  absoluteImageUrl,
  createSupplier,
  getWorkOrderHistory,
  getWorkOrderImages,
  listStockProducts,
  listSuppliers,
  uploadWorkOrderImage,
  WorkOrderCompletedError,
  WorkOrderReopenBlockedError,
} from '@/lib/api'
import {
  SERVICE_CATEGORY_LABELS,
  serviceCatalog as defaultCatalog,
  type ServiceCatalogCategory,
  type ServiceCatalogItem,
} from '@/lib/service-catalog'

const ASSIGNABLE_ROLES = ['admin', 'usta']

function showError(e: unknown) {
  Alert.alert('Hata', e instanceof Error ? e.message : 'İşlem başarısız.')
}

function normalizePhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[^\d]/g, '')
  if (p.startsWith('90') && p.length > 10) p = p.slice(2)
  if (p.startsWith('0')) p = p.slice(1)
  return `90${p}`
}

function buildSummaryText(vehicle: Vehicle): string {
  const activeProducts = vehicle.products.filter((p) => !p.returnedAt)
  const laborTotal = vehicle.laborTotal ?? vehicle.services.reduce((s, i) => s + i.price, 0)
  const partsTotal =
    vehicle.partsTotal ?? activeProducts.reduce((s, i) => s + i.price * i.quantity, 0)
  const grandTotal = vehicle.grandTotal ?? laborTotal + partsTotal

  const lines: string[] = [
    `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}`,
    `Müşteri: ${vehicle.customer.name}`,
    `Durum: ${STATUS_LABELS[vehicle.status]}`,
  ]

  if (vehicle.services.length > 0) {
    lines.push('', 'İşlemler:')
    vehicle.services.forEach((s) => lines.push(`- ${s.title}: ${formatCurrency(s.price)}`))
  }
  if (activeProducts.length > 0) {
    lines.push('', 'Ürün / Parça:')
    activeProducts.forEach((p) =>
      lines.push(`- ${p.name} (${p.quantity} adet): ${formatCurrency(p.price * p.quantity)}`),
    )
  }

  lines.push(
    '',
    `İşçilik: ${formatCurrency(laborTotal)}`,
    `Malzeme: ${formatCurrency(partsTotal)}`,
    `Toplam: ${formatCurrency(grandTotal)}`,
  )
  return lines.join('\n')
}

function buildSummaryHtml(vehicle: Vehicle): string {
  const activeProducts = vehicle.products.filter((p) => !p.returnedAt)
  const laborTotal = vehicle.laborTotal ?? vehicle.services.reduce((s, i) => s + i.price, 0)
  const partsTotal =
    vehicle.partsTotal ?? activeProducts.reduce((s, i) => s + i.price * i.quantity, 0)
  const grandTotal = vehicle.grandTotal ?? laborTotal + partsTotal

  const serviceRows = vehicle.services
    .map(
      (s) => `<tr><td>${s.title}</td><td class="right">${formatCurrency(s.price)}</td></tr>`,
    )
    .join('')
  const productRows = activeProducts
    .map(
      (p) =>
        `<tr><td>${p.name} (${p.quantity} adet)</td><td class="right">${formatCurrency(p.price * p.quantity)}</td></tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #555; margin-top: 24px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  td { padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
  .right { text-align: right; }
  .meta { font-size: 13px; color: #444; line-height: 1.6; }
  .totals td { font-size: 14px; padding: 4px 0; border-bottom: none; }
  .totals .grand { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a1a; padding-top: 8px; }
</style>
</head>
<body>
  <h1>${vehicle.plate} — ${vehicle.brand} ${vehicle.model}</h1>
  <div class="meta">
    Müşteri: ${vehicle.customer.name}<br/>
    Durum: ${STATUS_LABELS[vehicle.status]}
  </div>

  ${vehicle.services.length > 0 ? `<h2>İşlemler</h2><table>${serviceRows}</table>` : ''}
  ${activeProducts.length > 0 ? `<h2>Ürün / Parça</h2><table>${productRows}</table>` : ''}

  <h2>Toplam</h2>
  <table class="totals">
    <tr><td>İşçilik</td><td class="right">${formatCurrency(laborTotal)}</td></tr>
    <tr><td>Malzeme</td><td class="right">${formatCurrency(partsTotal)}</td></tr>
    <tr><td class="grand">Toplam</td><td class="right grand">${formatCurrency(grandTotal)}</td></tr>
  </table>
</body>
</html>`
}

async function sharePdf(vehicle: Vehicle) {
  try {
    const { uri } = await Print.printToFileAsync({ html: buildSummaryHtml(vehicle) })
    const canShare = await Sharing.isAvailableAsync()
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
    } else {
      Alert.alert('Paylaşım kullanılamıyor', 'Bu cihazda paylaşım özelliği bulunamadı.')
    }
  } catch (e) {
    showError(e)
  }
}

async function shareAsText(vehicle: Vehicle) {
  try {
    await Share.share({ message: buildSummaryText(vehicle) })
  } catch (e) {
    showError(e)
  }
}

async function shareViaWhatsApp(vehicle: Vehicle) {
  const text = buildSummaryText(vehicle)
  const phone = normalizePhoneForWhatsApp(vehicle.customer.phone)
  const appUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`
  const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  try {
    const canOpen = await Linking.canOpenURL(appUrl)
    await Linking.openURL(canOpen ? appUrl : webUrl)
  } catch {
    Alert.alert('WhatsApp açılamadı', 'WhatsApp yüklü değil veya açılamadı.')
  }
}

type Tab = 'bilgiler' | 'sikayet' | 'islem' | 'urun'
type IconType = typeof Wrench

const tabs: { key: Tab; label: string }[] = [
  { key: 'bilgiler', label: 'Bilgiler' },
  { key: 'sikayet', label: 'Şikayet' },
  { key: 'islem', label: 'İşlemler' },
  { key: 'urun', label: 'Ürünler' },
]

export function VehicleDetail({
  vehicle,
  serviceCatalog: catalogProp,
  currentUser,
  staff,
  onBack,
  onAddComplaint,
  onUpdateComplaint,
  onAddService,
  onUpdateService,
  onDeleteService,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onReturnProductToSupplier,
  onSetStatus,
  onOpenNewVisit,
}: {
  vehicle: Vehicle
  serviceCatalog?: ServiceCatalogItem[]
  currentUser: CurrentUser | null
  staff: StaffMember[]
  onBack: () => void
  onAddComplaint: (text: string) => void
  onUpdateComplaint: (complaintId: string, text: string) => void
  onAddService: (s: Omit<ServiceItem, 'id'>, force?: boolean) => Promise<void>
  onUpdateService: (id: string, s: Omit<ServiceItem, 'id'>) => void
  onDeleteService: (id: string) => void
  onAddProduct: (p: Omit<ProductItem, 'id'>, force?: boolean) => Promise<void>
  onUpdateProduct: (id: string, p: Omit<ProductItem, 'id'>) => void
  onDeleteProduct: (id: string) => void
  onReturnProductToSupplier: (id: string) => void
  onSetStatus: (
    status: JobStatus,
    assignment?: { assignedUserId?: string; assignedUserName?: string },
  ) => Promise<void>
  onOpenNewVisit: (complaint?: string) => void
}) {
  const serviceCatalog = catalogProp ?? defaultCatalog
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('bilgiler')
  const [assignOpen, setAssignOpen] = useState(false)

  const canAssign = !!currentUser && ASSIGNABLE_ROLES.includes(currentUser.role)

  function promptNewVisit() {
    Alert.alert(
      'Yeni Servis Kaydı',
      'Bu araç için yeni bir servis kaydı (iş emri) açılsın mı?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Aç', onPress: () => onOpenNewVisit() },
      ],
    )
  }

  function handleStatusError(e: unknown) {
    if (e instanceof WorkOrderReopenBlockedError) {
      Alert.alert('Durum değiştirilemedi', e.message, [
        { text: 'İptal', style: 'cancel' },
        { text: 'Yeni Servis Kaydı Aç', onPress: () => onOpenNewVisit() },
      ])
    } else {
      showError(e)
    }
  }

  async function handleStatusPress(s: JobStatus) {
    try {
      if (s !== 'islemde') {
        await onSetStatus(s)
        return
      }
      if (canAssign) {
        setAssignOpen(true)
        return
      }
      await onSetStatus(s, currentUser ? { assignedUserId: currentUser.id } : undefined)
    } catch (e) {
      handleStatusError(e)
    }
  }

  async function handleShare() {
    Alert.alert('Paylaş', 'İş emrini nasıl paylaşmak istersiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: "WhatsApp'tan Paylaş", onPress: () => shareViaWhatsApp(vehicle) },
      { text: 'Detay Paylaş', onPress: () => shareAsText(vehicle) },
      { text: 'PDF Paylaş', onPress: () => sharePdf(vehicle) },
    ])
  }

  const laborTotal = vehicle.laborTotal ?? vehicle.services.reduce((s, i) => s + i.price, 0)
  const partsTotal =
    vehicle.partsTotal ??
    vehicle.products
      .filter((p) => !p.returnedAt)
      .reduce((s, i) => s + i.price * i.quantity, 0)
  const total = vehicle.grandTotal ?? laborTotal + partsTotal

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        stickyHeaderIndices={[2]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="rounded-b-3xl bg-primary px-4 pb-5"
          style={{ paddingTop: insets.top + 12 }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={onBack}
                className="h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15"
              >
                <ArrowLeft size={20} color={colors.primaryForeground} />
              </Pressable>
              <View className="rounded-lg bg-primary-foreground px-3 py-1.5">
                <Text className="font-mono text-base font-bold tracking-wide text-primary">
                  {vehicle.plate}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleShare}
              className="h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15"
            >
              <Share2 size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>

          <Text className="mt-4 text-2xl font-extrabold tracking-tight text-primary-foreground">
            {vehicle.brand} {vehicle.model}
          </Text>
          <Text className="text-sm text-primary-foreground/80">
            {vehicle.year} · {vehicle.color} · {vehicle.fuel}
          </Text>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {(Object.keys(STATUS_LABELS) as JobStatus[]).map((s) => {
              const active = vehicle.status === s
              return (
                <Pressable
                  key={s}
                  onPress={() => handleStatusPress(s)}
                  className={cn(
                    'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
                    active ? 'bg-primary-foreground' : 'bg-primary-foreground/15',
                  )}
                >
                  {active && <Check size={14} color={colors.primary} strokeWidth={3} />}
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      active ? 'text-primary' : 'text-primary-foreground',
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {vehicle.status === 'bekliyor' && (
            <Pressable
              onPress={() => handleStatusPress('islemde')}
              className="mt-3 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-90"
            >
              <PlayCircle size={18} color={colors.accentForeground} />
              <Text className="text-sm font-extrabold text-accent-foreground">İşleme Al</Text>
            </Pressable>
          )}

          {vehicle.status === 'tamamlandi' && (
            <Pressable
              onPress={promptNewVisit}
              className="mt-3 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary-foreground/15 active:opacity-90"
            >
              <CalendarPlus size={18} color={colors.primaryForeground} />
              <Text className="text-sm font-extrabold text-primary-foreground">
                Yeni Servis Kaydı
              </Text>
            </Pressable>
          )}

          {vehicle.assignedTo ? (
            <View className="mt-2.5 flex-row items-center gap-1.5">
              <User size={13} color={colors.primaryForeground} />
              <Text className="text-xs font-semibold text-primary-foreground/80">
                Bu işi yapan: {vehicle.assignedTo}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="bg-background px-5 pt-3">
          <StatusTimeline workOrderId={vehicle.workOrderId} />
        </View>

        <View className="bg-background px-3 pt-3" style={{ marginTop: -8 }}>
          <View className="flex-row gap-1 rounded-2xl bg-secondary p-1">
            {tabs.map((t) => {
              const active = tab === t.key
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  className={cn('flex-1 rounded-xl py-2.5', active && 'bg-card')}
                  style={active ? cardShadow : undefined}
                >
                  <Text
                    className={cn(
                      'text-center text-sm font-bold',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View className="px-5 py-5">
          {tab === 'bilgiler' && <InfoTab vehicle={vehicle} />}
          {tab === 'sikayet' && (
            <ComplaintTab vehicle={vehicle} onAdd={onAddComplaint} onUpdate={onUpdateComplaint} />
          )}
          {tab === 'islem' && (
            <ServiceTab
              vehicle={vehicle}
              catalog={serviceCatalog}
              onAdd={onAddService}
              onUpdate={onUpdateService}
              onDelete={onDeleteService}
            />
          )}
          {tab === 'urun' && (
            <ProductTab
              vehicle={vehicle}
              onAdd={onAddProduct}
              onUpdate={onUpdateProduct}
              onDelete={onDeleteProduct}
              onReturnToSupplier={onReturnProductToSupplier}
            />
          )}
        </View>

        {(vehicle.services.length > 0 || vehicle.products.length > 0) && (
          <View className="px-5 pb-5">
            <View className="rounded-2xl bg-foreground px-5 py-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-background/70">İşçilik</Text>
                <Text className="text-sm font-bold text-background/90">
                  {formatCurrency(laborTotal)}
                </Text>
              </View>
              <View className="mt-1.5 flex-row items-center justify-between">
                <Text className="text-sm font-medium text-background/70">Malzeme</Text>
                <Text className="text-sm font-bold text-background/90">
                  {formatCurrency(partsTotal)}
                </Text>
              </View>
              <View className="mt-2.5 flex-row items-center justify-between border-t border-background/15 pt-2.5">
                <Text className="text-sm font-semibold text-background/80">Toplam</Text>
                <Text className="text-xl font-extrabold text-background">
                  {formatCurrency(total)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <AssignmentModal
        visible={assignOpen}
        staff={staff}
        currentUser={currentUser}
        onCancel={() => setAssignOpen(false)}
        onConfirm={(assignment) => {
          setAssignOpen(false)
          onSetStatus('islemde', assignment).catch(handleStatusError)
        }}
      />
    </View>
  )
}

function StatusTimeline({ workOrderId }: { workOrderId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [entries, setEntries] = useState<StatusHistoryEntry[]>([])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoading(true)
      getWorkOrderHistory(workOrderId)
        .then((rows) => {
          setEntries(rows)
          setLoaded(true)
        })
        .catch(() => setEntries([]))
        .finally(() => setLoading(false))
    }
  }

  return (
    <View className="mb-1 rounded-2xl border border-border bg-card">
      <Pressable
        onPress={toggle}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <View className="flex-row items-center gap-2">
          <History size={16} color={colors.primary} />
          <Text className="text-sm font-bold text-foreground">Zaman Çizelgesi</Text>
        </View>
        {open ? (
          <ChevronUp size={18} color={colors.mutedForeground} />
        ) : (
          <ChevronDown size={18} color={colors.mutedForeground} />
        )}
      </Pressable>
      {open && (
        <View className="border-t border-border px-4 pb-3 pt-2">
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : entries.length === 0 ? (
            <Text className="py-2 text-xs text-muted-foreground">
              Henüz durum değişikliği yok.
            </Text>
          ) : (
            entries.map((e, i) => (
              <View
                key={e.id}
                className={cn('flex-row items-center justify-between py-2', i > 0 && 'border-t border-border')}
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {e.oldStatus ? `${STATUS_LABELS[mapHistoryStatus(e.oldStatus)]} → ` : ''}
                    {STATUS_LABELS[mapHistoryStatus(e.newStatus)]}
                  </Text>
                  {e.changedByName ? (
                    <Text className="text-xs text-muted-foreground">{e.changedByName}</Text>
                  ) : null}
                </View>
                <Text className="text-xs font-medium text-muted-foreground">
                  {formatDate(e.changedAt)} {formatTime(e.changedAt)}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  )
}

function mapHistoryStatus(raw: string): JobStatus {
  if (raw === 'islemde') return 'islemde'
  if (raw === 'tamamlandi' || raw === 'teslim_edildi') return 'tamamlandi'
  return 'bekliyor'
}

function AssignmentModal({
  visible,
  staff,
  currentUser,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  staff: StaffMember[]
  currentUser: CurrentUser | null
  onCancel: () => void
  onConfirm: (assignment: { assignedUserId?: string; assignedUserName?: string }) => void
}) {
  const [mode, setMode] = useState<'list' | 'manual'>('list')
  const [selectedId, setSelectedId] = useState(currentUser?.id ?? '')
  const [manualName, setManualName] = useState('')

  function handleShow() {
    setMode('list')
    setSelectedId(currentUser?.id ?? '')
    setManualName('')
  }

  function confirm() {
    if (mode === 'manual') {
      if (!manualName.trim()) return
      onConfirm({ assignedUserName: manualName.trim() })
      return
    }
    if (!selectedId) return
    onConfirm({ assignedUserId: selectedId })
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={handleShow}
      onRequestClose={onCancel}
    >
      <Pressable onPress={onCancel} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}} className="rounded-t-3xl bg-card p-4 pb-8">
          <Text className="px-2 pb-1 pt-1 text-base font-extrabold text-foreground">
            İşi Kim Yapıyor?
          </Text>
          <Text className="px-2 pb-3 text-xs text-muted-foreground">
            İşleme başlamadan önce sorumlu personeli seçin.
          </Text>

          <View className="flex-row gap-1 rounded-2xl bg-secondary p-1">
            <Pressable
              onPress={() => setMode('list')}
              className={cn('flex-1 rounded-xl py-2.5', mode === 'list' && 'bg-card')}
              style={mode === 'list' ? cardShadow : undefined}
            >
              <Text
                className={cn(
                  'text-center text-sm font-bold',
                  mode === 'list' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Personelden Seç
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('manual')}
              className={cn('flex-1 rounded-xl py-2.5', mode === 'manual' && 'bg-card')}
              style={mode === 'manual' ? cardShadow : undefined}
            >
              <Text
                className={cn(
                  'text-center text-sm font-bold',
                  mode === 'manual' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Manuel Giriş
              </Text>
            </Pressable>
          </View>

          {mode === 'list' ? (
            <ScrollView className="mt-3 max-h-72">
              {staff.length === 0 ? (
                <Text className="px-2 py-4 text-sm text-muted-foreground">
                  Kayıtlı personel bulunamadı.
                </Text>
              ) : (
                staff.map((member) => {
                  const active = member.id === selectedId
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => setSelectedId(member.id)}
                      className="flex-row items-center justify-between rounded-xl px-3 py-3.5"
                    >
                      <View>
                        <Text
                          className={cn(
                            'text-base font-semibold',
                            active ? 'text-primary' : 'text-foreground',
                          )}
                        >
                          {member.fullName}
                          {member.id === currentUser?.id ? ' (Ben)' : ''}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {STAFF_ROLE_LABELS[member.role] ?? member.role}
                        </Text>
                      </View>
                      {active && <Check size={20} color={colors.primary} strokeWidth={2.5} />}
                    </Pressable>
                  )
                })
              )}
            </ScrollView>
          ) : (
            <View className="mt-3">
              <TextField
                label="Ad Soyad"
                value={manualName}
                onChange={setManualName}
                placeholder="Örn: Kemal Usta"
              />
            </View>
          )}

          <View className="mt-4 flex-row gap-2">
            <SaveButton onPress={confirm} />
            <CancelButton onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const STAFF_ROLE_LABELS: Record<string, string> = {
  admin: 'Yönetici',
  usta: 'Usta',
  personel: 'Personel',
}

function InfoTab({ vehicle }: { vehicle: Vehicle }) {
  const rows = [
    { label: 'Marka / Model', value: `${vehicle.brand} ${vehicle.model}` },
    { label: 'Model Yılı', value: vehicle.year },
    { label: 'Renk', value: vehicle.color },
    { label: 'Yakıt', value: vehicle.fuel },
    { label: 'Kilometre', value: vehicle.km ? `${vehicle.km} km` : '' },
    { label: 'Şasi No', value: vehicle.chassis, mono: true },
    { label: 'Motor No', value: vehicle.engineNo, mono: true },
    { label: 'Motor Hacmi', value: vehicle.engineVolume },
  ]
  return (
    <View className="flex flex-col gap-5">
      <View className="rounded-2xl border border-border bg-card p-4" style={cardShadow}>
        <View className="flex-row items-center gap-2">
          <Info size={16} color={colors.primary} />
          <Text className="text-sm font-bold text-muted-foreground">
            Araç Bilgileri
          </Text>
        </View>
        <View className="mt-3">
          {rows.map((r, i) => (
            <View
              key={r.label}
              className={cn(
                'flex-row items-center justify-between py-2.5',
                i > 0 && 'border-t border-border',
              )}
            >
              <Text className="text-sm text-muted-foreground">{r.label}</Text>
              <Text
                className={cn(
                  'text-sm font-bold text-foreground',
                  r.mono && 'font-mono text-xs',
                )}
              >
                {r.value || '-'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="rounded-2xl border border-border bg-card p-4" style={cardShadow}>
        <View className="flex-row items-center gap-2">
          <Phone size={16} color={colors.primary} />
          <Text className="text-sm font-bold text-muted-foreground">Müşteri</Text>
        </View>
        <Text className="mt-3 text-lg font-extrabold text-foreground">
          {vehicle.customer.name}
        </Text>
        <Pressable
          onPress={() =>
            Linking.openURL(`tel:${vehicle.customer.phone.replace(/\s/g, '')}`)
          }
          className="mt-2 flex-row items-center gap-2"
        >
          <Phone size={16} color={colors.primary} />
          <Text className="text-sm font-semibold text-primary">
            {vehicle.customer.phone}
          </Text>
        </Pressable>
        {vehicle.customer.address ? (
          <View className="mt-1.5 flex-row items-center gap-2">
            <MapPin size={16} color={colors.mutedForeground} />
            <Text className="text-sm text-muted-foreground">
              {vehicle.customer.address}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function ComplaintTab({
  vehicle,
  onAdd,
  onUpdate,
}: {
  vehicle: Vehicle
  onAdd: (text: string) => void
  onUpdate: (complaintId: string, text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  function save() {
    if (!text.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen şikayet alanını doldurun.')
      return
    }
    onAdd(text.trim())
    if (photoUri) {
      uploadWorkOrderImage(vehicle.workOrderId, photoUri, 'hasar').catch(() => {
        /* fotoğraf yüklenemedi — şikayet zaten kaydedildi, kullanıcıyı bloklamayalım */
      })
    }
    setText('')
    setPhotoUri(null)
    setOpen(false)
  }

  function startEdit(c: { id: string; text: string }) {
    setEditingId(c.id)
    setEditText(c.text)
  }

  function saveEdit() {
    if (!editText.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen şikayet alanını doldurun.')
      return
    }
    if (editingId) onUpdate(editingId, editText.trim())
    setEditingId(null)
    setEditText('')
  }

  return (
    <View className="flex flex-col gap-3">
      {vehicle.complaints.length === 0 && !open && (
        <EmptyState icon={MessageSquareWarning} text="Henüz şikayet eklenmedi." />
      )}

      {vehicle.complaints.map((c) =>
        editingId === c.id ? (
          <View
            key={c.id}
            className="rounded-2xl border-2 border-primary/30 bg-card p-4"
            style={cardShadow}
          >
            <TextArea label="Şikayeti Düzenle" value={editText} onChange={setEditText} rows={4} />
            <View className="mt-3 flex-row gap-2">
              <SaveButton onPress={saveEdit} />
              <CancelButton onPress={() => setEditingId(null)} />
            </View>
          </View>
        ) : (
          <View
            key={c.id}
            className="rounded-2xl border border-border bg-card p-4"
            style={cardShadow}
          >
            <View className="flex-row items-start gap-3">
              <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                <MessageSquareWarning size={16} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium leading-relaxed text-foreground">
                  {c.text}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  {formatTime(c.createdAt)}
                </Text>
              </View>
              <Pressable
                onPress={() => startEdit(c)}
                className="h-9 w-9 items-center justify-center rounded-lg bg-secondary"
              >
                <Pencil size={14} color={colors.secondaryForeground} />
              </Pressable>
            </View>
          </View>
        ),
      )}

      <PhotoGallery workOrderId={vehicle.workOrderId} imageType="hasar" />

      {open ? (
        <View className="rounded-2xl border border-border bg-card p-4" style={cardShadow}>
          <TextArea
            label="Yeni Şikayet"
            value={text}
            onChange={setText}
            rows={4}
            placeholder="Müşterinin belirttiği arıza..."
          />
          <PhotoPicker uri={photoUri} onPick={setPhotoUri} onClear={() => setPhotoUri(null)} />
          <View className="mt-3 flex-row gap-2">
            <SaveButton onPress={save} />
            <CancelButton onPress={() => setOpen(false)} />
          </View>
        </View>
      ) : (
        <AddButton label="Şikayet Ekle" onPress={() => setOpen(true)} />
      )}
    </View>
  )
}

function ServiceTab({
  vehicle,
  catalog,
  onAdd,
  onUpdate,
  onDelete,
}: {
  vehicle: Vehicle
  catalog: ServiceCatalogItem[]
  onAdd: (s: Omit<ServiceItem, 'id'>, force?: boolean) => Promise<void>
  onUpdate: (id: string, s: Omit<ServiceItem, 'id'>) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')

  function reset() {
    setTitle('')
    setPrice('')
    setOpen(false)
    setEditingId(null)
  }

  function startAdd() {
    setEditingId(null)
    setTitle('')
    setPrice('')
    setOpen(true)
  }

  function startEdit(s: ServiceItem) {
    setOpen(false)
    setEditingId(s.id)
    setTitle(s.title)
    setPrice(String(s.price))
  }

  async function commit(priceNum: number, force = false) {
    const data = { title: title.trim(), price: priceNum }
    try {
      if (editingId) {
        onUpdate(editingId, data)
      } else {
        await onAdd(data, force)
      }
      reset()
    } catch (e) {
      if (!force && e instanceof WorkOrderCompletedError) {
        Alert.alert('Bu iş tamamlandı', 'Bu işe ürün/işlem eklemek istediğinize emin misiniz?', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Evet, Ekle', onPress: () => commit(priceNum, true) },
        ])
      } else {
        showError(e)
      }
    }
  }

  function save() {
    if (!title.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen işlem adı alanını doldurun.')
      return
    }
    const priceNum = Number(price) || 0
    if (priceNum === 0) {
      Alert.alert('Fiyat girilmedi', 'Fiyat girmeden kaydetmek istediğinize emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Evet, Kaydet', onPress: () => commit(priceNum) },
      ])
      return
    }
    commit(priceNum)
  }

  const fields = (
    <>
      <ServiceSuggestions
        catalog={catalog}
        onPick={(s) => {
          setTitle(s.name)
          setPrice(String(s.price))
        }}
      />
      <TextField label="Yapılan İşlem" value={title} onChange={setTitle} placeholder="Örn: Yağ değişimi" />
      <TextField label="İşçilik Ücreti (₺)" value={price} onChange={setPrice} inputMode="numeric" placeholder="0" />
    </>
  )

  return (
    <View className="flex flex-col gap-3">
      {vehicle.services.length === 0 && !open && (
        <EmptyState icon={Wrench} text="Henüz işlem eklenmedi." />
      )}

      {vehicle.services.map((s) =>
        editingId === s.id ? (
          <ItemForm key={s.id} onSave={save} onCancel={reset} fields={fields} />
        ) : (
          <Row
            key={s.id}
            icon={Wrench}
            title={s.title}
            value={formatCurrency(s.price)}
            confirming={confirmId === s.id}
            onEdit={() => startEdit(s)}
            onDelete={() => setConfirmId(s.id)}
            onConfirmDelete={() => {
              onDelete(s.id)
              setConfirmId(null)
            }}
            onCancelDelete={() => setConfirmId(null)}
          />
        ),
      )}

      {open ? (
        <ItemForm onSave={save} onCancel={reset} fields={fields} />
      ) : (
        editingId === null && <AddButton label="İşlem Ekle" onPress={startAdd} />
      )}
    </View>
  )
}

function ProductTab({
  vehicle,
  onAdd,
  onUpdate,
  onDelete,
  onReturnToSupplier,
}: {
  vehicle: Vehicle
  onAdd: (p: Omit<ProductItem, 'id'>, force?: boolean) => Promise<void>
  onUpdate: (id: string, p: Omit<ProductItem, 'id'>) => void
  onDelete: (id: string) => void
  onReturnToSupplier: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [returnConfirmId, setReturnConfirmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [source, setSource] = useState<'stok' | 'disaridan'>('stok')
  const [stockProductId, setStockProductId] = useState<string | undefined>(undefined)
  const [supplierId, setSupplierId] = useState<string | undefined>(undefined)
  const [supplierName, setSupplierName] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchasePriceTouched, setPurchasePriceTouched] = useState(false)
  const [photoUri, setPhotoUri] = useState<string | null>(null)

  function reset() {
    setName('')
    setQty('1')
    setPrice('')
    setSource('stok')
    setStockProductId(undefined)
    setSupplierId(undefined)
    setSupplierName('')
    setPurchasePrice('')
    setPurchasePriceTouched(false)
    setPhotoUri(null)
    setOpen(false)
    setEditingId(null)
  }

  function startAdd() {
    setEditingId(null)
    setName('')
    setQty('1')
    setPrice('')
    setSource('stok')
    setStockProductId(undefined)
    setSupplierId(undefined)
    setSupplierName('')
    setPurchasePrice('')
    setPurchasePriceTouched(false)
    setPhotoUri(null)
    setOpen(true)
  }

  function startEdit(p: ProductItem) {
    setOpen(false)
    setEditingId(p.id)
    setName(p.name)
    setQty(String(p.quantity))
    setPrice(String(p.price))
    setSource(p.source ?? 'stok')
    setStockProductId(undefined)
    setSupplierId(p.supplierId)
    setSupplierName(p.supplierName ?? '')
    setPurchasePrice(p.purchasePrice != null ? String(p.purchasePrice) : String(p.price))
    setPurchasePriceTouched(true)
  }

  function handlePriceChange(v: string) {
    setPrice(v)
    if (!purchasePriceTouched) setPurchasePrice(v)
  }

  function handleNameChange(v: string) {
    setName(v)
    if (stockProductId) setStockProductId(undefined)
  }

  async function commit(priceNum: number, force = false) {
    const data: Omit<ProductItem, 'id'> = {
      name: name.trim(),
      quantity: Number(qty) || 1,
      price: priceNum,
      source,
      stockProductId: source === 'stok' ? stockProductId : undefined,
      supplierId: source === 'disaridan' ? supplierId : undefined,
      supplierName: source === 'disaridan' ? supplierName : undefined,
      purchasePrice: source === 'disaridan' ? Number(purchasePrice) || 0 : undefined,
    }
    try {
      if (editingId) {
        onUpdate(editingId, data)
      } else {
        await onAdd(data, force)
        if (photoUri) {
          uploadWorkOrderImage(vehicle.workOrderId, photoUri, 'arac').catch(() => {
            /* fotoğraf yüklenemedi — parça zaten kaydedildi */
          })
        }
      }
      reset()
    } catch (e) {
      if (!force && e instanceof WorkOrderCompletedError) {
        Alert.alert('Bu iş tamamlandı', 'Bu işe ürün/işlem eklemek istediğinize emin misiniz?', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Evet, Ekle', onPress: () => commit(priceNum, true) },
        ])
      } else {
        showError(e)
      }
    }
  }

  function save() {
    if (!name.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen ürün/parça adı alanını doldurun.')
      return
    }
    if (source === 'disaridan' && !supplierId) return
    const priceNum = Number(price) || 0
    if (priceNum === 0) {
      Alert.alert('Fiyat girilmedi', 'Fiyat girmeden kaydetmek istediğinize emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Evet, Kaydet', onPress: () => commit(priceNum) },
      ])
      return
    }
    commit(priceNum)
  }

  const canSave = name.trim().length > 0 && (source === 'stok' || !!supplierId)

  const formFields = (
    <>
      <View className="flex-row gap-1 rounded-2xl bg-secondary p-1">
        <Pressable
          onPress={() => setSource('stok')}
          className={cn('flex-1 rounded-xl py-2.5', source === 'stok' && 'bg-card')}
          style={source === 'stok' ? cardShadow : undefined}
        >
          <Text
            className={cn(
              'text-center text-sm font-bold',
              source === 'stok' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            Stoktan Kullanıldı
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSource('disaridan')}
          className={cn('flex-1 rounded-xl py-2.5', source === 'disaridan' && 'bg-card')}
          style={source === 'disaridan' ? cardShadow : undefined}
        >
          <Text
            className={cn(
              'text-center text-sm font-bold',
              source === 'disaridan' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            Dışarıdan Alındı
          </Text>
        </Pressable>
      </View>

      {source === 'stok' && (
        <StockCatalogPicker
          onPick={(s) => {
            setName(s.name)
            setPrice(String(s.price))
            if (!purchasePriceTouched) setPurchasePrice(String(s.price))
            setStockProductId(s.id)
          }}
        />
      )}

      <TextField
        label="Ürün / Parça Adı"
        value={name}
        onChange={handleNameChange}
        placeholder="Örn: Motor yağı 5W-30"
        required
      />
      <View className="flex-row gap-3">
        <TextField label="Adet" value={qty} onChange={setQty} inputMode="numeric" placeholder="1" className="flex-1" />
        <TextField label="Birim Fiyat (₺)" value={price} onChange={handlePriceChange} inputMode="numeric" placeholder="0" className="flex-1" />
      </View>

      {source === 'disaridan' && (
        <>
          <SupplierPicker
            selectedId={supplierId}
            selectedName={supplierName}
            onSelect={(s) => {
              setSupplierId(s.id)
              setSupplierName(s.name)
            }}
            onClear={() => {
              setSupplierId(undefined)
              setSupplierName('')
            }}
          />
          <TextField
            label="Alış Fiyatı (₺)"
            value={purchasePrice}
            onChange={(v) => {
              setPurchasePrice(v)
              setPurchasePriceTouched(true)
            }}
            inputMode="numeric"
            placeholder="0"
          />
        </>
      )}

      <PhotoPicker uri={photoUri} onPick={setPhotoUri} onClear={() => setPhotoUri(null)} />
    </>
  )

  return (
    <View className="flex flex-col gap-3">
      {vehicle.products.length === 0 && !open && (
        <EmptyState icon={Package} text="Henüz ürün/parça eklenmedi." />
      )}

      {vehicle.products.map((p) =>
        editingId === p.id ? (
          <ItemForm key={p.id} onSave={save} onCancel={reset} fields={formFields} disabled={!canSave} />
        ) : (
          <ProductRow
            key={p.id}
            product={p}
            confirming={confirmId === p.id}
            returnConfirming={returnConfirmId === p.id}
            onEdit={() => startEdit(p)}
            onDelete={() => setConfirmId(p.id)}
            onConfirmDelete={() => {
              onDelete(p.id)
              setConfirmId(null)
            }}
            onCancelDelete={() => setConfirmId(null)}
            onRequestReturn={() => setReturnConfirmId(p.id)}
            onConfirmReturn={() => {
              onReturnToSupplier(p.id)
              setReturnConfirmId(null)
            }}
            onCancelReturn={() => setReturnConfirmId(null)}
          />
        ),
      )}

      <PhotoGallery workOrderId={vehicle.workOrderId} imageType="arac" />

      {open ? (
        <ItemForm onSave={save} onCancel={reset} fields={formFields} disabled={!canSave} />
      ) : (
        editingId === null && <AddButton label="Ürün Ekle" onPress={startAdd} />
      )}
    </View>
  )
}

function StockCatalogPicker({ onPick }: { onPick: (s: StockProductLite) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockProductLite[]>([])
  const [loading, setLoading] = useState(false)
  const [pickedName, setPickedName] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    listStockProducts(query)
      .then((rows) => {
        if (active) setResults(rows)
      })
      .catch(() => {
        if (active) setResults([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query])

  return (
    <View className="flex flex-col gap-1.5">
      <Text className="text-sm font-semibold text-muted-foreground">Stok Ürünü Ara</Text>
      <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4">
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={(v) => {
            setQuery(v)
            setPickedName(null)
          }}
          placeholder="Ürün adı veya kodu ara"
          placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
          className="h-12 flex-1 text-sm font-medium text-foreground"
        />
      </View>
      {!loading && !pickedName && results.length > 0 && (
        <View className="flex flex-col gap-1.5">
          {results.slice(0, 6).map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                onPick(s)
                setPickedName(s.name)
              }}
              className="flex-row items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 active:bg-primary/5"
            >
              <View className="min-w-0 flex-1 flex-row items-center gap-2">
                <Package size={14} color={colors.mutedForeground} />
                <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                  {s.name}
                </Text>
              </View>
              <Text className="text-xs font-bold text-muted-foreground">
                {formatCurrency(s.price)} · {s.quantity} adet
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {!loading && query.trim().length > 0 && results.length === 0 && !pickedName && (
        <Text className="px-1 text-xs text-muted-foreground">
          Katalogda bulunamadı. Aşağıya elle girebilirsin.
        </Text>
      )}
      {pickedName && (
        <View className="flex-row items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1.5">
          <Check size={12} color={colors.primary} />
          <Text className="text-xs font-bold text-primary">{pickedName} seçildi</Text>
        </View>
      )}
    </View>
  )
}

function SupplierPicker({
  selectedId,
  selectedName,
  onSelect,
  onClear,
}: {
  selectedId?: string
  selectedName: string
  onSelect: (s: Supplier) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [quickAdd, setQuickAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    listSuppliers(query)
      .then((rows) => {
        if (active) setResults(rows)
      })
      .catch(() => {
        if (active) setResults([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query])

  async function handleQuickAdd() {
    if (!newName.trim()) return
    try {
      const created = await createSupplier({ name: newName.trim(), phone: newPhone.trim() || undefined })
      onSelect(created)
      setQuickAdd(false)
      setNewName('')
      setNewPhone('')
    } catch {
      /* hata mesajı üst seviyede zaten gösterilir */
    }
  }

  if (quickAdd) {
    return (
      <View className="rounded-xl border border-border bg-card p-3">
        <Text className="mb-2 text-xs font-bold text-muted-foreground">Yeni Cari Ekle</Text>
        <View className="flex flex-col gap-2">
          <TextField label="Tedarikçi Adı" value={newName} onChange={setNewName} placeholder="Örn: Bosch Yetkili Bayi" />
          <TextField label="Telefon (isteğe bağlı)" value={newPhone} onChange={setNewPhone} inputMode="tel" placeholder="05XX XXX XX XX" />
          <View className="flex-row gap-2">
            <SaveButton onPress={handleQuickAdd} />
            <CancelButton onPress={() => setQuickAdd(false)} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="flex flex-col gap-1.5">
      <Text className="text-sm font-semibold text-muted-foreground">Tedarikçi</Text>
      {selectedId ? (
        <View className="flex-row items-center justify-between rounded-xl border-2 border-primary bg-primary/5 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Truck size={16} color={colors.primary} />
            <Text className="text-sm font-bold text-foreground">{selectedName}</Text>
          </View>
          <Pressable onPress={onClear}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : (
        <>
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4">
            <Search size={18} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tedarikçi ara"
              placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
              className="h-12 flex-1 text-sm font-medium text-foreground"
            />
          </View>
          {!loading && results.length > 0 && (
            <View className="flex flex-col gap-1.5">
              {results.slice(0, 5).map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => onSelect(s)}
                  className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 active:bg-primary/5"
                >
                  <Truck size={14} color={colors.mutedForeground} />
                  <Text className="text-sm font-semibold text-foreground">{s.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable
            onPress={() => {
              setQuickAdd(true)
              setNewName(query)
            }}
            className="flex-row items-center gap-1.5 self-start rounded-lg px-1 py-1.5"
          >
            <Plus size={14} color={colors.primary} />
            <Text className="text-xs font-bold text-primary">Yeni Cari Ekle</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

function ProductRow({
  product,
  confirming,
  returnConfirming,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onRequestReturn,
  onConfirmReturn,
  onCancelReturn,
}: {
  product: ProductItem
  confirming: boolean
  returnConfirming: boolean
  onEdit: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onRequestReturn: () => void
  onConfirmReturn: () => void
  onCancelReturn: () => void
}) {
  if (confirming) {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3">
        <View className="flex-1 pl-1">
          <Text className="text-sm font-bold text-foreground">Silinsin mi?</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {product.name}
          </Text>
        </View>
        <Pressable
          onPress={onConfirmDelete}
          className="h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-destructive px-4"
        >
          <Trash2 size={16} color={colors.destructiveForeground} />
          <Text className="text-sm font-bold text-destructive-foreground">Sil</Text>
        </Pressable>
        <Pressable
          onPress={onCancelDelete}
          className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
        >
          <X size={20} color={colors.secondaryForeground} />
        </Pressable>
      </View>
    )
  }

  if (returnConfirming) {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl border-2 border-accent/40 bg-accent/5 p-3">
        <View className="flex-1 pl-1">
          <Text className="text-sm font-bold text-foreground">Tedarikçiye iade edilsin mi?</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {product.name} — bu satır iş emri toplamından kaldırılacak.
          </Text>
        </View>
        <Pressable
          onPress={onConfirmReturn}
          className="h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-accent px-4"
        >
          <Undo2 size={16} color={colors.accentForeground} />
          <Text className="text-sm font-bold text-accent-foreground">İade Et</Text>
        </Pressable>
        <Pressable
          onPress={onCancelReturn}
          className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
        >
          <X size={20} color={colors.secondaryForeground} />
        </Pressable>
      </View>
    )
  }

  const isReturned = !!product.returnedAt
  const isExternal = product.source === 'disaridan'

  return (
    <View
      className={cn(
        'rounded-2xl border border-border bg-card p-4',
        isReturned && 'opacity-60',
      )}
      style={cardShadow}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Package size={20} color={colors.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-bold text-foreground">{product.name}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {product.quantity} adet × {formatCurrency(product.price)}
          </Text>
          <Text className="mt-0.5 text-sm font-extrabold text-foreground">
            {formatCurrency(product.price * product.quantity)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={onEdit}
            className="h-10 w-10 items-center justify-center rounded-xl bg-secondary"
          >
            <Pencil size={16} color={colors.secondaryForeground} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            className="h-10 w-10 items-center justify-center rounded-xl bg-destructive/10"
          >
            <Trash2 size={16} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      {isExternal && (
        <View className="mt-3 flex-row flex-wrap items-center gap-2 border-t border-border pt-3">
          <View className="flex-row items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1">
            <Truck size={12} color={colors.accent} />
            <Text className="text-xs font-bold text-accent">
              {product.supplierName ?? 'Tedarikçi'}
            </Text>
          </View>
          {isReturned ? (
            <View className="rounded-full bg-secondary px-2.5 py-1">
              <Text className="text-xs font-bold text-muted-foreground">İade Edildi</Text>
            </View>
          ) : (
            <Pressable
              onPress={onRequestReturn}
              className="flex-row items-center gap-1.5 rounded-full border border-accent/30 px-2.5 py-1 active:bg-accent/10"
            >
              <Undo2 size={12} color={colors.accent} />
              <Text className="text-xs font-bold text-accent">Tedarikçiye İade Et</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

function ServiceSuggestions({
  catalog,
  onPick,
}: {
  catalog: ServiceCatalogItem[]
  onPick: (item: ServiceCatalogItem) => void
}) {
  const cats = Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCatalogCategory[]
  const [cat, setCat] = useState<ServiceCatalogCategory>('periyodik')
  const items = catalog.filter((s) => s.category === cat)

  return (
    <View className="gap-2">
      <Text className="text-xs font-bold text-muted-foreground">
        Hazır servisler
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 4 }}
      >
        {cats.map((c) => {
          const active = c === cat
          return (
            <Pressable
              key={c}
              onPress={() => setCat(c)}
              className={cn(
                'rounded-full px-3 py-1.5',
                active ? 'bg-primary' : 'bg-secondary',
              )}
            >
              <Text
                className={cn(
                  'text-xs font-bold',
                  active ? 'text-primary-foreground' : 'text-secondary-foreground',
                )}
              >
                {SERVICE_CATEGORY_LABELS[c]}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <View className="flex-row flex-wrap gap-2">
        {items.map((s) => (
          <Pressable
            key={s.name}
            onPress={() => onPick(s)}
            className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 active:bg-primary/10"
          >
            <Text className="text-xs font-semibold text-foreground">{s.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function PhotoPicker({
  uri,
  onPick,
  onClear,
}: {
  uri: string | null
  onPick: (uri: string) => void
  onClear: () => void
}) {
  async function pickFrom(source: 'camera' | 'gallery') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf eklemek için izin verin.')
      return
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 })
    if (result.canceled) return
    const asset = result.assets?.[0]
    if (asset?.uri) onPick(asset.uri)
  }

  function pick() {
    Alert.alert('Fotoğraf Ekle', 'Fotoğrafı nereden eklemek istersiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Kamera', onPress: () => pickFrom('camera') },
      { text: 'Galeri', onPress: () => pickFrom('gallery') },
    ])
  }

  return (
    <View className="mt-3">
      {uri ? (
        <View className="flex-row items-center gap-3">
          <Image source={{ uri }} resizeMode="cover" className="h-16 w-16 rounded-xl" />
          <Pressable
            onPress={onClear}
            className="h-9 flex-row items-center gap-1.5 rounded-lg bg-secondary px-3"
          >
            <X size={14} color={colors.secondaryForeground} />
            <Text className="text-xs font-bold text-secondary-foreground">Kaldır</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={pick}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/50"
        >
          <ImagePlus size={16} color={colors.mutedForeground} />
          <Text className="text-sm font-semibold text-muted-foreground">Fotoğraf Ekle</Text>
        </Pressable>
      )}
    </View>
  )
}

function PhotoGallery({ workOrderId, imageType }: { workOrderId: string; imageType: string }) {
  const [images, setImages] = useState<WorkOrderImage[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    getWorkOrderImages(workOrderId)
      .then((rows) => {
        if (active) setImages(rows.filter((r) => r.imageType === imageType))
      })
      .catch(() => {
        /* fotoğraflar yüklenemedi — sekmeyi kullanılamaz hale getirmeyelim */
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [workOrderId, imageType])

  if (!loaded || images.length === 0) return null

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {images.map((img) => (
        <Image
          key={img.id}
          source={{ uri: absoluteImageUrl(img.url) }}
          resizeMode="cover"
          className="h-16 w-16 rounded-xl bg-secondary"
        />
      ))}
    </ScrollView>
  )
}

function Row({
  icon: Icon,
  title,
  subtitle,
  value,
  confirming,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  icon: IconType
  title: string
  subtitle?: string
  value: string
  confirming: boolean
  onEdit: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  if (confirming) {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3">
        <View className="flex-1 pl-1">
          <Text className="text-sm font-bold text-foreground">Silinsin mi?</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable
          onPress={onConfirmDelete}
          className="h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-destructive px-4"
        >
          <Trash2 size={16} color={colors.destructiveForeground} />
          <Text className="text-sm font-bold text-destructive-foreground">Sil</Text>
        </Pressable>
        <Pressable
          onPress={onCancelDelete}
          className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
        >
          <X size={20} color={colors.secondaryForeground} />
        </Pressable>
      </View>
    )
  }

  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4"
      style={cardShadow}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Icon size={20} color={colors.primary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-bold text-foreground">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
        ) : null}
        <Text className="mt-0.5 text-sm font-extrabold text-foreground">{value}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Pressable
          onPress={onEdit}
          className="h-10 w-10 items-center justify-center rounded-xl bg-secondary"
        >
          <Pencil size={16} color={colors.secondaryForeground} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="h-10 w-10 items-center justify-center rounded-xl bg-destructive/10"
        >
          <Trash2 size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  )
}

function ItemForm({
  fields,
  onSave,
  onCancel,
  disabled,
}: {
  fields: React.ReactNode
  onSave: () => void
  onCancel: () => void
  disabled?: boolean
}) {
  return (
    <View
      className="flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4"
      style={cardShadow}
    >
      {fields}
      <View className="flex-row gap-2">
        <SaveButton onPress={onSave} disabled={disabled} />
        <CancelButton onPress={onCancel} />
      </View>
    </View>
  )
}

function EmptyState({ icon: Icon, text }: { icon: IconType; text: string }) {
  return (
    <View className="items-center py-10">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Icon size={28} color={colors.mutedForeground} />
      </View>
      <Text className="mt-3 text-sm font-medium text-muted-foreground">{text}</Text>
    </View>
  )
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
    >
      <Plus size={20} color={colors.primary} />
      <Text className="text-base font-bold text-primary">{label}</Text>
    </Pressable>
  )
}

function SaveButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-accent',
        disabled && 'opacity-40',
      )}
    >
      <Check size={16} color={colors.accentForeground} />
      <Text className="text-sm font-extrabold text-accent-foreground">Kaydet</Text>
    </Pressable>
  )
}

function CancelButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-12 items-center justify-center rounded-xl bg-secondary px-5"
    >
      <Text className="text-sm font-bold text-secondary-foreground">Vazgeç</Text>
    </Pressable>
  )
}
