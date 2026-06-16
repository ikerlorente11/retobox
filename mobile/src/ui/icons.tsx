// Iconos SVG portados 1:1 desde frontend/src/components/icons.tsx, con
// react-native-svg. Mismos trazos y estilo (stroke, currentColor) que la web,
// para que navbar y tarjetas se vean idénticas.

import Svg, { Circle, Path, Rect } from 'react-native-svg'

export interface IconProps {
  size?: number
  color?: string
}

const DEFAULT_SIZE = 22

export function DiceIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={4} stroke={color} strokeWidth={2} />
      <Circle cx={8} cy={8} r={1.2} fill={color} />
      <Circle cx={16} cy={16} r={1.2} fill={color} />
      <Circle cx={16} cy={8} r={1.2} fill={color} />
      <Circle cx={8} cy={16} r={1.2} fill={color} />
      <Circle cx={12} cy={12} r={1.2} fill={color} />
    </Svg>
  )
}

export function ListIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6h12M8 12h12M8 18h12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={3.5} cy={6} r={1.2} fill={color} />
      <Circle cx={3.5} cy={12} r={1.2} fill={color} />
      <Circle cx={3.5} cy={18} r={1.2} fill={color} />
    </Svg>
  )
}

export function UsersIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={color} strokeWidth={2} />
      <Path
        d="M3.5 19a5.5 5.5 0 0 1 11 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17 14.2A5.5 5.5 0 0 1 20.5 19"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function SettingsIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
      <Path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function PlusIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  )
}

export function TrashIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function RefreshIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 12a8.5 8.5 0 0 1 14.5-6M20.5 12a8.5 8.5 0 0 1-14.5 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 2.5V6h-3.5M6 21.5V18h3.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// Chevron hacia abajo; con `rotated` apunta hacia arriba (desplegar/colapsar).
export function ChevronIcon({
  size = DEFAULT_SIZE,
  color = '#fff',
  rotated = false,
}: IconProps & { rotated?: boolean }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: [{ rotate: rotated ? '180deg' : '0deg' }] }}
    >
      <Path d="m6 9 6 6 6-6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

// Colección: capas apiladas (selector de colección).
export function CollectionIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16.5l9 5 9-5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// Mezclar/combinar: flechas cruzadas (pestaña Combos).
export function ShuffleIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 3h5v5M21 3l-7 7M16 21h5v-5M21 21l-7-7M3 4l4 4M3 20l7-7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// Compartir: nodos conectados (menú nativo de compartir).
export function ShareIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={2.6} stroke={color} strokeWidth={2} />
      <Circle cx={6} cy={12} r={2.6} stroke={color} strokeWidth={2} />
      <Circle cx={18} cy={19} r={2.6} stroke={color} strokeWidth={2} />
      <Path
        d="M8.3 10.8 15.7 6.4M8.3 13.2l7.4 4.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

// Importar: flecha hacia arriba saliendo de una bandeja (meter un fichero).
export function ImportIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 14V3M7.5 7.5 12 3l4.5 4.5M5 19h14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function EditIcon({ size = DEFAULT_SIZE, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L19 9l-4-4L4 16v4Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14 5l4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
