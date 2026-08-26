import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { AppSheet, SheetCancelButton } from '@/components/app-modal'
import { formatCurrency, formatDate, formatDateTime, formatTime, toTurkeyDateKey } from '@/lib/format'
import type { SupplierTransaction } from '@/lib/api'
import { colors } from '@/lib/theme'
import { cardShadow } from '@/components/vehicle-card'

export const SUPPLIER_TX_LABELS: Record<string, string> = {
  alis: 'Alış (borç)',
  odeme: 'Tedarikçiye ödeme',
  iade: 'İade',
  iskonto: 'İskonto',
}

export const SUPPLIER_METHOD_LABELS: Record<string, string> = {
  nakit: 'Nakit',
  kart: 'Kart',
  havale: 'Havale',
  diger: 'Diğer',
}

export function isSupplierCredit(type: string) {
  return type === 'odeme' || type === 'iade' || type === 'iskonto'
}

export function supplierTxSubtitle(t: SupplierTransaction): string | undefined {
  if (t.partName) {
    const qty = t.partQuantity && t.partQuantity > 1 ? `${t.partQuantity}× ` : ''
    const plate = t.plate ? ` · ${t.plate}` : ''
    return `${qty}${t.partName}${plate}`
  }
  return t.description?.trim() || undefined
}

export type SupplierTxDateGroup = {
  dateKey: string
  label: string
  items: SupplierTransaction[]
  /** Alış − (ödeme+iade+iskonto) — günün net borç etkisi */
  netDebt: number
}

/** Hareketleri Türkiye takvim gününe göre gruplar (yeni → eski). */
export function groupSupplierTxByDate(transactions: SupplierTransaction[]): SupplierTxDateGroup[] {
  const map = new Map<string, SupplierTransaction[]>()
  for (const t of transactions) {
    const key = toTurkeyDateKey(t.createdAt)
    const list = map.get(key)
    if (list) list.push(t)
    else map.set(key, [t])
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([dateKey, items]) => {
      const sorted = [...items].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      )
      let net = 0
      for (const t of sorted) {
        net += isSupplierCredit(t.type) ? -t.amount : t.amount
      }
      return {
        dateKey,
        label: formatDate(sorted[0]?.createdAt ?? dateKey),
        items: sorted,
        netDebt: Math.round(net * 100) / 100,
      }
    })
}

export function SupplierTxGroupedList({
  transactions,
  onPress,
  compact = false,
}: {
  transactions: SupplierTransaction[]
  onPress: (tx: SupplierTransaction) => void
  /** Rapor sheet’i için biraz daha sıkı satırlar */
  compact?: boolean
}) {
  const groups = groupSupplierTxByDate(transactions)
  return (
    <View className="flex flex-col gap-4">
      {groups.map((g) => (
        <View key={g.dateKey}>
          <View className="mb-2 flex-row items-center justify-between px-0.5">
            <Text className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </Text>
            <Text className="text-xs font-semibold text-muted-foreground">
              {g.items.length} hareket
              {g.netDebt !== 0
                ? ` · net ${g.netDebt > 0 ? '+' : ''}${formatCurrency(g.netDebt)}`
                : ''}
            </Text>
          </View>
          <View className="flex flex-col gap-2">
            {g.items.map((t) => {
              const credit = isSupplierCredit(t.type)
              const sub = supplierTxSubtitle(t)
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onPress(t)}
                  className={
                    compact
                      ? 'flex-row items-center justify-between rounded-2xl border border-border bg-background px-3 py-3 active:opacity-90'
                      : 'flex-row items-center justify-between rounded-2xl border border-border bg-card p-3.5 active:opacity-90'
                  }
                  style={compact ? undefined : cardShadow}
                >
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold text-foreground">
                      {SUPPLIER_TX_LABELS[t.type] ?? t.type}
                      {t.method
                        ? ` · ${SUPPLIER_METHOD_LABELS[t.method] ?? t.method}`
                        : ''}
                    </Text>
                    {sub ? (
                      <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
                        {sub}
                      </Text>
                    ) : null}
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {formatTime(t.createdAt)}
                    </Text>
                  </View>
                  <View className="ml-2 flex-row items-center gap-1">
                    <Text
                      className={
                        credit
                          ? 'text-base font-extrabold text-chart-4'
                          : 'text-base font-extrabold text-destructive'
                      }
                    >
                      {credit ? '-' : '+'}
                      {formatCurrency(t.amount)}
                    </Text>
                    {!compact ? (
                      <ChevronRight size={16} color={colors.mutedForeground} />
                    ) : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3 border-b border-border py-2.5">
      <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text className="max-w-[65%] text-right text-sm font-semibold text-foreground">{value}</Text>
    </View>
  )
}

export function SupplierTxDetailSheet({
  tx,
  supplierName,
  onClose,
  onEdit,
  onDelete,
}: {
  tx: SupplierTransaction | null
  supplierName?: string
  onClose: () => void
  onEdit?: (tx: SupplierTransaction) => void
  onDelete?: (tx: SupplierTransaction) => void
}) {
  const credit = tx ? isSupplierCredit(tx.type) : false
  const editable = tx ? tx.type === 'odeme' || tx.type === 'iskonto' : false
  const title = tx ? SUPPLIER_TX_LABELS[tx.type] ?? tx.type : ''

  return (
    <AppSheet
      visible={!!tx}
      onClose={onClose}
      title="Hareket detayı"
      subtitle={supplierName || title || undefined}
    >
      {!tx ? null : (
      <>
      <View className="mb-3 rounded-2xl bg-foreground px-4 py-3.5">
        <Text className="text-xs font-semibold text-background/70">{title}</Text>
        <Text
          className={
            credit
              ? 'mt-1 text-2xl font-extrabold text-chart-4'
              : 'mt-1 text-2xl font-extrabold text-destructive'
          }
        >
          {credit ? '-' : '+'}
          {formatCurrency(tx.amount)}
        </Text>
      </View>

      <DetailRow label="Tarih" value={formatDateTime(tx.createdAt)} />
      {tx.method ? (
        <DetailRow
          label="Yöntem"
          value={SUPPLIER_METHOD_LABELS[tx.method] ?? tx.method}
        />
      ) : null}
      {tx.plate ? <DetailRow label="Plaka" value={tx.plate} /> : null}
      {tx.partName ? <DetailRow label="Parça" value={tx.partName} /> : null}
      {tx.partQuantity != null && tx.partQuantity > 0 ? (
        <DetailRow label="Adet" value={String(tx.partQuantity)} />
      ) : null}
      {tx.purchasePrice != null && tx.purchasePrice > 0 ? (
        <DetailRow label="Birim alış" value={formatCurrency(tx.purchasePrice)} />
      ) : null}
      {tx.description ? <DetailRow label="Açıklama" value={tx.description} /> : null}

      {editable && (onEdit || onDelete) ? (
        <View className="mt-4 flex-row gap-2">
          {onEdit ? (
            <Pressable
              onPress={() => onEdit(tx)}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-primary active:opacity-90"
            >
              <Text className="text-sm font-extrabold text-primary-foreground">Düzenle</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={() => onDelete(tx)}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-destructive/15 active:opacity-90"
            >
              <Text className="text-sm font-extrabold" style={{ color: colors.destructive }}>
                Sil
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <SheetCancelButton onPress={onClose} label="Kapat" />
      </>
      )}
    </AppSheet>
  )
}
