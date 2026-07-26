import { Text, View } from 'react-native'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, type JobStatus } from '@/lib/types'

const styles: Record<JobStatus, string> = {
  bekliyor: 'bg-accent/15 border border-accent/30',
  islemde: 'bg-primary/10 border border-primary/20',
  tamamlandi: 'bg-chart-4/15 border border-chart-4/25',
}

const textStyles: Record<JobStatus, string> = {
  bekliyor: 'text-accent',
  islemde: 'text-primary',
  tamamlandi: 'text-chart-4',
}

const dot: Record<JobStatus, string> = {
  bekliyor: 'bg-accent',
  islemde: 'bg-primary',
  tamamlandi: 'bg-chart-4',
}

export function StatusBadge({
  status,
  className,
}: {
  status: JobStatus
  className?: string
}) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 rounded-full px-3 py-1',
        styles[status],
        className,
      )}
    >
      <View className={cn('h-1.5 w-1.5 rounded-full', dot[status])} />
      <Text className={cn('text-xs font-semibold', textStyles[status])}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  )
}
