'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Phone,
  MapPin,
  Plus,
  Wrench,
  Package,
  MessageSquareWarning,
  Info,
  Check,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  STATUS_LABELS,
  type JobStatus,
  type ProductItem,
  type ServiceItem,
  type Vehicle,
} from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import { TextField, TextArea } from '@/components/form-field'
import { formatCurrency, formatTime } from '@/lib/format'

type Tab = 'bilgiler' | 'sikayet' | 'islem' | 'urun'

const tabs: { key: Tab; label: string }[] = [
  { key: 'bilgiler', label: 'Bilgiler' },
  { key: 'sikayet', label: 'Şikayet' },
  { key: 'islem', label: 'İşlemler' },
  { key: 'urun', label: 'Ürünler' },
]

export function VehicleDetail({
  vehicle,
  onBack,
  onAddComplaint,
  onAddService,
  onUpdateService,
  onDeleteService,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onSetStatus,
}: {
  vehicle: Vehicle
  onBack: () => void
  onAddComplaint: (text: string) => void
  onAddService: (s: Omit<ServiceItem, 'id'>) => void
  onUpdateService: (id: string, s: Omit<ServiceItem, 'id'>) => void
  onDeleteService: (id: string) => void
  onAddProduct: (p: Omit<ProductItem, 'id'>) => void
  onUpdateProduct: (id: string, p: Omit<ProductItem, 'id'>) => void
  onDeleteProduct: (id: string) => void
  onSetStatus: (status: JobStatus) => void
}) {
  const [tab, setTab] = useState<Tab>('bilgiler')

  const total =
    vehicle.services.reduce((s, i) => s + i.price, 0) +
    vehicle.products.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <div>
      <header className="rounded-b-3xl bg-primary px-4 pb-5 pt-6 text-primary-foreground">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15"
            aria-label="Geri"
          >
            <ArrowLeft className="size-5" />
          </button>
          <span className="rounded-lg bg-primary-foreground px-3 py-1.5 font-mono text-base font-bold tracking-wide text-primary">
            {vehicle.plate}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          {vehicle.brand} {vehicle.model}
        </h1>
        <p className="text-sm text-primary-foreground/80">
          {vehicle.year} · {vehicle.color} · {vehicle.fuel}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as JobStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSetStatus(s)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                vehicle.status === s
                  ? 'bg-primary-foreground text-primary'
                  : 'bg-primary-foreground/15 text-primary-foreground',
              )}
            >
              {vehicle.status === s && <Check className="size-3.5" />}
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </header>

      <div className="sticky top-0 z-10 -mt-3 bg-background/95 px-3 pt-4 backdrop-blur">
        <div className="flex gap-1 rounded-2xl bg-secondary p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors',
                tab === t.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        {tab === 'bilgiler' && <InfoTab vehicle={vehicle} />}
        {tab === 'sikayet' && (
          <ComplaintTab vehicle={vehicle} onAdd={onAddComplaint} />
        )}
        {tab === 'islem' && (
          <ServiceTab
            vehicle={vehicle}
            onAdd={onAddService}
            onUpdate={onUpdateService}
            onDelete={onDeleteService}
          />
        )}
        {tab === 'urun' && (
          <ProductTab
            vehicle={vehicle}
            onAdd={onAddProduct}
            onUpdate={onUpdateProduct}
            onDelete={onDeleteProduct}
          />
        )}
      </div>

      {(vehicle.services.length > 0 || vehicle.products.length > 0) && (
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between rounded-2xl bg-foreground px-5 py-4 text-background">
            <span className="text-sm font-semibold text-background/80">
              Toplam Tutar
            </span>
            <span className="text-xl font-extrabold">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoTab({ vehicle }: { vehicle: Vehicle }) {
  const rows = [
    { label: 'Marka / Model', value: `${vehicle.brand} ${vehicle.model}` },
    { label: 'Model Yılı', value: vehicle.year },
    { label: 'Renk', value: vehicle.color },
    { label: 'Yakıt', value: vehicle.fuel },
    { label: 'Kilometre', value: vehicle.km ? `${vehicle.km} km` : '' },
    { label: 'Şasi No', value: vehicle.chassis, mono: true },
  ]
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Info className="size-4 text-primary" /> Araç Bilgileri
        </div>
        <dl className="mt-3 divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5">
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd
                className={cn(
                  'text-sm font-bold text-foreground',
                  r.mono && 'font-mono text-xs',
                )}
              >
                {r.value || '-'}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Phone className="size-4 text-primary" /> Müşteri
        </div>
        <p className="mt-3 text-lg font-extrabold text-foreground">
          {vehicle.customer.name}
        </p>
        <a
          href={`tel:${vehicle.customer.phone.replace(/\s/g, '')}`}
          className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <Phone className="size-4" /> {vehicle.customer.phone}
        </a>
        {vehicle.customer.address && (
          <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {vehicle.customer.address}
          </p>
        )}
      </section>
    </div>
  )
}

function ComplaintTab({
  vehicle,
  onAdd,
}: {
  vehicle: Vehicle
  onAdd: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  function save() {
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {vehicle.complaints.length === 0 && !open && (
        <EmptyState
          icon={MessageSquareWarning}
          text="Henüz şikayet eklenmedi."
        />
      )}

      {vehicle.complaints.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <MessageSquareWarning className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium leading-relaxed text-foreground">
                {c.text}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTime(c.createdAt)}
              </p>
            </div>
          </div>
        </div>
      ))}

      {open ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <TextArea
            label="Yeni Şikayet"
            value={text}
            onChange={setText}
            rows={4}
            placeholder="Müşterinin belirttiği arıza..."
          />
          <div className="mt-3 flex gap-2">
            <SaveButton onClick={save} />
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </div>
      ) : (
        <AddButton label="Şikayet Ekle" onClick={() => setOpen(true)} />
      )}
    </div>
  )
}

