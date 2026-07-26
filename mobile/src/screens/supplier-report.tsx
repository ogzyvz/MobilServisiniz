import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, BarChart3, Truck } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import { getSupplierReport, type SupplierReportRow } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { colors } from '@/lib/theme'
import { cardShadow } from '@/components/vehicle-card'

type Period = 'daily' | 'weekly'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function SupplierReport({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const [period, setPeriod] = useState<Period>('daily')
  const [date] = useState(todayIso())
  const [rows, setRows] = useState<SupplierReportRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getSupplierReport(period, date)
      .then((r) => {
        if (active) setRows(r)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [period, date])

  const totalPurchases = rows.reduce((s, r) => s + r.totalPurchases, 0)
  const totalReturns = rows.reduce((s, r) => s + r.totalReturns, 0)

  return (
    <View className="flex-1">
      <View className="bg-background px-5 pb-3" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={onBack}
            className="h-11 w-11 items-center justify-center rounded-xl bg-secondary"
          >
            <ArrowLeft size={20} color={colors.secondaryForeground} />
          </Pressable>
          <Text className="text-2xl font-extrabold tracking-tight text-foreground">
            Cari Raporu
          </Text>
        </View>
        <Text className="mt-1 text-sm text-muted-foreground">
          Tedarikçi bazlı alış ve iade özeti
        </Text>

        <View className="mt-4 flex-row gap-1 rounded-2xl bg-secondary p-1">
          <Pressable
            onPress={() => setPeriod('daily')}
            className={cn('flex-1 rounded-xl py-2.5', period === 'daily' && 'bg-card')}
            style={period === 'daily' ? cardShadow : undefined}
          >
            <Text
              className={cn(
                'text-center text-sm font-bold',
                period === 'daily' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Günlük
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPeriod('weekly')}
            className={cn('flex-1 rounded-xl py-2.5', period === 'weekly' && 'bg-card')}
            style={period === 'weekly' ? cardShadow : undefined}
          >
            <Text
              className={cn(
                'text-center text-sm font-bold',
                period === 'weekly' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Haftalık
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-border bg-card p-4" style={cardShadow}>
              <Text className="text-xs font-semibold text-muted-foreground">Toplam Alış</Text>
              <Text className="mt-1 text-lg font-extrabold text-foreground">
                {formatCurrency(totalPurchases)}
              </Text>
            </View>
            <View className="flex-1 rounded-2xl border border-border bg-card p-4" style={cardShadow}>
              <Text className="text-xs font-semibold text-muted-foreground">Toplam İade</Text>
              <Text className="mt-1 text-lg font-extrabold text-chart-4">
                {formatCurrency(totalReturns)}
              </Text>
            </View>
          </View>

          <Text className="mb-2 mt-5 text-sm font-bold text-muted-foreground">
            Tedarikçiler
          </Text>

          {rows.length === 0 ? (
            <View className="mt-10 items-center">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                <BarChart3 size={32} color={colors.mutedForeground} />
              </View>
              <Text className="mt-4 text-base font-bold text-foreground">
                Bu dönemde hareket yok
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Seçilen dönem için tedarikçi hareketi bulunamadı.
              </Text>
            </View>
          ) : (
            <View className="flex flex-col gap-3">
              {rows.map((r) => (
                <View
                  key={r.supplierId}
                  className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4"
                  style={cardShadow}
                >
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <Truck size={20} color={colors.primary} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                      {r.supplierName}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {r.transactionCount} hareket
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-extrabold text-foreground">
                      {formatCurrency(r.totalPurchases)}
                    </Text>
                    {r.totalReturns > 0 ? (
                      <Text className="mt-0.5 text-xs font-semibold text-chart-4">
                        İade: {formatCurrency(r.totalReturns)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}
