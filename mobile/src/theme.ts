// Paletas de tema (oscuro neón / claro) y helpers de avatar. Replican la identidad
// visual de la web. `useColors` devuelve la paleta activa según el store.

import { useStore } from './store'

export interface Palette {
  bg: string
  bgTint: string
  card: string
  cardStrong: string
  cardBorder: string
  cardBorderStrong: string
  text: string
  textMuted: string
  textFaint: string
  primary: string
  primaryAlt: string
  accentCyan: string
  accentPink: string
  accentPurple: string
  danger: string
  dangerBg: string
  dangerBorder: string
  overlay: string
  glow: string
  navBar: string
}

const dark: Palette = {
  bg: '#0b0614',
  bgTint: '#130a23',
  card: 'rgba(255,255,255,0.05)',
  cardStrong: 'rgba(255,255,255,0.08)',
  cardBorder: 'rgba(255,255,255,0.10)',
  cardBorderStrong: 'rgba(255,255,255,0.16)',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  primary: '#a855f7',
  primaryAlt: '#ec4899',
  accentCyan: '#22d3ee',
  accentPink: '#ec4899',
  accentPurple: '#a855f7',
  danger: '#fb7185',
  dangerBg: 'rgba(244,63,94,0.15)',
  dangerBorder: 'rgba(251,113,133,0.3)',
  overlay: 'rgba(8,4,16,0.82)',
  glow: 'rgba(168,85,247,0.55)',
  navBar: '#171029',
}

const light: Palette = {
  bg: '#f3f2fb',
  bgTint: '#ffffff',
  card: 'rgba(255,255,255,0.7)',
  cardStrong: 'rgba(255,255,255,0.9)',
  cardBorder: 'rgba(15,23,42,0.08)',
  cardBorderStrong: 'rgba(15,23,42,0.12)',
  text: '#1e293b',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#a855f7',
  primaryAlt: '#ec4899',
  accentCyan: '#0891b2',
  accentPink: '#db2777',
  accentPurple: '#9333ea',
  danger: '#e11d48',
  dangerBg: 'rgba(225,29,72,0.12)',
  dangerBorder: 'rgba(225,29,72,0.25)',
  overlay: 'rgba(30,16,51,0.5)',
  glow: 'rgba(168,85,247,0.25)',
  navBar: '#ffffff',
}

export const palettes = { dark, light }

export function useColors(): Palette {
  const theme = useStore((state) => state.theme)
  return palettes[theme]
}

// Gradiente neón de marca (morado -> rosa -> cian).
export const NEON_GRADIENT = ['#a855f7', '#ec4899', '#22d3ee'] as const

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase()
  }
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

export function readableText(hex: string): string {
  const value = hex.replace('#', '')
  if (value.length !== 6) {
    return '#ffffff'
  }
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1c1033' : '#ffffff'
}

// Colores seleccionables al crear un usuario (idénticos a la web).
export const USER_COLORS = [
  '#a855f7',
  '#ec4899',
  '#22d3ee',
  '#f97316',
  '#22c55e',
  '#eab308',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
  '#8b5cf6',
  '#f43f5e',
  '#10b981',
] as const
