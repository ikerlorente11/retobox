import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

export const DiceIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    <circle cx="16" cy="8" r="1.2" fill="currentColor" />
    <circle cx="8" cy="16" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
  </svg>
)

export const ListIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" {...p}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="3.5" cy="6" r="1.2" fill="currentColor" />
    <circle cx="3.5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="3.5" cy="18" r="1.2" fill="currentColor" />
  </svg>
)

export const UsersIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17 14.2A5.5 5.5 0 0 1 20.5 19" />
  </svg>
)

export const SettingsIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </svg>
)

// Mezclar / combinar (pestaña del mezclador de palabras).
export const ShuffleIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M16 3h5v5" />
    <path d="M21 3l-7 7" />
    <path d="M16 21h5v-5" />
    <path d="M21 21l-7-7" />
    <path d="M3 4l4 4" />
    <path d="M3 20l7-7" />
  </svg>
)

// Colecciones (capas apiladas).
export const CollectionIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5Z" />
    <path d="M3 12l9 5 9-5" />
    <path d="M3 16.5l9 5 9-5" />
  </svg>
)

export const PlusIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} stroke="currentColor" strokeLinecap="round" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const TrashIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
)

export const EditIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="M14 5l4 4" />
  </svg>
)

// Descargar: flecha hacia abajo cayendo sobre una bandeja.
export const DownloadIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3v11" />
    <path d="M7.5 9.5 12 14l4.5-4.5" />
    <path d="M5 19h14" />
  </svg>
)

// Importar: flecha hacia arriba saliendo de una bandeja (meter un fichero).
export const ImportIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 14V3" />
    <path d="M7.5 7.5 12 3l4.5 4.5" />
    <path d="M5 19h14" />
  </svg>
)
