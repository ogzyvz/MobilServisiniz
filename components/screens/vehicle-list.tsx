'use client'

import { useMemo, useState } from 'react'
import { Search, Plus, CarFront } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, type JobStatus, type Vehicle } from '@/lib/types'
import { VehicleCard } from '@/components/vehicle-card'

type Filter = 'all' | JobStatus

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'bekliyor', label: STATUS_LABELS.bekliyor },
  { key: 'islemde', label: STATUS_LABELS.islemde },
  { key: 'tamamlandi', label: STATUS_LABELS.tamamlandi },
]

export function VehicleList({
  vehicles,
  onOpenVehicle,
  onNewVehicle,
}: {
  vehicles: Vehicle[]
  onOpenVehicle: (id: string) => void
  onNewVehicle: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

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
    <div>
      <header className="sticky top-0 z-10 bg-background/95 px-5 pb-3 pt-8 backdrop-blur">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Araçlar
        </h1>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <Search className="size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Plaka, marka veya müşteri ara"
            className="h-14 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-5 pt-2">
        {filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <CarFront className="size-8 text-muted-foreground" />
            </span>
            <p className="mt-4 text-base font-bold text-foreground">
              Araç bulunamadı
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aramanı değiştir veya yeni bir kayıt oluştur.
            </p>
            <button
              type="button"
              onClick={onNewVehicle}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-foreground"
            >
              <Plus className="size-5" /> Yeni Araç Kaydı
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onClick={() => onOpenVehicle(v.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
