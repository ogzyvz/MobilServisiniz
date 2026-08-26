import { useState } from 'react'
import {
  Pressable,
  Text,
  View,
} from 'react-native'
import { Download } from 'lucide-react-native'
import { AppSheet, SheetCancelButton } from '@/components/app-modal'
import { colors } from '@/lib/theme'
import {
  downloadAndInstallApk,
  getCurrentVersionName,
  openApkUrlFallback,
  type AppUpdateInfo,
  type DownloadProgress,
} from '@/lib/app-update'

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DownloadProgressBar({ progress }: { progress: DownloadProgress | null }) {
  if (!progress) return null
  const pct = progress.percent
  const width = pct == null ? '30%' : `${pct}%`

  return (
    <View className="mt-4 w-full">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">
          {pct == null ? 'İndiriliyor…' : `İndiriliyor %${pct}`}
        </Text>
        {progress.totalBytes != null && progress.totalBytes > 0 ? (
          <Text className="text-xs text-muted-foreground">
            {formatMb(progress.writtenBytes)} / {formatMb(progress.totalBytes)}
          </Text>
        ) : progress.writtenBytes > 0 ? (
          <Text className="text-xs text-muted-foreground">
            {formatMb(progress.writtenBytes)}
          </Text>
        ) : null}
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-secondary">
        <View
          className="h-full rounded-full bg-primary"
          style={{ width: width as `${number}%` }}
        />
      </View>
    </View>
  )
}

function useApkUpdate(apkUrl: string | null | undefined) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)

  async function update() {
    if (!apkUrl) {
      setError('İndirme adresi tanımlı değil.')
      return
    }
    setBusy(true)
    setError(null)
    setProgress({ percent: 0, writtenBytes: 0, totalBytes: null })
    try {
      await downloadAndInstallApk(apkUrl, setProgress)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İndirme başarısız.')
      setProgress(null)
      try {
        await openApkUrlFallback(apkUrl)
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, progress, update }
}

export function ForceUpdateScreen({
  info,
  currentCode,
}: {
  info: AppUpdateInfo
  currentCode: number
}) {
  const { busy, error, progress, update } = useApkUpdate(info.apkUrl)

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Download size={32} color={colors.primary} />
      </View>
      <Text className="mt-5 text-center text-2xl font-extrabold text-foreground">
        Güncelleme gerekli
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        Uygulamayı kullanmaya devam etmek için yeni sürüme geçmeniz gerekiyor.
      </Text>
      <View className="mt-5 w-full rounded-2xl border border-border bg-card px-4 py-3">
        <Text className="text-sm text-muted-foreground">
          Mevcut: {getCurrentVersionName()} ({currentCode})
        </Text>
        <Text className="mt-1 text-sm font-bold text-foreground">
          Yeni: {info.latestVersion} ({info.latestVersionCode})
        </Text>
        {info.releaseNotes ? (
          <Text className="mt-2 text-sm text-muted-foreground">{info.releaseNotes}</Text>
        ) : null}
      </View>
      {busy ? <DownloadProgressBar progress={progress} /> : null}
      {error ? (
        <Text className="mt-3 text-center text-sm text-destructive">{error}</Text>
      ) : null}
      <Pressable
        onPress={update}
        disabled={busy}
        className="mt-6 h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-primary active:opacity-90"
        style={busy ? { opacity: 0.7 } : undefined}
      >
        <Download size={18} color={colors.primaryForeground} />
        <Text className="text-base font-extrabold text-primary-foreground">
          {busy
            ? progress?.percent != null
              ? `İndiriliyor %${progress.percent}`
              : 'İndiriliyor…'
            : 'Güncelle'}
        </Text>
      </Pressable>
    </View>
  )
}

export function SoftUpdateSheet({
  visible,
  info,
  currentCode,
  onClose,
}: {
  visible: boolean
  info: AppUpdateInfo
  currentCode: number
  onClose: () => void
}) {
  const { busy, error, progress, update } = useApkUpdate(info.apkUrl)

  return (
    <AppSheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      title="Yeni sürüm var"
      subtitle={`${getCurrentVersionName()} (${currentCode}) → ${info.latestVersion} (${info.latestVersionCode})`}
    >
      {info.releaseNotes ? (
        <Text className="mb-3 text-sm text-muted-foreground">{info.releaseNotes}</Text>
      ) : (
        <Text className="mb-3 text-sm text-muted-foreground">
          Daha iyi performans ve yeni özellikler için güncelleyin.
        </Text>
      )}
      {busy ? <DownloadProgressBar progress={progress} /> : null}
      {error ? (
        <Text className="mb-2 text-sm text-destructive">{error}</Text>
      ) : null}
      <Pressable
        onPress={update}
        disabled={busy}
        className="mt-3 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-90"
        style={busy ? { opacity: 0.7 } : undefined}
      >
        <Text className="text-sm font-extrabold text-primary-foreground">
          {busy
            ? progress?.percent != null
              ? `İndiriliyor %${progress.percent}`
              : 'İndiriliyor…'
            : 'Güncelle'}
        </Text>
      </Pressable>
      {!busy ? <SheetCancelButton onPress={onClose} label="Sonra" /> : null}
    </AppSheet>
  )
}
