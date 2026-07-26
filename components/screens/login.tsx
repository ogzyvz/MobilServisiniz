'use client'

import { useState } from 'react'
import { Wrench, User, Phone, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

export function Login({ onSuccess }: { onSuccess: (name: string) => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'register' && name.trim().length < 2) {
      setError('Lütfen adınızı ve soyadınızı girin.')
      return
    }
    if (phone.trim().length < 7) {
      setError('Lütfen geçerli bir telefon numarası girin.')
      return
    }
    if (password.length < 4) {
      setError('Şifre en az 4 karakter olmalı.')
      return
    }

    setLoading(true)
    // Tasarım aşaması: giriş simüle ediliyor.
    setTimeout(() => {
      setLoading(false)
      onSuccess(mode === 'register' ? name.trim() : 'Usta')
    }, 900)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-primary px-6 pb-10 pt-16 text-primary-foreground">
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-primary-foreground/12 ring-1 ring-primary-foreground/20">
            <Wrench className="size-10" strokeWidth={2.2} />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
            MobilServisiniz
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/75">
            {mode === 'login'
              ? 'Devam etmek için giriş yapın'
              : 'Yeni personel hesabı oluşturun'}
          </p>
        </div>

        <div className="mt-8 rounded-3xl bg-card p-5 text-card-foreground shadow-2xl">
          <div className="flex rounded-2xl bg-secondary p-1">
            <TabButton
              active={mode === 'login'}
              onClick={() => {
                setMode('login')
                setError('')
              }}
            >
              Giriş Yap
            </TabButton>
            <TabButton
              active={mode === 'register'}
              onClick={() => {
                setMode('register')
                setError('')
              }}
            >
              Kayıt Ol
            </TabButton>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            {mode === 'register' && (
              <IconField
                icon={User}
                label="Ad Soyad"
                value={name}
                onChange={setName}
                placeholder="Örn. Ali Usta"
              />
            )}

            <IconField
              icon={Phone}
              label="Telefon"
              value={phone}
              onChange={setPhone}
              placeholder="05XX XXX XX XX"
              inputMode="tel"
            />

            <div>
              <span className="text-sm font-semibold text-muted-foreground">
                Şifre
              </span>
              <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-border bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                <Lock className="size-5 shrink-0 text-muted-foreground" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="h-14 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="text-muted-foreground"
                  aria-label={showPass ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPass ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-14 items-center justify-center gap-2 rounded-xl bg-accent text-base font-extrabold text-accent-foreground shadow-lg shadow-accent/25 transition-transform active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : mode === 'login' ? (
                'Giriş Yap'
              ) : (
                'Hesap Oluştur'
              )}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                className="text-center text-sm font-semibold text-primary"
              >
                Şifremi unuttum
              </button>
            )}
          </form>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-primary-foreground/60">
        Yalnızca yetkili servis personeli içindir.
      </p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl py-3 text-sm font-bold transition-colors',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

function IconField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  inputMode = 'text',
}: {
  icon: typeof User
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'text' | 'tel' | 'numeric'
}) {
  return (
    <div>
      <span className="text-sm font-semibold text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-border bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <input
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-14 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  )
}
