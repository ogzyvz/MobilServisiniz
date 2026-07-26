// Tailwind (tailwind.config.js) ile aynı renk paleti.
// lucide ikonlarına color prop'u olarak vermek için JS tarafında da tutuyoruz.
export const colors = {
  background: '#f3f5f8',
  foreground: '#2b3244',
  card: '#ffffff',
  cardForeground: '#2b3244',
  primary: '#2f4a86',
  primaryForeground: '#fcfcfd',
  secondary: '#e8eaef',
  secondaryForeground: '#3a4256',
  muted: '#edeef2',
  mutedForeground: '#6c7288',
  accent: '#e07d33',
  accentForeground: '#fdfdfd',
  destructive: '#d92d20',
  destructiveForeground: '#fdfdfd',
  border: '#dde0e7',
  ring: '#2f4a86',
  chart4: '#3f9a5d',
} as const

// Yarı saydam ("/opacity") renk üretmek için yardımcı — rgba döndürür.
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
