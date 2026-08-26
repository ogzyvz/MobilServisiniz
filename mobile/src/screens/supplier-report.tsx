import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { BarChart3, Calendar, ChevronRight, Search, Truck, X } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import {
  getSupplierLedger,
  getSupplierReport,
  type SupplierReportRow,
  type SupplierTransaction,
} from '@/lib/api'
import { formatCurrency, toTurkeyDateKey } from '@/lib/format'
import { colors, withAlpha } from '@/lib/theme'
import { cardShadow } from '@/components/vehicle-card'
import { AppSheet, SheetCancelButton } from '@/components/app-modal'
import {
  SupplierTxDetailSheet,
  SupplierTxGroupedList,
} from '@/components/supplier-tx-detail'

type Period = 'daily' | 'weekly' | 'custom'

function toIso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function formatTr(iso: string) {
  const d = parseIso(iso)
  return d.toLocaleDateString('tr-TR')
}

function startOfWeek(d: Date) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (copy.getDay() + 6) % 7 // Pazartesi = 0
  copy.setDate(copy.getDate() - day)
  return copy
}

function endOfWeek(d: Date) {
  const start = startOfWeek(d)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

function inDateRange(iso: string, fromIso: string, toIso: string) {
  const d = toTurkeyDateKey(iso)
  const from = fromIso <= toIso ? fromIso : toIso
  const to = fromIso <= toIso ? toIso : fromIso
  return d >= from && d <= to
}

export function SupplierReport({ onBack: _onBack }: { onBack: () => void }) {
  const today = useMemo(() => new Date(), [])
  const [period, setPeriod] = useState<Period>('daily')
  const [fromIso, setFromIso] = useState(toIso(today))
  const [toIsoDate, setToIsoDate] = useState(toIso(today))
  const [picker, setPicker] = useState<'from' | 'to' | null>(null)
  const [rows, setRows] = useState<SupplierReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detailRow, setDetailRow] = useState<SupplierReportRow | null>(null)
  const [detailTxs, setDetailTxs] = useState<SupplierTransaction[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedTx, setSelectedTx] = useState<SupplierTransaction | null>(null)
  const [detailQuery, setDetailQuery] = useState('')

  function applyPreset(next: Period) {
    setPeriod(next)
    const now = new Date()
    if (next === 'daily') {
      const iso = toIso(now)
      setFromIso(iso)
      setToIsoDate(iso)
    } else if (next === 'weekly') {
      setFromIso(toIso(startOfWeek(now)))
      setToIsoDate(toIso(endOfWeek(now)))
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    const from = fromIso <= toIsoDate ? fromIso : toIsoDate
    const to = fromIso <= toIsoDate ? toIsoDate : fromIso
    getSupplierReport(from, to)
      .then((r) => {
        if (active) setRows(r)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fromIso, toIsoDate])

  async function openSupplierDetail(row: SupplierReportRow) {
    setDetailRow(row)
    setDetailTxs([])
    setDetailQuery('')
    setDetailLoading(true)
    try {
      const ledger = await getSupplierLedger(row.supplierId)
      const from = fromIso <= toIsoDate ? fromIso : toIsoDate
      const to = fromIso <= toIsoDate ? toIsoDate : fromIso
      setDetailTxs(
        ledger.transactions.filter((t) => inDateRange(t.createdAt, from, to)),
      )
    } catch {
      setDetailTxs([])
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredDetailTxs = useMemo(() => {
    const q = detailQuery.trim().toLocaleLowerCase('tr')
    if (!q) return detailTxs
    return detailTxs.filter((t) => {
      const plate = t.plate?.toLocaleLowerCase('tr') ?? ''
      const partName = t.partName?.toLocaleLowerCase('tr') ?? ''
      return plate.includes(q) || partName.includes(q)
    })
  }, [detailTxs, detailQuery])

  const totalPurchases = rows.reduce((s, r) => s + r.totalPurchases, 0)
  const totalReturns = rows.reduce((s, r) => s + r.totalReturns, 0)
  const rangeLabel = `${formatTr(fromIso <= toIsoDate ? fromIso : toIsoDate)} – ${formatTr(fromIso <= toIsoDate ? toIsoDate : fromIso)}`

  return (
    <View className="flex-1">
      <View className="bg-background px-5 pb-3 pt-3">
        <View className="flex-row gap-1 rounded-2xl bg-secondary p-1">
          {(
            [
              { key: 'daily' as const, label: 'Günlük' },
              { key: 'weekly' as const, label: 'Haftalık' },
              { key: 'custom' as const, label: 'Tarih Aralığı' },
            ] as const
          ).map((opt) => {
            const active = period === opt.key
            return (
              <Pressable
                key={opt.key}
                onPress={() => applyPreset(opt.key)}
                className={cn(
                  'h-10 flex-1 items-center justify-center rounded-xl',
                  active ? 'bg-card' : '',
                )}
                style={active ? cardShadow : undefined}
              >
                <Text
                  className={cn(
                    'text-xs font-bold',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {period === 'custom' ? (
          <View className="mt-3 flex-row gap-2">
            <DateField label="Başlangıç" value={fromIso} onPress={() => setPicker('from')} />
            <DateField label="Bitiş" value={toIsoDate} onPress={() => setPicker('to')} />
          </View>
        ) : null}

        {picker && (
          <DateTimePicker
            value={parseIso(picker === 'from' ? fromIso : toIsoDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              if (Platform.OS === 'android') setPicker(null)
              if (!date) return
              const iso = toIso(date)
              if (picker === 'from') setFromIso(iso)
              else setToIsoDate(iso)
            }}
          />
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10">
          <Text className="mb-3 text-xs font-semibold text-muted-foreground">{rangeLabel}</Text>

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
            Tedarikçiler · detay için dokun
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
                Seçilen tarih aralığında tedarikçi hareketi bulunamadı.
              </Text>
            </View>
          ) : (
            <View className="flex flex-col gap-3">
              {rows.map((r) => (
                <Pressable
                  key={r.supplierId}
                  onPress={() => void openSupplierDetail(r)}
                  className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4 active:opacity-90"
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
                      {r.transactionCount} hareket · detayı aç
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
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <AppSheet
        visible={!!detailRow}
        onClose={() => {
          setDetailRow(null)
          setDetailTxs([])
          setDetailQuery('')
        }}
        title={detailRow?.supplierName ?? 'Hareketler'}
        subtitle={`${rangeLabel} · ${detailTxs.length} hareket`}
      >
        {detailLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : detailTxs.length === 0 ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">
            Bu aralıkta hareket bulunamadı.
          </Text>
        ) : (
          <>
            <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-border bg-background px-3">
              <Search size={18} color={colors.mutedForeground} />
              <TextInput
                value={detailQuery}
                onChangeText={setDetailQuery}
                placeholder="Plaka veya ürün adı ara"
                placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
                autoCapitalize="none"
                className="h-12 flex-1 text-sm font-medium text-foreground"
              />
              {detailQuery !== '' ? (
                <Pressable onPress={() => setDetailQuery('')}>
                  <X size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            {filteredDetailTxs.length === 0 ? (
              <Text className="py-6 text-center text-sm text-muted-foreground">
                Aramanızla eşleşen hareket bulunamadı.
              </Text>
            ) : (
              <SupplierTxGroupedList
                transactions={filteredDetailTxs}
                onPress={setSelectedTx}
                compact
              />
            )}
          </>
        )}
        <SheetCancelButton
          onPress={() => {
            setDetailRow(null)
            setDetailTxs([])
            setDetailQuery('')
          }}
          label="Kapat"
        />
      </AppSheet>

      <SupplierTxDetailSheet
        tx={selectedTx}
        supplierName={detailRow?.supplierName}
        onClose={() => setSelectedTx(null)}
      />
    </View>
  )
}

function DateField({
  label,
  value,
  onPress,
}: {
  label: string
  value: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5"
    >
      <Text className="text-[11px] font-semibold text-muted-foreground">{label}</Text>
      <View className="mt-1 flex-row items-center gap-1.5">
        <Calendar size={14} color={colors.mutedForeground} />
        <Text className="text-sm font-bold text-foreground">{formatTr(value)}</Text>
      </View>
    </Pressable>
  )
}