function ServiceTab({
  vehicle,
  onAdd,
  onUpdate,
  onDelete,
}: {
  vehicle: Vehicle
  onAdd: (s: Omit<ServiceItem, 'id'>) => void
  onUpdate: (id: string, s: Omit<ServiceItem, 'id'>) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')

  function reset() {
    setTitle('')
    setPrice('')
    setOpen(false)
    setEditingId(null)
  }

  function startAdd() {
    setEditingId(null)
    setTitle('')
    setPrice('')
    setOpen(true)
  }

  function startEdit(s: ServiceItem) {
    setOpen(false)
    setEditingId(s.id)
    setTitle(s.title)
    setPrice(String(s.price))
  }

  function save() {
    if (!title.trim()) return
    const data = { title: title.trim(), price: Number(price) || 0 }
    if (editingId) {
      onUpdate(editingId, data)
    } else {
      onAdd(data)
    }
    reset()
  }

  return (
    <div className="flex flex-col gap-3">
      {vehicle.services.length === 0 && !open && (
        <EmptyState icon={Wrench} text="Henüz işlem eklenmedi." />
      )}

      {vehicle.services.map((s) =>
        editingId === s.id ? (
          <ItemForm
            key={s.id}
            onSave={save}
            onCancel={reset}
            fields={
              <>
                <TextField label="Yapılan İşlem" value={title} onChange={setTitle} placeholder="Örn: Yağ değişimi" />
                <TextField label="İşçilik Ücreti (₺)" value={price} onChange={setPrice} inputMode="numeric" placeholder="0" />
              </>
            }
          />
        ) : (
          <Row
            key={s.id}
            icon={Wrench}
            title={s.title}
            value={formatCurrency(s.price)}
            confirming={confirmId === s.id}
            onEdit={() => startEdit(s)}
            onDelete={() => setConfirmId(s.id)}
            onConfirmDelete={() => {
              onDelete(s.id)
              setConfirmId(null)
            }}
            onCancelDelete={() => setConfirmId(null)}
          />
        ),
      )}

      {open ? (
        <ItemForm
          onSave={save}
          onCancel={reset}
          fields={
            <>
              <TextField label="Yapılan İşlem" value={title} onChange={setTitle} placeholder="Örn: Yağ değişimi" />
              <TextField label="İşçilik Ücreti (₺)" value={price} onChange={setPrice} inputMode="numeric" placeholder="0" />
            </>
          }
        />
      ) : (
        editingId === null && <AddButton label="İşlem Ekle" onClick={startAdd} />
      )}
    </div>
  )
}

function ProductTab({
  vehicle,
  onAdd,
  onUpdate,
  onDelete,
}: {
  vehicle: Vehicle
  onAdd: (p: Omit<ProductItem, 'id'>) => void
  onUpdate: (id: string, p: Omit<ProductItem, 'id'>) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')

  function reset() {
    setName('')
    setQty('1')
    setPrice('')
    setOpen(false)
    setEditingId(null)
  }

  function startAdd() {
    setEditingId(null)
    setName('')
    setQty('1')
    setPrice('')
    setOpen(true)
  }

  function startEdit(p: ProductItem) {
    setOpen(false)
    setEditingId(p.id)
    setName(p.name)
    setQty(String(p.quantity))
    setPrice(String(p.price))
  }

  function save() {
    if (!name.trim()) return
    const data = {
      name: name.trim(),
      quantity: Number(qty) || 1,
      price: Number(price) || 0,
    }
    if (editingId) {
      onUpdate(editingId, data)
    } else {
      onAdd(data)
    }
    reset()
  }

  const formFields = (
    <>
      <TextField label="Ürün / Parça Adı" value={name} onChange={setName} placeholder="Örn: Motor yağı 5W-30" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Adet" value={qty} onChange={setQty} inputMode="numeric" placeholder="1" />
        <TextField label="Birim Fiyat (₺)" value={price} onChange={setPrice} inputMode="numeric" placeholder="0" />
      </div>
    </>
  )

  return (
    <div className="flex flex-col gap-3">
      {vehicle.products.length === 0 && !open && (
        <EmptyState icon={Package} text="Henüz ürün/parça eklenmedi." />
      )}

      {vehicle.products.map((p) =>
        editingId === p.id ? (
          <ItemForm key={p.id} onSave={save} onCancel={reset} fields={formFields} />
        ) : (
          <Row
            key={p.id}
            icon={Package}
            title={p.name}
            subtitle={`${p.quantity} adet × ${formatCurrency(p.price)}`}
            value={formatCurrency(p.price * p.quantity)}
            confirming={confirmId === p.id}
            onEdit={() => startEdit(p)}
            onDelete={() => setConfirmId(p.id)}
            onConfirmDelete={() => {
              onDelete(p.id)
              setConfirmId(null)
            }}
            onCancelDelete={() => setConfirmId(null)}
          />
        ),
      )}

      {open ? (
        <ItemForm onSave={save} onCancel={reset} fields={formFields} />
      ) : (
        editingId === null && <AddButton label="Ürün Ekle" onClick={startAdd} />
      )}
    </div>
  )
}

function Row({
  icon: Icon,
  title,
  subtitle,
  value,
  confirming,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  icon: typeof Wrench
  title: string
  subtitle?: string
  value: string
  confirming: boolean
  onEdit: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  if (confirming) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3">
        <div className="flex-1 pl-1">
          <p className="text-sm font-bold text-foreground">Silinsin mi?</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{title}</p>
        </div>
        <button
          type="button"
          onClick={onConfirmDelete}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground"
        >
          <Trash2 className="size-4" /> Sil
        </button>
        <button
          type="button"
          onClick={onCancelDelete}
          className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
          aria-label="Vazgeç"
        >
          <X className="size-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
        <span className="mt-0.5 block text-sm font-extrabold text-foreground">
          {value}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-colors active:bg-secondary/70"
          aria-label="Düzenle"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-colors active:bg-destructive/20"
          aria-label="Sil"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

function ItemForm({
  fields,
  onSave,
  onCancel,
}: {
  fields: React.ReactNode
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-sm">
      {fields}
      <div className="flex gap-2">
        <SaveButton onClick={onSave} />
        <CancelButton onClick={onCancel} />
      </div>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof Wrench
  text: string
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
        <Icon className="size-7 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-base font-bold text-primary transition-colors active:bg-primary/10"
    >
      <Plus className="size-5" /> {label}
    </button>
  )
}

function SaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-extrabold text-accent-foreground"
    >
      <Check className="size-4" /> Kaydet
    </button>
  )
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center justify-center rounded-xl bg-secondary px-5 text-sm font-bold text-secondary-foreground"
    >
      Vazgeç
    </button>
  )
}
