import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Plus, Phone, MapPin, Users, ArrowLeft, Pencil, Check, Truck } from 'lucide-react-native'
import type { Customer } from '@/lib/types'
import { TextField, TextArea } from '@/components/form-field'
import { colors, withAlpha } from '@/lib/theme'
import { cardShadow } from '@/components/vehicle-card'
import { cn } from '@/lib/utils'

type ContactFilter = 'all' | 'customers' | 'suppliers'

const FILTER_OPTIONS: { key: ContactFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'customers', label: 'Müşteriler' },
  { key: 'suppliers', label: 'Tedarikçiler' },
]

export function Customers({
  customers,
  onAdd,
  onUpdate,
  onOpenCustomer,
}: {
  customers: Customer[]
  onAdd: (c: Omit<Customer, 'id'>) => void
  onUpdate: (id: string, c: Omit<Customer, 'id'>) => void
  onOpenCustomer: (customer: Customer) => void
}) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ContactFilter>('all')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return customers.filter((c) => {
      if (filter === 'suppliers' && !c.isSupplier) return false
      if (filter === 'customers' && c.isSupplier) return false
      if (!q) return true
      return `${c.name} ${c.phone} ${c.address ?? ''}`.toLocaleLowerCase('tr').includes(q)
    })
  }, [customers, query, filter])

  if (editing) {
    return (
      <CustomerForm
        initial={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(data) => {
          if (editing === 'new') onAdd(data)
          else onUpdate(editing.id, data)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <View className="flex-1">
      <View className="bg-background px-5 pb-3" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-2xl font-extrabold tracking-tight text-foreground">
          Müşteriler
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Toplam {customers.length} müşteri kayıtlı
        </Text>

        <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4">
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="İsim veya telefon ara"
            placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
            className="h-14 flex-1 text-base font-medium text-foreground"
          />
        </View>

        <View className="mt-3 flex-row gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key
            return (
              <Pressable
                key={opt.key}
                onPress={() => setFilter(opt.key)}
                className={cn(
                  'h-10 flex-1 items-center justify-center rounded-xl border',
                  active ? 'border-primary bg-primary/10' : 'border-border bg-card',
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-bold',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Pressable
          onPress={() => setEditing('new')}
          className="mt-3 h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-accent active:opacity-95"
          style={accentShadow}
        >
          <Plus size={24} color={colors.accentForeground} strokeWidth={2.4} />
          <Text className="text-base font-bold text-accent-foreground">
            Yeni Müşteri Ekle
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
              <Users size={32} color={colors.mutedForeground} />
            </View>
            <Text className="mt-4 text-base font-bold text-foreground">
              Müşteri bulunamadı
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Aramanı değiştir veya yeni bir müşteri ekle.
            </Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {filtered.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onOpenCustomer(c)}
                className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4 active:bg-muted"
                style={cardShadow}
              >
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Text className="text-base font-extrabold text-primary">
                    {initials(c.name)}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="shrink text-base font-bold text-foreground" numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.isSupplier ? (
                      <View className="flex-row items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5">
                        <Truck size={12} color={colors.accent} />
                        <Text className="text-[11px] font-bold text-accent">Tedarikçi</Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="mt-0.5 flex-row items-center gap-1.5">
                    <Phone size={16} color={colors.mutedForeground} />
                    <Text className="text-sm text-muted-foreground">{c.phone}</Text>
                  </View>
                  {c.address ? (
                    <View className="mt-0.5 flex-row items-center gap-1.5">
                      <MapPin size={16} color={colors.mutedForeground} />
                      <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={1}>
                        {c.address}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setEditing(c)}
                  className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
                >
                  <Pencil size={20} color={colors.secondaryForeground} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export function CustomerForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Customer | null
  onCancel: () => void
  onSave: (data: Omit<Customer, 'id'>) => void
}) {
  const insets = useSafeAreaInsets()
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [isSupplier, setIsSupplier] = useState(initial?.isSupplier ?? false)
  const [error, setError] = useState('')

  function handleSave() {
    if (name.trim().length < 2) {
      setError('Lütfen müşteri adını girin.')
      return
    }
    if (phone.trim().length < 7) {
      setError('Lütfen geçerli bir telefon girin.')
      return
    }
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      isSupplier,
      isCustomer: true,
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
          {initial ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex flex-col gap-4">
          <TextField label="Ad Soyad" value={name} onChange={setName} placeholder="Örn. Ayşe Kaya" />
          <TextField
            label="Telefon"
            value={phone}
            onChange={setPhone}
            placeholder="05XX XXX XX XX"
            inputMode="tel"
          />
          <TextArea
            label="Adres (isteğe bağlı)"
            value={address}
            onChange={setAddress}
            placeholder="Mahalle, ilçe, il"
            rows={3}
          />

          <Pressable
            onPress={() => setIsSupplier((v) => !v)}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
          >
            <View
              className={cn(
                'h-6 w-6 items-center justify-center rounded-md border-2',
                isSupplier ? 'border-accent bg-accent' : 'border-border bg-transparent',
              )}
            >
              {isSupplier && <Check size={16} color={colors.accentForeground} strokeWidth={3} />}
            </View>
            <Text className="flex-1 text-sm font-semibold text-foreground">
              Aynı zamanda tedarikçi
            </Text>
          </Pressable>

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
              {initial ? 'Değişiklikleri Kaydet' : 'Müşteriyi Kaydet'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr'))
    .join('')
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
