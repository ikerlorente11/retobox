// Navegación por pestañas con la tab bar personalizada (AppTabBar), que replica
// la navbar de la web (pastilla flotante + gradiente neón + iconos SVG).

import { Tabs } from 'expo-router'
import { AppTabBar } from '../../src/components/AppTabBar'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Sorteo' }} />
      <Tabs.Screen name="retos" options={{ title: 'Retos' }} />
      <Tabs.Screen name="usuarios" options={{ title: 'Usuarios' }} />
      <Tabs.Screen name="combos" options={{ title: 'Combos' }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
    </Tabs>
  )
}
