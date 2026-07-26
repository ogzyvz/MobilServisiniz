'use client'

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Sparkles,
  Check,
  Loader2,
  CarFront,
  User,
  UserPlus,
  UserCheck,
  Search,
  Keyboard,
  MessageSquareWarning,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { aiScanSamples } from '@/lib/mock-data'
import type { Customer, Vehicle } from '@/lib/types'
import { TextField, TextArea } from '@/components/form-field'
import { Button } from '@/components/ui/button'

type Step = 0 | 1 | 2 | 3
const stepTitles = ['Ruhsat', 'Araç', 'Müşteri', 'Şikayet']

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function NewVehicleFlow({
  customers,
  onCancel,
  onComplete,
}: {
  customers: Customer[]
  onCancel: () => void
  onComplete: (vehicle: Vehicle) => void
}) {
  const [step, setStep] = useState<Step>(0)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)

  // Araç
  const [plate, setPlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [fuel, setFuel] = useState('')
  const [chassis, setChassis] = useState('')
  const [km, setKm] = useState('')

  // Müşteri
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(
    customers.length > 0 ? 'existing' : 'new',
  )
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Şikayet
  const [complaint, setComplaint] = useState('')

  function runScan() {
    setScanning(true)
    setTimeout(() => {
      const s = aiScanSamples[Math.floor(Math.random() * aiScanSamples.length)]
      setPlate(s.plate)
      setBrand(s.brand)
      setModel(s.model)
      setYear(s.year)
      setColor(s.color)
      setFuel(s.fuel)
      setChassis(s.chassis)
      setScanning(false)
      setScanned(true)
    }, 2200)
  }

  function startManual() {
    setScanned(false)
    setStep(1)
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null

  function handleSave() {
    const now = new Date().toISOString()
    const customer: Customer =
      customerMode === 'existing' && selectedCustomer
        ? selectedCustomer
        : { id: uid(), name, phone, address }

    const vehicle: Vehicle = {
      id: uid(),
      plate: plate || 'PLAKA YOK',
      brand,
      model,
      year,
      color,
      fuel,
      chassis,
      km,
      status: 'bekliyor',
      createdAt: now,
      customer,
      complaints: complaint.trim()
        ? [{ id: uid(), text: complaint.trim(), createdAt: now }]
        : [],
      services: [],
      products: [],
    }
    onComplete(vehicle)
  }

  const canNextVehicle = plate && brand && model
  const canNextCustomer =
    customerMode === 'existing' ? Boolean(selectedCustomer) : Boolean(name && phone)

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => (step === 0 ? onCancel() : setStep((step - 1) as Step))}
          className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
          aria-label="Geri"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground">
            Adım {step + 1} / 4
          </p>
          <h1 className="text-lg font-extrabold text-foreground">
            {stepTitles[step]}
          </h1>
        </div>
      </header>

      <div className="flex gap-1.5 px-5">
        {stepTitles.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-accent' : 'bg-border',
            )}
          />
        ))}
      </div>

      <div className="px-5 py-6">
        {step === 0 && (
          <ScanStep
            scanning={scanning}
            scanned={scanned}
            onScan={runScan}
            onManual={startManual}
            plate={plate}
            brand={brand}
            model={model}
            onContinue={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            {scanned && (
              <div className="flex items-center gap-2 rounded-xl bg-chart-4/10 px-4 py-3 text-sm font-semibold text-chart-4">
                <Sparkles className="size-4" />
                Bilgiler ruhsattan otomatik dolduruldu. Kontrol edip düzeltebilirsin.
              </div>
            )}
            <TextField label="Plaka" value={plate} onChange={(v) => setPlate(v.toUpperCase())} placeholder="Örn: 34 ABC 123" required />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Marka" value={brand} onChange={setBrand} placeholder="Örn: Toyota" required />
              <TextField label="Model" value={model} onChange={setModel} placeholder="Örn: Corolla" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Yıl" value={year} onChange={setYear} inputMode="numeric" placeholder="Örn: 2020" />
              <TextField label="Renk" value={color} onChange={setColor} placeholder="Örn: Beyaz" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Yakıt" value={fuel} onChange={setFuel} placeholder="Örn: Dizel" />
              <TextField label="Kilometre" value={km} onChange={setKm} inputMode="numeric" placeholder="Örn: 120.000" />
            </div>
            <TextField label="Şasi No" value={chassis} onChange={(v) => setChassis(v.toUpperCase())} placeholder="Örn: WVWZZZ..." />
            <StepButton disabled={!canNextVehicle} onClick={() => setStep(2)}>
              Devam Et
            </StepButton>
          </div>
        )}

        {step === 2 && (
          <CustomerStep
            customers={customers}
            mode={customerMode}
            onModeChange={setCustomerMode}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={setSelectedCustomerId}
            name={name}
            phone={phone}
            address={address}
            onName={setName}
            onPhone={setPhone}
            onAddress={setAddress}
            canNext={canNextCustomer}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <IntroLine
              icon={MessageSquareWarning}
              text="Müşterinin belirttiği şikayet / arıza"
            />
            <TextArea
              label="Şikayet"
              value={complaint}
              onChange={setComplaint}
              rows={5}
              placeholder="Örn: Motordan ses geliyor, fren balataları ses yapıyor..."
            />
            <StepButton onClick={handleSave} variant="accent">
              <Check className="size-5" /> Kaydı Tamamla
            </StepButton>
          </div>
        )}
      </div>
    </div>
  )
}

