import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, CarFront, MapPin, Pencil, Phone } from 'lucide-react-native'
import type { Customer } from '@/lib/types'
import { colors } from '@/lib/theme'
import { cardShadow, VehicleCard } from '@/components/vehicle-card'
import { CustomerForm } from '@/screens/customers'
import { loadVehiclesByCustomer, type CustomerVehicleSummary } from '@/lib/api'

export function CustomerDetail({
  customer,
  onBack,
  onUpdate,
  onOpenVehicle,
}: {
  customer: Customer
  onBack: () => void
  onUpdate: (id: string, c: Omit<Customer, 'id'>) => void
  onOpenVehicle: (vehicleId: string) => void
}) {
  const insets = useSafeAreaInsets()
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
        onCancel={() => setEditing(false)}
        onSave={(data) => {
          onUpdate(customer.id, data)
          setEditing(false)
        }}
      />
    )
  }

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
        <Text
          className="flex-1 text-xl font-extrabold tracking-tight text-foreground"
          numberOfLines={1}
        >
          {customer.name}
        </Text>
        <Pressable
          onPress={() => setEditing(true)}
          className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
        >
          <Pencil size={20} color={colors.secondaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-2xl border border-border bg-card p-4" style={cardShadow}>
          <View className="flex-row items-center gap-1.5">
            <Phone size={16} color={colors.mutedForeground} />
            <Text className="text-sm text-muted-foreground">{customer.phone}</Text>
          </View>
          {customer.address ? (
            <View className="mt-1.5 flex-row items-center gap-1.5">
              <MapPin size={16} color={colors.mutedForeground} />
              <Text className="flex-1 text-sm text-muted-foreground">{customer.address}</Text>
            </View>
          ) : null}
        </View>

        <Text className="mb-3 mt-6 text-base font-bold text-foreground">
          Araçlar ({vehicles.length})
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : vehicles.length === 0 ? (
          <View className="mt-6 items-center">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <CarFront size={32} color={colors.mutedForeground} />
            </View>
            <Text className="mt-4 text-base font-bold text-foreground">Kayıtlı araç yok</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Bu müşteriye henüz bir araç kaydedilmemiş.
            </Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
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
      </ScrollView>
    </View>
  )
}
