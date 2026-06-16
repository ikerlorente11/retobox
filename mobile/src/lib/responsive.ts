// Helper responsive para tablet. React Native no tiene media queries CSS, así
// que derivamos el layout del ancho de ventana (igual idea que los breakpoints
// md=768 / lg=1024 de la web). Reacciona a rotación porque useWindowDimensions
// se re-renderiza al cambiar el tamaño.

import { useWindowDimensions } from 'react-native'

export interface Responsive {
  width: number
  isTablet: boolean // >= 768 (md)
  isLarge: boolean // >= 1024 (lg)
  /** Columnas para la rejilla de retos. */
  challengeColumns: number
  /** Columnas para la rejilla de usuarios. */
  userColumns: number
  /** Ancho máximo del contenido (se centra en tablet). */
  maxContentWidth: number
}

const TABLET = 768
const LARGE = 1024

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET
  const isLarge = width >= LARGE
  return {
    width,
    isTablet,
    isLarge,
    challengeColumns: isLarge ? 3 : isTablet ? 2 : 1,
    userColumns: isLarge ? 3 : isTablet ? 2 : 1,
    maxContentWidth: isLarge ? 960 : isTablet ? 720 : Infinity,
  }
}
