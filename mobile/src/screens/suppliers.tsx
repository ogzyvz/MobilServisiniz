import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Plus, Truck, Phone, ArrowLeft, Wallet, Receipt, BarChart3 } from 'lucide-react-native'
import type { Supplier } from '@/lib/types'
import { getSupplierLedger, recordSupplierPayment, type SupplierLedger } from '@/lib/api'
import { TextField, TextArea } from '@/components/form-field'
import { formatCurrency, formatDate } from '@/lib/format'
import { colors, withAlpha } from '@/lib/theme'
import { cardShadow } from '@/components/vehicle-card'

export function Suppliers({
  suppliers,
  onAdd,
  onChanged,
  onOpenReport,
}: {
  suppliers: Supplier[]
  onAdd: (data: {
    name: string
    contact?: string
    phone?: string
    email?: string
    address?: string
    taxNo?: string
    openingBalance?: number
  }) => void
  onChanged: () => void
  onOpenReport: () => void
}) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    if (!q) return suppliers
    return suppliers.filter((s) =>
      `${s.name} ${s.phone ?? ''} ${s.contact ?? ''}`.toLocaleLowerCase('tr').includes(q),
    )
  }, [suppliers, query])

  if (selectedId) {
    return (
      <SupplierLedgerView
        supplierId={selectedId}
        onBack={() => setSelectedId(null)}
        onChanged={onChanged}
      />
    )
  }

  if (creating) {
    return (
      <SupplierForm
        onCancel={() => setCreating(false)}
        onSave={(data) => {
          onAdd(data)
          setCreating(false)
        }}
      />
    )
  }

  return (
    <View className="flex-1">
      <View className="bg-background px-5 pb-3" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-extrabold tracking-tight text-foreground">
              Cariler
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Toplam {suppliers.length} tedarikçi kayıtlı
            </Text>
          </View>
          <Pressable
            onPress={onOpenReport}
            className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
          >
            <BarChart3 size={20} color={colors.secondaryForeground} />
          </Pressable>
        </View>

        <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4">
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tedarikçi adı veya telefon ara"
            placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
            className="h-14 flex-1 text-base font-medium text-foreground"
          />
        </View>

        <Pressable
          onPress={() => setCreating(true)}
          className="mt-3 h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-accent active:opacity-95"
          style={accentShadow}
        >
          <Plus size={24} color={colors.accentForeground} strokeWidth={2.4} />
          <Text className="text-base font-bold text-accent-foreground">
            Yeni Cari Ekle
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View className="mt-16 items-center">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Truck size={32} color={colors.mutedForeground} />
            </View>
            <Text className="mt-4 text-base font-bold text-foreground">
              Tedarikçi bulunamadı
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Aramanı değiştir veya yeni bir cari ekle.
            </Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {filtered.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedId(s.id)}
                className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4"
                style={cardShadow}
              >
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Truck size={22} color={colors.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                    {s.name}
                  </Text>
                  {s.phone ? (
                    <View className="mt-0.5 flex-row items-center gap-1.5">
                      <Phone size={14} color={colors.mutedForeground} />
                      <Text className="text-sm text-muted-foreground">{s.phone}</Text>
                    </View>
                  ) : null}
                </View>
                <View className="items-end">
                  <Text className="text-xs font-semibold text-muted-foreground">Bakiye</Text>
                  <Text
                    className={
                      s.balance > 0
                        ? 'text-base font-extrabold text-destructive'
                        : 'text-base font-extrabold text-foreground'
                    }
                  >
                    {formatCurrency(s.balance)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function SupplierLedgerView({
  supplierId,
  onBack,
  onChanged,
}: {
  supplierId: string
  onBack: () => void
  onChanged: () => void
}) {
  const insets = useSafeAreaInsets()
  const [ledger, setLedger] = useState<SupplierLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const l = await getSupplierLedger(supplierId)
      setLedger(l)
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Cari yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [supplierId])

  async function savePayment() {
    const value = Number(amount)
    if (!value || value <= 0) return
    setSaving(true)
    try {
      const l = await recordSupplierPayment(supplierId, value, description.trim() || undefined)
      setLedger(l)
      onChanged()
      setPayOpen(false)
      setAmount('')
      setDescription('')
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Ödeme kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !ledger) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const { supplier, transactions } = ledger

  return (
    <View className="flex-1">
      <View
        className="flex-row items-center gap-3 bg-background px-5 pb-3"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable
          onPress={onBack}
          className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
        >
          <ArrowLeft size={20} color={colors.secondaryForeground} />
        </Pressable>
        <Text className="text-xl font-extrabold tracking-tight text-foreground" numberOfLines={1}>
          {supplier.name}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-2xl bg-foreground px-5 py-4">
          <View className="flex-row items-center gap-2">
            <Wallet size={16} color={colors.background} />
            <Text className="text-sm font-semibold text-background/80">Güncel Bakiye</Text>
          </View>
          <Text className="mt-1 text-2xl font-extrabold text-background">
            {formatCurrency(supplier.balance)}
          </Text>
          <Text className="mt-0.5 text-xs text-background/60">
            {supplier.balance > 0 ? 'Bu tedarikçiye borcunuz var.' : 'Güncel borç bulunmuyor.'}
          </Text>
        </View>

        {supplier.phone || supplier.contact ? (
          <View className="mt-3 rounded-2xl border border-border bg-card p-4" style={cardShadow}>
            {supplier.contact ? (
              <Text className="text-sm font-bold text-foreground">{supplier.contact}</Text>
            ) : null}
            {supplier.phone ? (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Phone size={14} color={colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground">{supplier.phone}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {payOpen ? (
          <View className="mt-3 flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4" style={cardShadow}>
            <TextField label="Ödeme Tutarı (₺)" value={amount} onChange={setAmount} inputMode="numeric" placeholder="0" />
            <TextArea label="Açıklama (isteğe bağlı)" value={description} onChange={setDescription} rows={2} placeholder="Örn: Nakit ödeme" />
            <View className="flex-row gap-2">
              <Pressable
                onPress={savePayment}
                disabled={saving}
                className="h-12 flex-1 items-center justify-center rounded-xl bg-accent"
              >
                <Text className="text-sm font-extrabold text-accent-foreground">
                  {saving ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPayOpen(false)}
                className="h-12 items-center justify-center rounded-xl bg-secondary px-5"
              >
                <Text className="text-sm font-bold text-secondary-foreground">Vazgeç</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setPayOpen(true)}
            className="mt-3 h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
          >
            <Plus size={20} color={colors.primary} />
            <Text className="text-base font-bold text-primary">Ödeme Ekle</Text>
          </Pressable>
        )}

        <Text className="mb-2 mt-5 text-sm font-bold text-muted-foreground">
          Hareketler
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
          <View className="flex flex-col gap-2">
            {transactions.map((t) => (
              <View
                key={t.id}
                className="flex-row items-center justify-between rounded-2xl border border-border bg-card p-3.5"
                style={cardShadow}
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-bold text-foreground">
                    {TX_LABELS[t.type] ?? t.type}
                  </Text>
                  {t.description ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
                      {t.description}
                    </Text>
                  ) : null}
                  <Text className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </Text>
                </View>
                <Text
                  className={
                    t.type === 'odeme' || t.type === 'iade'
                      ? 'text-base font-extrabold text-chart-4'
                      : 'text-base font-extrabold text-destructive'
                  }
                >
                  {t.type === 'odeme' || t.type === 'iade' ? '-' : '+'}
                  {formatCurrency(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const TX_LABELS: Record<string, string> = {
  alis: 'Alış',
  odeme: 'Ödeme',
  iade: 'İade',
}

function SupplierForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (data: {
    name: string
    contact?: string
    phone?: string
    email?: string
    address?: string
    taxNo?: string
    openingBalance?: number
  }) => void
}) {
  const insets = useSafeAreaInsets()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [taxNo, setTaxNo] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [error, setError] = useState('')

  function handleSave() {
    if (name.trim().length < 2) {
      setError('Lütfen tedarikçi adını girin.')
      return
    }
    onSave({
      name: name.trim(),
      contact: contact.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      taxNo: taxNo.trim() || undefined,
      openingBalance: Number(openingBalance) || 0,
    })
  }

  return (
    <View className="flex-1">
      <View
        className="flex-row items-center gap-3 bg-background px-5 pb-3"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable
          onPress={onCancel}
          className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
        >
          <ArrowLeft size={20} color={colors.secondaryForeground} />
        </Pressable>
        <Text className="text-xl font-extrabold tracking-tight text-foreground">
          Yeni Cari
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex flex-col gap-4">
          <TextField label="Tedarikçi Adı" value={name} onChange={setName} placeholder="Örn. Bosch Yetkili Bayi" />
          <TextField label="Yetkili Kişi (isteğe bağlı)" value={contact} onChange={setContact} placeholder="Örn. Ahmet Bey" />
          <TextField label="Telefon" value={phone} onChange={setPhone} placeholder="05XX XXX XX XX" inputMode="tel" />
          <TextArea label="Adres (isteğe bağlı)" value={address} onChange={setAddress} placeholder="Mahalle, ilçe, il" rows={3} />
          <View className="flex-row gap-3">
            <TextField label="Vergi No (isteğe bağlı)" value={taxNo} onChange={setTaxNo} className="flex-1" />
            <TextField label="Açılış Bakiyesi (₺)" value={openingBalance} onChange={setOpeningBalance} inputMode="numeric" placeholder="0" className="flex-1" />
          </View>

          {error !== '' && (
            <View className="rounded-xl bg-destructive/10 px-4 py-3">
              <Text className="text-sm font-semibold text-destructive">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSave}
            className="mt-1 h-14 items-center justify-center rounded-xl bg-primary active:opacity-95"
            style={primaryShadow}
          >
            <Text className="text-base font-extrabold text-primary-foreground">
              Cariyi Kaydet
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const accentShadow = {
  shadowColor: '#e07d33',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.28,
  shadowRadius: 12,
  elevation: 5,
}

const primaryShadow = {
  shadowColor: '#2f4a86',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.28,
  shadowRadius: 12,
  elevation: 5,
}
