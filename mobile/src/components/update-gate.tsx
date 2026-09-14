import { useEffect, useState, type ReactNode } from 'react'
import { Linking, Platform, Pressable, Text, View } from 'react-native'
import * as Application from 'expo-application'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Download, RefreshCw } from 'lucide-react-native'

import { AppSheet, SheetActionList, SheetCancelButton } from '@/components/app-modal'
import { colors } from '@/lib/theme'
import { fetchAppUpdateInfo, type AppUpdateInfo } from '@/lib/api'

const FALLBACK_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.efogy.mobilservisiniz'
const DISMISS_KEY = 'otoservis_update_dismissed_code'

function openStore(storeUrl?: string | null) {
  const webUrl = storeUrl && storeUrl.trim().length > 0 ? storeUrl : FALLBACK_STORE_URL
  const pkg = Application.applicationId
  const marketUrl = pkg ? `market://details?id=${pkg}` : null

  const openWeb = () => {
    Linking.openURL(webUrl).catch(() => {
      /* açılamazsa yutulur — kullanıcı zaten Play Store'da manuel arayabilir */
    })
  }

  if (Platform.OS === 'android' && marketUrl) {
    Linking.canOpenURL(marketUrl)
      .then((can) => (can ? Linking.openURL(marketUrl) : openWeb()))
      .catch(openWeb)
  } else {
    openWeb()
  }
}

/**
 * Uygulama açılışında Play Console'daki sürüm bilgisiyle yüklü sürümü karşılaştırır:
 * - Yüklü sürüm `minVersionCode`'un altındaysa: kapatılamayan "Güncelleme Gerekli" ekranı
 *   gösterilir, uygulamanın kalanı render edilmez.
 * - Yüklü sürüm `minVersionCode` ile `latestVersionCode` arasındaysa: uygulama normal
 *   çalışır, üstüne kapatılabilir bir "Yeni sürüm mevcut" uyarısı biner (aynı sürüm için
 *   bir kez kapatılınca bir daha o sürümde gösterilmez).
 * - Sürüm kontrolü başarısız olursa (ağ hatası, sunucu kapalı vb.) sessizce atlanır;
 *   kullanıcı kilitlenmez.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const [forceInfo, setForceInfo] = useState<AppUpdateInfo | null>(null)
  const [softInfo, setSoftInfo] = useState<AppUpdateInfo | null>(null)

  useEffect(() => {
    let active = true
    if (Platform.OS !== 'android') return () => {}
    ;(async () => {
      const info = await fetchAppUpdateInfo()
      if (!active || !info) return

      const current = parseInt(Application.nativeBuildVersion ?? '', 10)
      if (!current) return

      if (current < info.minVersionCode) {
        setForceInfo(info)
        return
      }
      if (current < info.latestVersionCode) {
        const dismissed = await AsyncStorage.getItem(DISMISS_KEY)
        if (!active) return
        if (dismissed !== String(info.latestVersionCode)) {
          setSoftInfo(info)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (forceInfo) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <RefreshCw size={30} color={colors.primary} strokeWidth={2.2} />
        </View>
        <Text className="mt-5 text-center text-xl font-extrabold tracking-tight text-foreground">
          Güncelleme Gerekli
        </Text>
        <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
          Devam etmek için uygulamanın yeni sürümünü Google Play'den yüklemeniz gerekiyor.
        </Text>
        {forceInfo.releaseNotes ? (
          <Text className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            {forceInfo.releaseNotes}
          </Text>
        ) : null}
        <Pressable
          onPress={() => openStore(forceInfo.storeUrl)}
          className="mt-7 h-12 w-full items-center justify-center rounded-2xl bg-primary active:opacity-90"
        >
          <Text className="text-sm font-bold text-primary-foreground">
            Play Store'da Güncelle
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <>
      {children}
      <AppSheet
        visible={!!softInfo}
        onClose={() => {
          if (softInfo) {
            AsyncStorage.setItem(DISMISS_KEY, String(softInfo.latestVersionCode)).catch(() => {})
          }
          setSoftInfo(null)
        }}
        title="Yeni sürüm mevcut"
        subtitle={
          softInfo?.releaseNotes || `Sürüm ${softInfo?.latestVersion ?? ''} yayınlandı.`
        }
      >
        <SheetActionList
          onClose={() => {
            if (softInfo) {
              AsyncStorage.setItem(DISMISS_KEY, String(softInfo.latestVersionCode)).catch(() => {})
            }
            setSoftInfo(null)
          }}
          actions={[
            {
              key: 'update',
              label: "Play Store'da Güncelle",
              description: 'En son özellikler ve düzeltmeler için güncelleyin',
              icon: Download,
              tone: 'primary',
              onPress: () => openStore(softInfo?.storeUrl),
            },
          ]}
        />
        <SheetCancelButton
          label="Daha Sonra"
          onPress={() => {
            if (softInfo) {
              AsyncStorage.setItem(DISMISS_KEY, String(softInfo.latestVersionCode)).catch(() => {})
            }
            setSoftInfo(null)
          }}
        />
      </AppSheet>
    </>
  )
}
