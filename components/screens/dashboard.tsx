'use client'

import { Camera, Clock, Wrench, CheckCircle2, ArrowRight, LogOut } from 'lucide-react'
import type { Vehicle } from '@/lib/types'
import { VehicleCard } from '@/components/vehicle-card'
import { formatDate } from '@/lib/format'

export function Dashboard({
  vehicles,
  userName,
  onLogout,
  onOpenVehicle,
  onNewVehicle,
  onSeeAll,
}: {
  vehicles: Vehicle[]
  userName: string
  onLogout: () => void
  onOpenVehicle: (id: string) => void
  onNewVehicle: () => void
  onSeeAll: () => void
}) {
  const bekleyen = vehicles.filter((v) => v.status === 'bekliyor').length
  const islemde = vehicles.filter((v) => v.status === 'islemde').length
  const tamamlanan = vehicles.filter((v) => v.status === 'tamamlandi').length
  const recent = vehicles.slice(0, 4)

  return (
    <div>
      <header className="rounded-b-3xl bg-primary px-5 pb-6 pt-8 text-primary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-primary-foreground/70">
              {formatDate(new Date().toISOString())}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Merhaba, {userName}
            </h1>
            <p className="mt-1 text-sm text-primary-foreground/80">
              Bugün serviste {vehicles.length} araç var.
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/12 text-primary-foreground ring-1 ring-primary-foreground/20"
            aria-label="Çıkış yap"
          >
            <LogOut className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat icon={Clock} label="Bekleyen" value={bekleyen} />
          <Stat icon={Wrench} label="İşlemde" value={islemde} />
          <Stat icon={CheckCircle2} label="Biten" value={tamamlanan} />
        </div>
      </header>

      <div className="px-5">
        <button
          type="button"
          onClick={onNewVehicle}
          className="mt-5 flex w-full items-center gap-4 rounded-2xl bg-accent p-5 text-left text-accent-foreground shadow-lg shadow-accent/25 transition-transform active:scale-[0.99]"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-foreground/15">
            <Camera className="size-8" strokeWidth={2.2} />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-extrabold">Yeni Araç Kaydı</span>
            <span className="block text-sm text-accent-foreground/85">
              Ruhsatı çek, bilgiler otomatik dolsun
            </span>
          </span>
          <ArrowRight className="size-6" />
        </button>

        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground">
            Son Araçlar
          </h2>
          <button
            type="button"
            onClick={onSeeAll}
            className="text-sm font-semibold text-primary"
          >
            Tümünü Gör
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {recent.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onClick={() => onOpenVehicle(v.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl bg-primary-foreground/10 p-3 ring-1 ring-primary-foreground/15">
      <Icon className="size-5 text-primary-foreground/80" />
      <p className="mt-2 text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium text-primary-foreground/75">
        {label}
      </p>
    </div>
  )
}
