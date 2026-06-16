// Pantalla de Usuarios. Porta UsuariosPage: lista con avatar, alta con selector
// de color y confirmación de borrado.

import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { User } from '@retobox/shared'
import { useStore } from '../../src/store'
import { useResponsive } from '../../src/lib/responsive'
import { useT } from '../../src/lib/useT'
import { USER_COLORS, useColors } from '../../src/theme'
import { Avatar } from '../../src/ui/Avatar'
import { Card } from '../../src/ui/Card'
import { AppModal } from '../../src/ui/AppModal'
import { GradientButton } from '../../src/ui/GradientButton'
import { Screen } from '../../src/ui/Screen'
import { PlusIcon, TrashIcon } from '../../src/ui/icons'

export default function UsuariosScreen() {
  const colors = useColors()
  const t = useT()
  const { isTablet, userColumns, maxContentWidth } = useResponsive()
  const { users, addUser, removeUser } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(USER_COLORS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

  function openNew() {
    setName('')
    setColor(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]!)
    setError('')
    setOpen(true)
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError(t('users.errName'))
      return
    }
    setSaving(true)
    try {
      await addUser({ name: name.trim(), color })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('retos.form.errSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen style={styles.screen}>
      <View
        style={[
          styles.container,
          isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{t('users.title')}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>{t('users.subtitle', { count: users.length })}</Text>
        </View>
        <GradientButton label={t('common.add')} onPress={openNew} icon={<PlusIcon size={18} color="#fff" />} />
      </View>

      <FlatList
        key={userColumns}
        data={users}
        keyExtractor={(item) => String(item.id)}
        numColumns={userColumns}
        columnWrapperStyle={userColumns > 1 ? styles.columnWrap : undefined}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Card style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧑‍🤝‍🧑</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              {t('users.empty')}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={[styles.userRow, userColumns > 1 && styles.gridItem]}>
            <Avatar user={item} size="md" />
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Pressable
              onPress={() => setConfirmDelete(item)}
              style={[styles.iconBtn, { backgroundColor: colors.dangerBg }]}
            >
              <TrashIcon size={18} color={colors.danger} />
            </Pressable>
          </Card>
        )}
      />
      </View>

      <AppModal open={open} title={t('users.new')} onClose={() => setOpen(false)}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('users.name')}</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
          value={name}
          onChangeText={setName}
          placeholder={t('users.namePh')}
          placeholderTextColor={colors.textFaint}
        />
        <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>{t('users.color')}</Text>
        <View style={styles.colorGrid}>
          {USER_COLORS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setColor(option)}
              style={[
                styles.colorDot,
                { backgroundColor: option, borderColor: color === option ? colors.text : 'transparent' },
              ]}
            />
          ))}
        </View>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <View style={styles.modalActions}>
          <GhostButton label={t('common.cancel')} onPress={() => setOpen(false)} />
          <GradientButton
            label={saving ? t('common.saving') : t('common.create')}
            onPress={handleSubmit}
            disabled={saving}
            style={styles.flex1}
          />
        </View>
      </AppModal>

      <AppModal open={!!confirmDelete} title={t('users.delTitle')} onClose={() => setConfirmDelete(null)}>
        <Text style={{ color: colors.textMuted }}>
          {t('users.delConfirm', { name: confirmDelete?.name ?? '' })}
        </Text>
        <View style={styles.modalActions}>
          <GhostButton label={t('common.cancel')} onPress={() => setConfirmDelete(null)} />
          <GradientButton
            label={t('common.delete')}
            onPress={async () => {
              if (confirmDelete) {
                await removeUser(confirmDelete.id)
              }
              setConfirmDelete(null)
            }}
            style={styles.flex1}
          />
        </View>
      </AppModal>
    </Screen>
  )
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors()
  return (
    <Pressable onPress={onPress} style={[styles.ghost, { borderColor: colors.cardBorder }]}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 8 },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900' },
  sub: { fontSize: 13 },
  list: { gap: 12, paddingBottom: 120 },
  columnWrap: { gap: 12, alignItems: 'flex-start' },
  gridItem: { flex: 1 },
  empty: { alignItems: 'center', gap: 8, marginTop: 16 },
  emptyEmoji: { fontSize: 36 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userName: { flex: 1, fontWeight: '700' },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
  error: { fontSize: 13, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  flex1: { flex: 1 },
  ghost: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
})
