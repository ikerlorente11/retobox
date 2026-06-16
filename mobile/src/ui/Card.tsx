// Tarjeta "glass" reutilizable (borde sutil + fondo translúcido). Equivale a la
// clase `.glass` de la web. Acepta `style` para combinar/ajustar.

import { type PropsWithChildren } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useColors } from '../theme'

interface Props {
  style?: StyleProp<ViewStyle>
}

/** Tarjeta "glass" con borde sutil; equivalente a la clase `.glass` de la web. */
export function Card({ children, style }: PropsWithChildren<Props>) {
  const colors = useColors()
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderWidth: 1,
          borderRadius: 24,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
