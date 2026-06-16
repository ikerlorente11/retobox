// Contenedor de pantalla que respeta la zona segura superior (barra de estado:
// hora, batería, notch). El padding del inset va en una vista EXTERNA para que el
// `style` de la pantalla no pueda sobrescribirlo. Deja libre el borde inferior
// para que el contenido pase por detrás de la tab bar flotante.

import { type PropsWithChildren } from 'react'
import { View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../theme'

interface Props {
  style?: ViewStyle
}

export function Screen({ children, style }: PropsWithChildren<Props>) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </View>
  )
}
