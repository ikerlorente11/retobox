// Texto con gradiente neón (morado→rosa→cian), equivalente a `.gradient-text` de
// la web. Usa MaskedView: el texto recorta un LinearGradient.

import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, type TextStyle } from 'react-native'
import { NEON_GRADIENT } from '../theme'

interface Props {
  children: string
  style?: TextStyle
  numberOfLines?: number
}

export function GradientText({ children, style, numberOfLines }: Props) {
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]} numberOfLines={numberOfLines}>
          {children}
        </Text>
      }
    >
      <LinearGradient colors={NEON_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        {/* Texto invisible que define el tamaño del gradiente */}
        <Text style={[style, { opacity: 0 }]} numberOfLines={numberOfLines}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  )
}
