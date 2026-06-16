// Modal centrado reutilizable (título + contenido) con fondo difuminado y cierre
// al tocar fuera. Equivale al `Modal` de la web.

import { type PropsWithChildren } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useColors } from '../theme'

interface Props {
  open: boolean
  title: string
  onClose: () => void
}

/** Modal centrado con fondo difuminado; equivalente al `Modal` de la web. */
export function AppModal({ open, title, onClose, children }: PropsWithChildren<Props>) {
  const colors = useColors()
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.cardBorder }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
})
