import { cn } from '@/lib/utils'
import { STATUS_LABELS, type JobStatus } from '@/lib/types'

const styles: Record<JobStatus, string> = {
  bekliyor: 'bg-accent/15 text-accent ring-1 ring-accent/30',
  islemde: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  tamamlandi: 'bg-chart-4/15 text-chart-4 ring-1 ring-chart-4/25',
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
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        styles[status],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dot[status])} />
      {STATUS_LABELS[status]}
    </span>
  )
}
