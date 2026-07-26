'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Plus,
  Phone,
  MapPin,
  Users,
  ArrowLeft,
  Pencil,
} from 'lucide-react'
import type { Customer } from '@/lib/types'
import { TextField, TextArea } from '@/components/form-field'

export function Customers({
  customers,
  onAdd,
  onUpdate,
}: {
  customers: Customer[]
  onAdd: (c: Omit<Customer, 'id'>) => void
  onUpdate: (id: string, c: Omit<Customer, 'id'>) => void
}) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    if (!q) return customers
    return customers.filter((c) =>
      `${c.name} ${c.phone} ${c.address ?? ''}`
        .toLocaleLowerCase('tr')
        .includes(q),
    )
  }, [customers, query])

  if (editing) {
    return (
      <CustomerForm
        initial={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(data) => {
          if (editing === 'new') onAdd(data)
          else onUpdate(editing.id, data)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div>
      <header className="sticky top-0 z-10 bg-background/95 px-5 pb-3 pt-8 backdrop-blur">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Müşteriler
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toplam {customers.length} müşteri kayıtlı
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <Search className="size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İsim veya telefon ara"
            className="h-14 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <button
          type="button"
          onClick={() => setEditing('new')}
          className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-accent-foreground shadow-lg shadow-accent/25 transition-transform active:scale-[0.99]"
        >
          <Plus className="size-6" strokeWidth={2.4} /> Yeni Müşteri Ekle
        </button>
      </header>

      <div className="px-5 pt-2">
        {filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <Users className="size-8 text-muted-foreground" />
            </span>
            <p className="mt-4 text-base font-bold text-foreground">
              Müşteri bulunamadı
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aramanı değiştir veya yeni bir müşteri ekle.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-base font-extrabold text-primary">
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-foreground">
                    {c.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-4" /> {c.phone}
                  </p>
                  {c.address && (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" /> {c.address}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
                  aria-label={`${c.name} düzenle`}
                >
                  <Pencil className="size-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CustomerForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Customer | null
  onCancel: () => void
  onSave: (data: Omit<Customer, 'id'>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [error, setError] = useState('')

  function handleSave() {
    if (name.trim().length < 2) {
      setError('Lütfen müşteri adını girin.')
      return
    }
    if (phone.trim().length < 7) {
      setError('Lütfen geçerli bir telefon girin.')
      return
    }
    onSave({ name: name.trim(), phone: phone.trim(), address: address.trim() })
  }

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-5 pb-3 pt-8 backdrop-blur">
        <button
          type="button"
          onClick={onCancel}
          className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
          aria-label="Geri"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">
          {initial ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
        </h1>
      </header>

      <div className="flex flex-col gap-4 px-5 pt-2">
        <TextField
          label="Ad Soyad"
          value={name}
          onChange={setName}
          placeholder="Örn. Ayşe Kaya"
        />
        <TextField
          label="Telefon"
          value={phone}
          onChange={setPhone}
          placeholder="05XX XXX XX XX"
          inputMode="tel"
        />
        <TextArea
          label="Adres (isteğe bağlı)"
          value={address}
          onChange={setAddress}
          placeholder="Mahalle, ilçe, il"
          rows={3}
        />

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="mt-1 flex h-14 items-center justify-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.99]"
        >
          {initial ? 'Değişiklikleri Kaydet' : 'Müşteriyi Kaydet'}
        </button>
      </div>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr'))
    .join('')
}
