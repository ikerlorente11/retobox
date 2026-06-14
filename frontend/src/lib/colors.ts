// Paleta agradable para avatares de usuario
export const USER_COLORS = [
  '#a855f7', // morado
  '#ec4899', // rosa
  '#22d3ee', // cian
  '#f97316', // naranja
  '#22c55e', // verde
  '#eab308', // ámbar
  '#3b82f6', // azul
  '#ef4444', // rojo
  '#14b8a6', // teal
  '#8b5cf6', // violeta
  '#f43f5e', // fucsia
  '#10b981', // esmeralda
]

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Texto legible (blanco/oscuro) según luminancia del color de fondo
export function readableText(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return '#fff'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1c1033' : '#ffffff'
}
