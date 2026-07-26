import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Plus, Package, ArrowLeft, Pencil, AlertTriangle } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import {
  STOCK_CATEGORY_LABELS,
  type StockCategory,
  type StockProduct,
} from '@/lib/types'
import { TextField, SelectField } from '@/components/form-field'
import { formatCurrency } from '@/lib/format'
import { colors, withAlpha } from '@/lib/theme'
import { cardShadow } from '@/components/vehicle-card'

type Filter = 'all' | StockCategory

const LOW_STOCK = 10

const categoryOptions = (Object.keys(STOCK_CATEGORY_LABELS) as StockCategory[]).map(
  (key) => ({ value: key, label: STOCK_CATEGORY_LABELS[key] }),
)

export function Products({
  products,
  onAdd,
  onUpdate,
}: {
  products: StockProduct[]
  onAdd: (p: Omit<StockProduct, 'id'>) => void
  onUpdate: (id: string, p: Omit<StockProduct, 'id'>) => void
}) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<StockProduct | 'new' | null>(null)

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    ...categoryOptions.map((o) => ({ key: o.value as Filter, label: o.label })),
  ]

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return products.filter((p) => {
      const matchCat = filter === 'all' || p.category === filter
      const matchQuery = !q || `${p.name} ${p.code}`.toLocaleLowerCase('tr').includes(q)
      return matchCat && matchQuery
    })
  }, [products, query, filter])

  const lowCount = products.filter((p) => p.stock <= LOW_STOCK).length

  if (editing) {
    return (
      <ProductForm
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
          Ürün & Stok
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {products.length} ürün
          {lowCount > 0 ? (
            <Text className="font-semibold text-destructive">
              {' '}· {lowCount} üründe stok az
            </Text>
          ) : null}
        </Text>

        <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4">
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ürün adı veya kodu ara"
            placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
            className="h-14 flex-1 text-base font-medium text-foreground"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        >
          {filters.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-4 py-2',
                filter === f.key ? 'bg-primary' : 'bg-secondary',
              )}
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  filter === f.key
                    ? 'text-primary-foreground'
                    : 'text-secondary-foreground',
                )}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          onPress={() => setEditing('new')}
          className="mt-3 h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-accent active:opacity-95"
          style={accentShadow}
        >
          <Plus size={24} color={colors.accentForeground} strokeWidth={2.4} />
          <Text className="text-base font-bold text-accent-foreground">
            Yeni Ürün Ekle
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
              <Package size={32} color={colors.mutedForeground} />
            </View>
            <Text className="mt-4 text-base font-bold text-foreground">
              Ürün bulunamadı
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Aramanı değiştir veya yeni bir ürün ekle.
            </Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {filtered.map((p) => {
              const low = p.stock <= LOW_STOCK
              return (
                <View
                  key={p.id}
                  className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4"
                  style={cardShadow}
                >
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-lg bg-secondary px-2 py-0.5">
                        <Text className="text-xs font-bold text-secondary-foreground">
                          {STOCK_CATEGORY_LABELS[p.category]}
                        </Text>
                      </View>
                      <Text className="font-mono text-xs text-muted-foreground">
                        {p.code}
                      </Text>
                    </View>
                    <Text className="mt-1 text-base font-bold text-foreground" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <View className="mt-1 flex-row items-center gap-3">
                      <Text className="text-base font-extrabold text-primary">
                        {formatCurrency(p.price)}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        {low && <AlertTriangle size={16} color={colors.destructive} />}
                        <Text
                          className={cn(
                            'text-sm font-semibold',
                            low ? 'text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {p.stock} adet
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setEditing(p)}
                    className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
                  >
                    <Pencil size={20} color={colors.secondaryForeground} />
                  </Pressable>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function ProductForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: StockProduct | null
  onCancel: () => void
  onSave: (data: Omit<StockProduct, 'id'>) => void
}) {
  const insets = useSafeAreaInsets()
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [category, setCategory] = useState<StockCategory>(initial?.category ?? 'diger')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [stock, setStock] = useState(initial ? String(initial.stock) : '')
  const [error, setError] = useState('')

  function handleSave() {
    if (name.trim().length < 2) {
      setError('Lütfen ürün adını girin.')
      return
    }
    const priceNum = Number(price)
    if (!priceNum || priceNum <= 0) {
      setError('Lütfen geçerli bir fiyat girin.')
      return
    }
    onSave({
      name: name.trim(),
      code: code.trim() || '-',
      category,
      price: priceNum,
      stock: Number(stock) || 0,
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
          {initial ? 'Ürünü Düzenle' : 'Yeni Ürün'}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex flex-col gap-4">
          <TextField label="Ürün Adı" value={name} onChange={setName} placeholder="Örn. Motor Yağı 5W-30" />
          <SelectField
            label="Kategori"
            value={category}
            onChange={(v) => setCategory(v as StockCategory)}
            options={categoryOptions}
          />
          <TextField
            label="Ürün Kodu (isteğe bağlı)"
            value={code}
            onChange={setCode}
            placeholder="Örn. YG-530-5"
          />
          <View className="flex-row gap-3">
            <TextField
              label="Fiyat (₺)"
              value={price}
              onChange={setPrice}
              placeholder="0"
              inputMode="numeric"
              className="flex-1"
            />
            <TextField
              label="Stok (adet)"
              value={stock}
              onChange={setStock}
              placeholder="0"
              inputMode="numeric"
              className="flex-1"
            />
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
              {initial ? 'Değişiklikleri Kaydet' : 'Ürünü Kaydet'}
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
