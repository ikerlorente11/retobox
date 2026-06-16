// Botón principal con relleno de gradiente neón, icono opcional y estado de
// carga. Equivale al `.btn-primary` de la web.

import { LinearGradient } from 'expo-linear-gradient'
import { type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { NEON_GRADIENT } from '../theme'

interface Props {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  style?: ViewStyle
}

export function GradientButton({ label, onPress, disabled, loading, icon, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { opacity: disabled ? 0.6 : pressed ? 0.85 : 1, borderRadius: 16 },
        style,
      ]}
    >
      <LinearGradient
        colors={NEON_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text style={styles.label}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
})
