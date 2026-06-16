// Layout raíz: inicializa la BD/estado (bootstrap), muestra carga/error y
// monta el stack de navegación. La barra de estado se adapta al tema.

import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Stack } from 'expo-router'
import { useStore } from '../src/store'
import { useColors } from '../src/theme'
import { initSound } from '../src/lib/sound'
import { useT } from '../src/lib/useT'
import { GradientButton } from '../src/ui/GradientButton'

export default function RootLayout() {
  const colors = useColors()
  const theme = useStore((state) => state.theme)
  const loading = useStore((state) => state.loading)
  const loadError = useStore((state) => state.loadError)
  const bootstrap = useStore((state) => state.bootstrap)
  const t = useT()

  useEffect(() => {
    void bootstrap()
    void initSound()
  }, [bootstrap])

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
        <View style={[styles.fill, { backgroundColor: colors.bg }]}>
          {loading ? (
            <View style={styles.center}>
              <Text style={styles.dice}>🎲</Text>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.center}>
              <Text style={styles.warn}>⚠️</Text>
              <Text style={[styles.errTitle, { color: colors.text }]}>{t('app.loadErrorTitle')}</Text>
              <Text style={[styles.errMsg, { color: colors.textMuted }]}>{loadError}</Text>
              <GradientButton label={t('common.retry')} onPress={() => void bootstrap()} />
            </View>
          ) : (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  dice: { fontSize: 48 },
  warn: { fontSize: 40 },
  errTitle: { fontSize: 18, fontWeight: '800' },
  errMsg: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
})
