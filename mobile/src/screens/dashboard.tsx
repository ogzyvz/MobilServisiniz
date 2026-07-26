import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Camera,
  Clock,
  Wrench,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Trophy,
  User as UserIcon,
} from 'lucide-react-native'
import type { JobStatus, Vehicle } from '@/lib/types'
import { VehicleCard } from '@/components/vehicle-card'
import { formatDate, formatCurrency } from '@/lib/format'
import { colors } from '@/lib/theme'
import {
  getStaffPerformance,
  loadDashboardStats,
  type CurrentUser,
  type DashboardStats,
  type StaffPerformanceRow,
} from '@/lib/api'

type IconType = typeof Clock

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function Dashboard({
  vehicles,
  userName,
  currentUser,
  onLogout,
  onOpenVehicle,
  onNewVehicle,
  onSeeAll,
  onFilterStatus,
}: {
  vehicles: Vehicle[]
  userName: string
  currentUser: CurrentUser | null
  onLogout: () => void
  onOpenVehicle: (id: string) => void
  onNewVehicle: () => void
  onSeeAll: () => void
  onFilterStatus: (status: JobStatus) => void
}) {
  const insets = useSafeAreaInsets()
  const bekleyen = vehicles.filter((v) => v.status === 'bekliyor').length
  const islemde = vehicles.filter((v) => v.status === 'islemde').length
  const tamamlanan = vehicles.filter((v) => v.status === 'tamamlandi').length
  const recent = vehicles.slice(0, 4)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [performance, setPerformance] = useState<StaffPerformanceRow[]>([])
  const [performanceLoading, setPerformanceLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  useEffect(() => {
    let active = true
    setPerformanceLoading(true)
    const userId = currentUser?.role === 'personel' ? currentUser.id : undefined
    getStaffPerformance(todayIso(), userId)
      .then((rows) => {
        if (active) setPerformance(rows)
      })
      .catch(() => {
        if (active) setPerformance([])
      })
      .finally(() => {
        if (active) setPerformanceLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentUser?.id, currentUser?.role])

  const myPerformance =
    currentUser?.role === 'personel'
      ? performance.find((p) => p.userId === currentUser.id) ?? {
          userId: currentUser.id,
          fullName: currentUser.name,
          jobCount: 0,
          revenue: 0,
        }
      : null

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        className="rounded-b-3xl bg-primary px-5 pb-6"
        style={{ paddingTop: insets.top + 16 }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-sm font-medium text-primary-foreground/70">
              {formatDate(new Date().toISOString())}
            </Text>
            <Text className="mt-1 text-2xl font-extrabold tracking-tight text-primary-foreground">
              Merhaba, {userName}
            </Text>
            <Text className="mt-1 text-sm text-primary-foreground/80">
              Bugün serviste {vehicles.length} araç var.
            </Text>
          </View>
          <Pressable
            onPress={onLogout}
            className="h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/12 border border-primary-foreground/20"
          >
            <LogOut size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>

        <View className="mt-5 flex-row gap-3">
          <Stat
            icon={Clock}
            label="Bekleyen"
            value={bekleyen}
            onPress={() => onFilterStatus('bekliyor')}
          />
          <Stat
            icon={Wrench}
            label="İşlemde"
            value={islemde}
            onPress={() => onFilterStatus('islemde')}
          />
          <Stat
            icon={CheckCircle2}
            label="Biten"
            value={tamamlanan}
            onPress={() => onFilterStatus('tamamlandi')}
          />
        </View>

        {stats ? (
          <View className="mt-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/15 px-4 py-2.5">
            <Text className="text-xs font-semibold text-primary-foreground/85">
              Bu ay: {stats.monthVehiclesServiced} araç · {stats.monthOperations} işlem
            </Text>
          </View>
        ) : null}
      </View>

      <View className="px-5">
        <Pressable
          onPress={onNewVehicle}
          className="mt-5 flex-row items-center gap-4 rounded-2xl bg-accent p-5 active:opacity-95"
          style={accentShadow}
        >
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent-foreground/15">
            <Camera size={32} color={colors.accentForeground} strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-accent-foreground">
              Yeni Araç Kaydı
            </Text>
            <Text className="text-sm text-accent-foreground/85">
              Ruhsatı çek, bilgiler otomatik dolsun
            </Text>
          </View>
          <ArrowRight size={24} color={colors.accentForeground} />
        </Pressable>

        <View className="mt-7 flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-foreground">Bugünkü Performans</Text>
        </View>

        {performanceLoading ? null : currentUser?.role === 'personel' ? (
          myPerformance ? (
            <PerformanceRow row={myPerformance} highlight />
          ) : null
        ) : performance.length === 0 ? (
          <View className="mt-3 rounded-2xl border border-border bg-card p-4">
            <Text className="text-sm text-muted-foreground">
              Bugün henüz tamamlanan iş emri yok.
            </Text>
          </View>
        ) : (
          <View className="mt-3 flex flex-col gap-2">
            {performance.map((row) => (
              <PerformanceRow key={row.userId ?? row.fullName} row={row} />
            ))}
          </View>
        )}

        <View className="mt-7 flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-foreground">Son Araçlar</Text>
          <Pressable onPress={onSeeAll}>
            <Text className="text-sm font-semibold text-primary">Tümünü Gör</Text>
          </Pressable>
        </View>

        <View className="mt-3 flex flex-col gap-3">
          {recent.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onPress={() => onOpenVehicle(v.id)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function PerformanceRow({
  row,
  highlight = false,
}: {
  row: StaffPerformanceRow
  highlight?: boolean
}) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4"
      style={cardShadow}
    >
      <View
        className={
          highlight
            ? 'h-11 w-11 items-center justify-center rounded-xl bg-accent/15'
            : 'h-11 w-11 items-center justify-center rounded-xl bg-primary/10'
        }
      >
        {highlight ? (
          <Trophy size={20} color={colors.accent} />
        ) : (
          <UserIcon size={20} color={colors.primary} />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
          {row.fullName}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {row.jobCount} iş tamamlandı
        </Text>
      </View>
      <Text className="text-sm font-extrabold text-foreground">
        {formatCurrency(row.revenue)}
      </Text>
    </View>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: IconType
  label: string
  value: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl bg-primary-foreground/10 border border-primary-foreground/15 p-3 active:opacity-80"
    >
      <Icon size={20} color={colors.primaryForeground} />
      <Text className="mt-2 text-2xl font-extrabold leading-none text-primary-foreground">
        {value}
      </Text>
      <Text className="mt-1 text-xs font-medium text-primary-foreground/75">
        {label}
      </Text>
    </Pressable>
  )
}

const accentShadow = {
  shadowColor: '#e07d33',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.28,
  shadowRadius: 12,
  elevation: 5,
}

const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
}
