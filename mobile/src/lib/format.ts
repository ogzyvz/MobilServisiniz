// React Native (Hermes) ortamında Intl yerel verisi platforma göre değişebildiği
// için Türkçe biçimlendirmeyi elle yapıyoruz; web ile birebir aynı çıktıyı verir.

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

function groupThousands(value: number): string {
  const rounded = Math.round(value)
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatCurrency(value: number): string {
  return `₺${groupThousands(value)}`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  } catch {
    return ''
  }
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return `${pad2(d.getDate())} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  } catch {
    return ''
  }
}