function ScanStep({
  scanning,
  scanned,
  onScan,
  onManual,
  plate,
  brand,
  model,
  onContinue,
}: {
  scanning: boolean
  scanned: boolean
  onScan: () => void
  onManual: () => void
  plate: string
  brand: string
  model: string
  onContinue: () => void
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-colors',
          scanned
            ? 'border-chart-4/40 bg-chart-4/5'
            : 'border-border bg-secondary',
        )}
      >
        {scanning ? (
          <div className="flex flex-col items-center gap-3 text-primary">
            <Loader2 className="size-10 animate-spin" />
            <p className="text-sm font-bold">Yapay zeka ruhsatı okuyor...</p>
          </div>
        ) : scanned ? (
          <div className="flex flex-col items-center gap-2 text-chart-4">
            <span className="flex size-16 items-center justify-center rounded-full bg-chart-4/15">
              <Check className="size-9" strokeWidth={2.5} />
            </span>
            <p className="text-base font-extrabold">Ruhsat Okundu</p>
            <p className="font-mono text-sm font-bold text-foreground">{plate}</p>
            <p className="text-sm text-muted-foreground">
              {brand} {model}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <CarFront className="size-12" />
            <p className="px-8 text-center text-sm font-medium">
              Ruhsatın fotoğrafını çek, araç bilgileri otomatik dolsun
            </p>
          </div>
        )}
      </div>

      {!scanned ? (
        <div className="mt-6 flex w-full flex-col gap-3">
          <StepButton onClick={onScan} disabled={scanning} variant="accent">
            {scanning ? (
              <>
                <Loader2 className="size-5 animate-spin" /> Okunuyor...
              </>
            ) : (
              <>
                <Camera className="size-5" /> Ruhsat Fotoğrafı Çek
              </>
            )}
          </StepButton>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground">
              ya da
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={onManual}
            disabled={scanning}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-base font-extrabold text-foreground transition-all active:scale-[0.99] disabled:opacity-40"
          >
            <Keyboard className="size-5" /> Fotoğrafsız Manuel Giriş
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Ruhsat fotoğrafı yoksa bilgileri kendin yazabilirsin.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex w-full flex-col gap-3">
          <StepButton onClick={onContinue}>Bilgileri Kontrol Et</StepButton>
          <Button
            variant="ghost"
            onClick={onScan}
            className="h-12 rounded-xl text-sm font-semibold text-muted-foreground"
          >
            Tekrar Çek
          </Button>
        </div>
      )}
    </div>
  )
}

function CustomerStep({
  customers,
  mode,
  onModeChange,
  selectedCustomerId,
  onSelectCustomer,
  name,
  phone,
  address,
  onName,
  onPhone,
  onAddress,
  canNext,
  onNext,
}: {
  customers: Customer[]
  mode: 'existing' | 'new'
  onModeChange: (m: 'existing' | 'new') => void
  selectedCustomerId: string | null
  onSelectCustomer: (id: string) => void
  name: string
  phone: string
  address: string
  onName: (v: string) => void
  onPhone: (v: string) => void
  onAddress: (v: string) => void
  canNext: boolean
  onNext: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    )
  }, [customers, query])

  return (
    <div className="flex flex-col gap-4">
      <IntroLine icon={User} text="Aracı getiren müşteriyi seç veya ekle" />

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1.5">
        <ModeTab
          active={mode === 'existing'}
          icon={UserCheck}
          label="Kayıtlı Müşteri"
          onClick={() => onModeChange('existing')}
        />
        <ModeTab
          active={mode === 'new'}
          icon={UserPlus}
          label="Yeni Müşteri"
          onClick={() => onModeChange('new')}
        />
      </div>

      {mode === 'existing' ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İsim veya telefon ara"
              className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>

          <div className="flex flex-col gap-2">
            {filtered.length === 0 && (
              <p className="rounded-xl bg-secondary px-4 py-6 text-center text-sm font-medium text-muted-foreground">
                Müşteri bulunamadı. &quot;Yeni Müşteri&quot; ile ekleyebilirsin.
              </p>
            )}
            {filtered.map((c) => {
              const active = c.id === selectedCustomerId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCustomer(c.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left transition-colors',
                    active ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground',
                    )}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-foreground">
                      {c.name}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {c.phone}
                    </span>
                  </span>
                  {active && (
                    <Check className="size-5 shrink-0 text-primary" strokeWidth={2.5} />
                  )}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <TextField label="Ad Soyad" value={name} onChange={onName} placeholder="Örn: Ahmet Yılmaz" required />
          <TextField label="Telefon" value={phone} onChange={onPhone} inputMode="tel" placeholder="Örn: 0532 000 00 00" required />
          <TextField label="Adres (isteğe bağlı)" value={address} onChange={onAddress} placeholder="Örn: İlçe, İl" />
        </>
      )}

      <StepButton disabled={!canNext} onClick={onNext}>
        Devam Et
      </StepButton>
    </div>
  )
}

function ModeTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof User
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function IntroLine({
  icon: Icon,
  text,
}: {
  icon: typeof User
  text: string
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      <Icon className="size-4 text-primary" />
      {text}
    </div>
  )
}

function StepButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'accent'
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold shadow-sm transition-all active:scale-[0.99] disabled:opacity-40',
        variant === 'accent'
          ? 'bg-accent text-accent-foreground shadow-accent/25'
          : 'bg-primary text-primary-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}
