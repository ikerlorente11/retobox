// Paleta agradable asignada a usuarios que no aportan color. Se rota por el
// número actual de usuarios para que dos consecutivos reciban colores distintos.
// Idéntica a COLOR_PALETTE del backend (CONTRACT.md).

export const COLOR_PALETTE = [
  '#FF6B6B', // coral red
  '#4ECDC4', // turquoise
  '#FFD93D', // sunny yellow
  '#6BCB77', // green
  '#4D96FF', // blue
  '#FF8FB1', // pink
  '#B983FF', // purple
  '#FF9F45', // orange
  '#1FAB89', // emerald
  '#F46060', // salmon
  '#5C7AEA', // indigo
  '#00C2A8', // teal
] as const

export function pickColor(userCount: number): string {
  return COLOR_PALETTE[userCount % COLOR_PALETTE.length] as string
}
