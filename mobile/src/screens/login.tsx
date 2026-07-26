import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Wrench, User, Phone, Lock, Eye, EyeOff, Building2 } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import { colors, withAlpha } from '@/lib/theme'
import { getStoredTenantCode, lookupTenant, type AuthResult } from '@/lib/api'

type Mode = 'login' | 'register'
type IconType = typeof User

export function Login({
  onLogin,
  onRegister,
}: {
  onLogin: (tenantCode: string, phone: string, password: string) => Promise<AuthResult>
  onRegister: (name: string, phone: string, password: string) => Promise<AuthResult>
}) {
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<Mode>('login')
  const [tenantCode, setTenantCode] = useState('')
  const [shopPreview, setShopPreview] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getStoredTenantCode().then((code) => {
      if (code) setTenantCode(code)
    })
  }, [])

  useEffect(() => {
    if (tenantCode.trim().length < 3) {
      setShopPreview('')
      return
    }
    const t = setTimeout(async () => {
      const shop = await lookupTenant(tenantCode)
      setShopPreview(shop ? `✓ ${shop.shopName}${shop.city ? ` · ${shop.city}` : ''}` : '')
    }, 400)
    return () => clearTimeout(t)
  }, [tenantCode])

  async function handleSubmit() {
    setError('')

    if (tenantCode.trim().length < 3) {
      setError('Lütfen servis kodunuzu girin (ör. OTO-IST).')
      return
    }
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
    try {
      const res =
        mode === 'register'
          ? await onRegister(name.trim(), phone.trim(), password)
          : await onLogin(tenantCode.trim(), phone.trim(), password)
      if (!res.ok) {
        setError(res.error)
      }
    } catch {
      setError('Bir hata oluştu, lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1">
          <View className="items-center">
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary-foreground/12 border border-primary-foreground/20">
              <Wrench size={40} color={colors.primaryForeground} strokeWidth={2.2} />
            </View>
            <Text className="mt-5 text-3xl font-extrabold tracking-tight text-primary-foreground">
              MobilServisiniz
            </Text>
            <Text className="mt-2 text-sm text-primary-foreground/75">
              Servis kodunuz ile giriş yapın
            </Text>
          </View>

          <View className="mt-8 rounded-3xl bg-card p-5" style={cardBigShadow}>
            <View className="flex-row rounded-2xl bg-secondary p-1">
              <TabButton
                active={mode === 'login'}
                label="Giriş Yap"
                onPress={() => {
                  setMode('login')
                  setError('')
                }}
              />
              <TabButton
                active={mode === 'register'}
                label="Kayıt Ol"
                onPress={() => {
                  setMode('register')
                  setError('')
                }}
              />
            </View>

            <View className="mt-5 flex flex-col gap-4">
              <View>
                <Text className="text-sm font-semibold text-muted-foreground">Servis Kodu</Text>
                <View className="mt-1.5 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4">
                  <Building2 size={20} color={colors.mutedForeground} />
                  <TextInput
                    value={tenantCode}
                    onChangeText={(v) => setTenantCode(v.toUpperCase())}
                    placeholder="OTO-IST"
                    autoCapitalize="characters"
                    placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
                    className="h-14 flex-1 text-base font-bold tracking-wide text-foreground"
                  />
                </View>
                {shopPreview !== '' && (
                  <Text className="mt-1.5 text-xs font-semibold text-green-600">{shopPreview}</Text>
                )}
              </View>

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
                keyboardType="phone-pad"
              />

              <View>
                <Text className="text-sm font-semibold text-muted-foreground">Şifre</Text>
                <View className="mt-1.5 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4">
                  <Lock size={20} color={colors.mutedForeground} />
                  <TextInput
                    secureTextEntry={!showPass}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••"
                    placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
                    className="h-14 flex-1 text-base font-medium text-foreground"
                  />
                  <Pressable onPress={() => setShowPass((s) => !s)}>
                    {showPass ? (
                      <EyeOff size={20} color={colors.mutedForeground} />
                    ) : (
                      <Eye size={20} color={colors.mutedForeground} />
                    )}
                  </Pressable>
                </View>
              </View>

              {error !== '' && (
                <View className="rounded-xl bg-destructive/10 px-4 py-3">
                  <Text className="text-sm font-semibold text-destructive">{error}</Text>
                </View>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className={cn(
                  'mt-1 h-14 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-90',
                  loading && 'opacity-70',
                )}
              >
                {loading ? (
                  <ActivityIndicator color={colors.accentForeground} />
                ) : (
                  <Text className="text-base font-extrabold text-accent-foreground">
                    {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {__DEV__ && (
          <Text className="mt-6 text-center text-xs leading-5 text-primary-foreground/60">
            Demo: OTO-IST · 05551112233 · 1234{'\n'}
            OTO-ANK · 05337776655 · 1234
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function TabButton({
  active,
  onPress,
  label,
}: {
  active: boolean
  onPress: () => void
  label: string
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('flex-1 rounded-xl py-3', active && 'bg-card')}
      style={active ? cardShadowSm : undefined}
    >
      <Text
        className={cn(
          'text-center text-sm font-bold',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function IconField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
}: {
  icon: IconType
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'phone-pad'
}) {
  return (
    <View>
      <Text className="text-sm font-semibold text-muted-foreground">{label}</Text>
      <View className="mt-1.5 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4">
        <Icon size={20} color={colors.mutedForeground} />
        <TextInput
          value={value}
          keyboardType={keyboardType}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={withAlpha(colors.mutedForeground, 0.6)}
          className="h-14 flex-1 text-base font-medium text-foreground"
        />
      </View>
    </View>
  )
}

const cardShadowSm = {
  shadowColor: '#0b1220',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 2,
  elevation: 1,
}

const cardBigShadow = {
  shadowColor: '#0b1220',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.18,
  shadowRadius: 24,
  elevation: 8,
}
