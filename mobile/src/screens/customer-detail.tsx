import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import {
  CarFront,
  ChevronDown,
  ChevronUp,
  History,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react-native'
import type { Customer } from '@/lib/types'
import { colors } from '@/lib/theme'
import { cardShadow, VehicleCard } from '@/components/vehicle-card'
import { CustomerForm } from '@/screens/customers'
import { TextField, TextArea } from '@/components/form-field'
import {
  SupplierTxDetailSheet,
  SupplierTxGroupedList,
  SUPPLIER_TX_LABELS,
} from '@/components/supplier-tx-detail'
import { formatCurrency, formatDate, formatTime } from '@/lib/format'
import {
  deleteSupplierTransaction,
  getCustomerActivity,
  getSupplierLedger,
  loadVehiclesByCustomer,
  recordSupplierDiscount,
  recordSupplierPayment,
  updateSupplierTransaction,
  type ActivityLogEntry,
  type CustomerVehicleSummary,
  type SupplierLedger,
  type SupplierTransaction,
} from '@/lib/api'

export function CustomerDetail({
  customer,
  onBack: _onBack,
  onUpdate,
  onOpenVehicle,
  onChanged,
  allowSuppliers = true,
}: {
  customer: Customer
  onBack: () => void
  onUpdate: (id: string, c: Omit<Customer, 'id'>) => void
  onOpenVehicle: (vehicleId: string) => void
  onChanged: () => void
  allowSuppliers?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [vehicles, setVehicles] = useState<CustomerVehicleSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadVehiclesByCustomer(customer.id)
      .then((rows) => {
        if (active) setVehicles(rows)
      })
      .catch(() => {
        if (active) setVehicles([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [customer.id])

  if (editing) {
    return (
      <CustomerForm
        initial={customer}
        allowSuppliers={allowSuppliers}
        onCancel={() => setEditing(false)}
        onSave={(data) => {
          onUpdate(customer.id, data)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-10">
      <View className="px-5 pt-4">
        <View className="flex-row items-start justify-between">
          <View className="min-w-0 flex-1">
            <Text className="text-2xl font-extrabold text-foreground">{customer.name}</Text>
            <View className="mt-2 flex-row items-center gap-2">
              <Phone size={14} color={colors.mutedForeground} />
              <Text className="text-sm text-muted-foreground">{customer.phone || '—'}</Text>
            </View>
            {customer.address ? (
              <View className="mt-1 flex-row items-center gap-2">
                <MapPin size={14} color={colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground">{customer.address}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => setEditing(true)}
            className="h-10 w-10 items-center justify-center rounded-xl bg-secondary"
          >
            <Pencil size={16} color={colors.secondaryForeground} />
          </Pressable>
        </View>

        {customer.isCustomer !== false ? (
          <View className="mt-4 rounded-2xl border border-border bg-card px-5 py-4" style={cardShadow}>
            <View className="flex-row items-center gap-2">
              <Wallet size={16} color={colors.primary} />
              <Text className="text-sm font-semibold text-muted-foreground">Müşteri Alacağı</Text>
            </View>
            <Text
              className={
                (customer.balance ?? 0) > 0
                  ? 'mt-1 text-2xl font-extrabold text-destructive'
                  : 'mt-1 text-2xl font-extrabold text-foreground'
              }
            >
              {formatCurrency(customer.balance ?? 0)}
            </Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {(customer.balance ?? 0) > 0
                ? 'Ödenmemiş iş emri bakiyeleri toplamı.'
                : 'Açık alacak bulunmuyor.'}
            </Text>
          </View>
        ) : null}

        {customer.isSupplier && allowSuppliers ? (
          <SupplierLedgerSection customerId={customer.id} onChanged={onChanged} />
        ) : null}

        <Text className="mb-2 mt-6 text-sm font-bold text-muted-foreground">Araçlar</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : vehicles.length === 0 ? (
          <View className="items-center py-10">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <CarFront size={28} color={colors.mutedForeground} />
            </View>
            <Text className="mt-3 text-sm font-medium text-muted-foreground">
              Kayıtlı araç yok.
            </Text>
          </View>
        ) : (
          <View className="flex flex-col gap-2">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={{
                  plate: v.plate,
                  brand: v.brand,
                  model: v.model,
                  status: v.status,
                  createdAt: new Date().toISOString(),
                  customer: { name: customer.name },
                }}
                onPress={() => onOpenVehicle(v.id)}
              />
            ))}
          </View>
        )}

        <View className="mt-6">
          <ActivityHistorySection customerId={customer.id} />
        </View>
      </View>
    </ScrollView>
  )
}

function ActivityHistorySection({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoading(true)
      getCustomerActivity(customerId)
        .then((rows) => {
          setEntries(rows)
          setLoaded(true)
        })
        .catch(() => setEntries([]))
        .finally(() => setLoading(false))
    }
  }

  return (
    <View className="rounded-2xl border border-border bg-card" style={cardShadow}>
      <Pressable
        onPress={toggle}
        className="flex-row items-center justify-between px-4 py-3.5"
      >
        <View className="flex-row items-center gap-2">
          <History size={16} color={colors.primary} />
          <Text className="text-sm font-bold text-foreground">Aktivite Geçmişi</Text>
        </View>
        {open ? (
          <ChevronUp size={18} color={colors.mutedForeground} />
        ) : (
          <ChevronDown size={18} color={colors.mutedForeground} />
        )}
      </Pressable>
      {open ? (
        <View className="border-t border-border px-4 pb-3 pt-2">
          {loading ? (
            <View className="items-center py-6">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : entries.length === 0 ? (
            <Text className="py-3 text-xs text-muted-foreground">
              Henüz bir aktivite kaydı yok.
            </Text>
          ) : (
            entries.map((e, i) => (
              <View
                key={e.id}
                className={
                  i > 0
                    ? 'border-t border-border py-2.5'
                    : 'py-2.5'
                }
              >
                <Text className="text-sm font-medium text-foreground">{e.description}</Text>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">
                    {e.userName ?? 'Sistem'}
                  </Text>
                  <Text className="text-xs font-medium text-muted-foreground">
                    {formatDate(e.createdAt)} {formatTime(e.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  )
}

type LedgerFormMode = 'pay' | 'discount' | 'edit' | null

function SupplierLedgerSection({
  customerId,
  onChanged,
}: {
  customerId: string
  onChanged: () => void
}) {
  const [ledger, setLedger] = useState<SupplierLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [formMode, setFormMode] = useState<LedgerFormMode>(null)
  const [editTx, setEditTx] = useState<SupplierTransaction | null>(null)
  const [detailTx, setDetailTx] = useState<SupplierTransaction | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState<'nakit' | 'kart' | 'havale'>('nakit')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const l = await getSupplierLedger(customerId)
      setLedger(l)
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Cari bilgisi yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  function openPay() {
    setEditTx(null)
    setAmount('')
    setDescription('')
    setMethod('nakit')
    setFormMode('pay')
  }

  function openDiscount() {
    setEditTx(null)
    setAmount('')
    setDescription('')
    setFormMode('discount')
  }

  function openEdit(tx: SupplierTransaction) {
    setDetailTx(null)
    setEditTx(tx)
    setAmount(String(tx.amount))
    setDescription(tx.description ?? '')
    setMethod(
      tx.method === 'kart' || tx.method === 'havale' ? tx.method : 'nakit',
    )
    setFormMode('edit')
  }

  function closeForm() {
    setFormMode(null)
    setEditTx(null)
    setAmount('')
    setDescription('')
  }

  async function saveForm() {
    const value = Number(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Geçersiz tutar', "0'dan büyük bir tutar girin.")
      return
    }
    setSaving(true)
    try {
      let l: SupplierLedger
      if (formMode === 'pay') {
        l = await recordSupplierPayment(
          customerId,
          value,
          description.trim() || undefined,
          method,
        )
      } else if (formMode === 'discount') {
        l = await recordSupplierDiscount(
          customerId,
          value,
          description.trim() || undefined,
        )
      } else if (formMode === 'edit' && editTx) {
        l = await updateSupplierTransaction(customerId, editTx.id, {
          amount: value,
          description: description.trim() || undefined,
          method: editTx.type === 'odeme' ? method : undefined,
        })
      } else {
        return
      }
      setLedger(l)
      onChanged()
      closeForm()
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(tx: SupplierTransaction) {
    Alert.alert(
      'Hareketi sil',
      `${SUPPLIER_TX_LABELS[tx.type] ?? tx.type} · ${formatCurrency(tx.amount)} silinsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const l = await deleteSupplierTransaction(customerId, tx.id)
              setLedger(l)
              onChanged()
            } catch (e) {
              Alert.alert('Hata', e instanceof Error ? e.message : 'Silinemedi.')
            }
          },
        },
      ],
    )
  }

  if (loading || !ledger) {
    return (
      <View className="mt-3 items-center py-6">
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const { supplier, transactions } = ledger
  const formTitle =
    formMode === 'pay'
      ? 'Tedarikçiye Ödeme'
      : formMode === 'discount'
        ? 'Tedarikçi İskontosu'
        : formMode === 'edit'
          ? editTx?.type === 'iskonto'
            ? 'İskontosu Düzenle'
            : 'Tedarikçi Ödemesini Düzenle'
          : ''

  return (
    <View className="mt-3">
      <View className="rounded-2xl bg-foreground px-5 py-4">
        <View className="flex-row items-center gap-2">
          <Wallet size={16} color={colors.background} />
          <Text className="text-sm font-semibold text-background/80">Tedarikçi Borcu</Text>
        </View>
        <Text className="mt-1 text-2xl font-extrabold text-background">
          {formatCurrency(supplier.balance)}
        </Text>
        <Text className="mt-0.5 text-xs text-background/60">
          {supplier.balance > 0
            ? 'Dışarıdan alımlardan biriken borç. Aşağıdan ödeme/iskonto yazın.'
            : 'Bu tedarikçiye güncel borç yok.'}
        </Text>
      </View>

      {formMode ? (
        <View
          className="mt-3 flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4"
          style={cardShadow}
        >
          <Text className="text-base font-bold text-foreground">{formTitle}</Text>
          <TextField
            label="Tutar (₺)"
            value={amount}
            onChange={setAmount}
            inputMode="numeric"
            placeholder="0"
          />
          {(formMode === 'pay' || (formMode === 'edit' && editTx?.type === 'odeme')) && (
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Yöntem
              </Text>
              <View className="flex-row gap-2">
                {(
                  [
                    { key: 'nakit', label: 'Nakit' },
                    { key: 'kart', label: 'Kart' },
                    { key: 'havale', label: 'Havale' },
                  ] as const
                ).map((m) => {
                  const active = method === m.key
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setMethod(m.key)}
                      className={
                        active
                          ? 'h-11 flex-1 items-center justify-center rounded-xl bg-primary'
                          : 'h-11 flex-1 items-center justify-center rounded-xl bg-secondary'
                      }
                    >
                      <Text
                        className={
                          active
                            ? 'text-sm font-bold text-primary-foreground'
                            : 'text-sm font-bold text-secondary-foreground'
                        }
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )}
          <TextArea
            label="Açıklama (isteğe bağlı)"
            value={description}
            onChange={setDescription}
            rows={2}
            placeholder={formMode === 'discount' ? 'Örn: Kampanya iskontosu' : 'Örn: Nakit ödeme'}
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={saveForm}
              disabled={saving}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-accent"
            >
              <Text className="text-sm font-extrabold text-accent-foreground">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Text>
            </Pressable>
            <Pressable
              onPress={closeForm}
              className="h-12 items-center justify-center rounded-xl bg-secondary px-5"
            >
              <Text className="text-sm font-bold text-secondary-foreground">Vazgeç</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={openPay}
            className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
          >
            <Plus size={20} color={colors.primary} />
            <Text className="text-base font-bold text-primary">Tedarikçiye Öde</Text>
          </Pressable>
          <Pressable
            onPress={openDiscount}
            className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
          >
            <Plus size={20} color={colors.primary} />
            <Text className="text-base font-bold text-primary">İskonto</Text>
          </Pressable>
        </View>
      )}

      <Text className="mb-2 mt-5 text-sm font-bold text-muted-foreground">
        Hareketler · tarihe göre
      </Text>
      {transactions.length === 0 ? (
        <View className="items-center py-10">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <Receipt size={28} color={colors.mutedForeground} />
          </View>
          <Text className="mt-3 text-sm font-medium text-muted-foreground">
            Henüz hareket kaydı yok.
          </Text>
        </View>
      ) : (
        <SupplierTxGroupedList
          transactions={transactions}
          onPress={setDetailTx}
        />
      )}

      <SupplierTxDetailSheet
        tx={detailTx}
        supplierName={supplier.name}
        onClose={() => setDetailTx(null)}
        onEdit={(t) => openEdit(t)}
        onDelete={(t) => {
          setDetailTx(null)
          confirmDelete(t)
        }}
      />
    </View>
  )
}
