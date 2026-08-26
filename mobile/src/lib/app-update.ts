import { Linking, Platform } from 'react-native'
import * as Application from 'expo-application'
import * as FileSystem from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'
import { API_BASE_URL } from './api-config'

export type AppUpdateInfo = {
  latestVersion: string
  latestVersionCode: number
  minVersionCode: number
  apkUrl?: string | null
  releaseNotes?: string | null
}

export type UpdateGate =
  | { kind: 'none' }
  | { kind: 'soft'; info: AppUpdateInfo; currentCode: number }
  | { kind: 'force'; info: AppUpdateInfo; currentCode: number }

export type DownloadProgress = {
  /** 0–100; boyut bilinmiyorsa null */
  percent: number | null
  writtenBytes: number
  totalBytes: number | null
}

export function getCurrentVersionCode(): number {
  if (Platform.OS !== 'android') return Number.MAX_SAFE_INTEGER
  const raw = Application.nativeBuildVersion
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function getCurrentVersionName(): string {
  return Application.nativeApplicationVersion ?? '?'
}

export async function fetchAppUpdateInfo(): Promise<AppUpdateInfo | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/app/update-info`)
    if (!res.ok) return null
    const info = (await res.json()) as AppUpdateInfo
    return {
      ...info,
      latestVersionCode: Number(info.latestVersionCode),
      minVersionCode: Number(info.minVersionCode),
    }
  } catch {
    return null
  }
}

export async function evaluateUpdateGate(): Promise<UpdateGate> {
  if (Platform.OS !== 'android') return { kind: 'none' }
  const info = await fetchAppUpdateInfo()
  if (!info?.apkUrl) return { kind: 'none' }
  const currentCode = getCurrentVersionCode()
  if (currentCode < info.minVersionCode) {
    return { kind: 'force', info, currentCode }
  }
  if (currentCode < info.latestVersionCode) {
    return { kind: 'soft', info, currentCode }
  }
  return { kind: 'none' }
}

export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(apkUrl)
    return
  }

  const dest = `${FileSystem.cacheDirectory}MobilServisiniz-update.apk`
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true })
  } catch {
    /* ignore */
  }

  const download = FileSystem.createDownloadResumable(
    apkUrl,
    dest,
    {},
    (progress) => {
      const written = progress.totalBytesWritten
      const total = progress.totalBytesExpectedToWrite
      if (!total || total <= 0) {
        onProgress?.({ percent: null, writtenBytes: written, totalBytes: null })
        return
      }
      const percent = Math.min(100, Math.round((written / total) * 100))
      onProgress?.({ percent, writtenBytes: written, totalBytes: total })
    },
  )

  const result = await download.downloadAsync()
  if (!result?.uri) throw new Error('İndirme tamamlanamadı.')

  const info = await FileSystem.getInfoAsync(result.uri)
  if (!info.exists || !('size' in info) || !info.size || info.size < 1_000_000) {
    throw new Error('İndirilen dosya geçersiz (APK alınamadı).')
  }

  onProgress?.({
    percent: 100,
    writtenBytes: info.size,
    totalBytes: info.size,
  })

  try {
    const contentUri = await FileSystem.getContentUriAsync(result.uri)
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/vnd.android.package-archive',
    })
  } catch {
    await Linking.openURL(apkUrl)
  }
}

export async function openApkUrlFallback(apkUrl: string): Promise<void> {
  await Linking.openURL(apkUrl)
}
