import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Check, ChevronDown } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import { colors } from '@/lib/theme'

type InputMode = 'text' | 'numeric' | 'tel'

function keyboardTypeFor(mode: InputMode) {
  if (mode === 'numeric') return 'numeric' as const
  if (mode === 'tel') return 'phone-pad' as const
  return 'default' as const
}

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  inputMode?: InputMode
  className?: string
  required?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  secureTextEntry,
  inputMode = 'text',
  className,
  required,
}: FieldProps) {
  const [focused, setFocused] = useState(false)
  const missing = !!required && value.trim().length === 0
  return (
    <View className={cn('flex flex-col gap-1.5', className)}>
      <Text className="text-sm font-semibold text-muted-foreground">
        {label}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(108, 114, 136, 0.6)"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardTypeFor(inputMode)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          'h-14 rounded-xl border bg-card px-4 text-base font-medium text-foreground',
          missing && !focused ? 'border-destructive' : focused ? 'border-primary' : 'border-border',
        )}
      />
    </View>
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
  const [focused, setFocused] = useState(false)
  const missing = !!required && value.trim().length === 0
  return (
    <View className={cn('flex flex-col gap-1.5', className)}>
      <Text className="text-sm font-semibold text-muted-foreground">
        {label}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(108, 114, 136, 0.6)"
        multiline
        textAlignVertical="top"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ minHeight: rows * 22 + 24 }}
        className={cn(
          'rounded-xl border bg-card px-4 py-3 text-base font-medium leading-relaxed text-foreground',
          missing && !focused ? 'border-destructive' : focused ? 'border-primary' : 'border-border',
        )}
      />
    </View>
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
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <View className={cn('flex flex-col gap-1.5', className)}>
      <Text className="text-sm font-semibold text-muted-foreground">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="h-14 flex-row items-center justify-between rounded-xl border border-border bg-card px-4"
      >
        <Text className="text-base font-medium text-foreground">
          {current?.label ?? ''}
        </Text>
        <ChevronDown size={20} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="rounded-t-3xl bg-card p-4 pb-8">
            <Text className="px-2 pb-2 pt-1 text-sm font-bold text-muted-foreground">
              {label}
            </Text>
            <ScrollView className="max-h-72" showsVerticalScrollIndicator={false}>
              {options.map((o) => {
                const active = o.value === value
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                    className="flex-row items-center justify-between rounded-xl px-3 py-4"
                  >
                    <Text
                      className={cn(
                        'text-base font-semibold',
                        active ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {o.label}
                    </Text>
                    {active && <Check size={20} color={colors.primary} strokeWidth={2.5} />}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}
