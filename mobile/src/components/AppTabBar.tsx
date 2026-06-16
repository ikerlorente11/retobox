// Tab bar personalizada que replica la TabBar de la web: barra flotante "glass"
// redondeada, con la pestaña activa resaltada por un gradiente neón, iconos SVG
// idénticos y etiquetas. Respeta la zona segura inferior.

import { type ReactElement } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { NEON_GRADIENT, useColors } from '../theme'
import { useT } from '../lib/useT'
import { DiceIcon, ListIcon, SettingsIcon, ShuffleIcon, UsersIcon, type IconProps } from '../ui/icons'

type IconComponent = (props: IconProps) => ReactElement

const ICONS: Record<string, { labelKey: string; Icon: IconComponent }> = {
  index: { labelKey: 'tab.sorteo', Icon: DiceIcon },
  retos: { labelKey: 'tab.retos', Icon: ListIcon },
  usuarios: { labelKey: 'tab.usuarios', Icon: UsersIcon },
  combos: { labelKey: 'tab.combos', Icon: ShuffleIcon },
  ajustes: { labelKey: 'tab.ajustes', Icon: SettingsIcon },
}

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const t = useT()

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          { backgroundColor: colors.navBar, borderColor: colors.cardBorderStrong, shadowColor: colors.primary },
        ]}
      >
        {state.routes.map((route, index) => {
          const meta = ICONS[route.name]
          if (!meta) {
            return null
          }
          const isActive = state.index === index
          const tint = isActive ? '#ffffff' : colors.textMuted
          const { Icon, labelKey } = meta
          const label = t(labelKey)

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!isActive && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
              style={styles.tab}
            >
              {isActive && (
                <LinearGradient
                  colors={NEON_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pill}
                />
              )}
              <Icon size={22} color={tint} />
              <Text style={[styles.label, { color: tint }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: 26,
    padding: 6,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 18,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    opacity: 0.9,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
})
