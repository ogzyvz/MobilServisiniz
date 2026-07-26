'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'numeric' | 'tel'
  className?: string
  required?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode = 'text',
  className,
  required,
}: FieldProps) {
  const missing = !!required && value.trim().length === 0
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-14 rounded-xl border bg-card px-4 text-base font-medium text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/15',
          missing ? 'border-destructive' : 'border-border',
        )}
      />
    </label>
  )
}

interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
}: SelectProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-semibold text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 w-full appearance-none rounded-xl border border-border bg-card px-4 pr-11 text-base font-medium text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/15"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  )
}

interface AreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  required?: boolean
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
  required,
}: AreaProps) {
  const missing = !!required && value.trim().length === 0
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'resize-none rounded-xl border bg-card px-4 py-3 text-base font-medium leading-relaxed text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/15',
          missing ? 'border-destructive' : 'border-border',
        )}
      />
    </label>
  )
}
