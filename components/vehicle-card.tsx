'use client'

import { ChevronRight, User } from 'lucide-react'
import type { Vehicle } from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import { formatTime } from '@/lib/format'

export function VehicleCard({
  vehicle,
  onClick,
}: {
  vehicle: Vehicle
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors active:bg-muted"
    >
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-lg bg-foreground px-2.5 py-1 font-mono text-sm font-bold tracking-wide text-background">
            {vehicle.plate}
          </span>
          <StatusBadge status={vehicle.status} />
        </div>
        <p className="mt-2 text-base font-bold text-foreground">
          {vehicle.brand} {vehicle.model}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="size-3.5" />
          <span className="truncate">{vehicle.customer.name}</span>
          <span aria-hidden>·</span>
          <span>{formatTime(vehicle.createdAt)}</span>
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  )
}
