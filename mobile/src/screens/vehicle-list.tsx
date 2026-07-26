import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Plus, CarFront } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, type JobStatus, type Vehicle } from '@/lib/types'
import { VehicleCard } from '@/components/vehicle-card'
import { colors, withAlpha } from '@/lib/theme'

export type VehicleListFilter = 'all' | JobStatus

const filters: { key: VehicleListFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'bekliyor', label: STATUS_LABELS.bekliyor },
  { key: 'islemde', label: STATUS_LABELS.islemde },
  { key: 'tamamlandi', label: STATUS_LABELS.tamamlandi },
]

export function VehicleList({
  vehicles,
  onOpenVehicle,
  onNewVehicle,
  initialFilter = 'all',
}: {
  vehicles: Vehicle[]
  onOpenVehicle: (id: string) => void
  onNewVehicle: () => void
  /** Dashboard'daki durum kartlarından gelindiğinde önceden seçili filtre. */
  initialFilter?: VehicleListFilter
}) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<VehicleListFilter>(initialFilter)

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return vehicles.filter((v) => {
      const matchStatus = filter === 'all' || v.status === filter
      const matchQuery =
        !q ||
        `${v.plate} ${v.brand} ${v.model} ${v.customer.name}`
          .toLocaleLowerCase('tr')
          .includes(q)
      return matchStatus && matchQuery
    })
  }, [vehicles, query, filter])

  return (
    <View className="flex-1">
      <View
        className="bg-background px-5 pb-3"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-2xl font-extrabold tracking-tight text-foreground">
          Araçlar
        </Text>

        <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4">
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Plaka, marka veya müşteri ara"
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
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View className="mt-16 items-center">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <CarFront size={32} color={colors.mutedForeground} />
            </View>
            <Text className="mt-4 text-base font-bold text-foreground">
              Araç bulunamadı
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Aramanı değiştir veya yeni bir kayıt oluştur.
            </Text>
            <Pressable
              onPress={onNewVehicle}
              className="mt-5 flex-row items-center gap-2 rounded-xl bg-accent px-5 py-3"
            >
              <Plus size={20} color={colors.accentForeground} />
              <Text className="text-sm font-bold text-accent-foreground">
                Yeni Araç Kaydı
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {filtered.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onPress={() => onOpenVehicle(v.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
