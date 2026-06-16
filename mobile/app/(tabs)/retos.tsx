// Pantalla de Retos. Porta RetosPage: lista con estado "usado", alta/edición en
// modal y confirmación de borrado. Validación local + mensajes del repositorio.

import { useEffect, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import type { Challenge, Collection } from '@retobox/shared'
import { useStore } from '../../src/store'
import { useResponsive } from '../../src/lib/responsive'
import { useT } from '../../src/lib/useT'
import { NEON_GRADIENT, useColors } from '../../src/theme'
import { LinearGradient } from 'expo-linear-gradient'
import { Card } from '../../src/ui/Card'
import { AppModal } from '../../src/ui/AppModal'
import { GradientButton } from '../../src/ui/GradientButton'
import { Screen } from '../../src/ui/Screen'
import { ChevronIcon, CollectionIcon, EditIcon, PlusIcon, TrashIcon } from '../../src/ui/icons'

export default function RetosScreen() {
  const colors = useColors()
  const t = useT()
  const { isTablet, challengeColumns, maxContentWidth } = useResponsive()
  const { challenges, addChallenge, editChallenge, removeChallenge } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Challenge | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Challenge | null>(null)

  const used = challenges.filter((challenge) => challenge.is_used).length

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(challenge: Challenge) {
    setEditing(challenge)
    setFormOpen(true)
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
          <Text style={[styles.title, { color: colors.text }]}>{t('retos.title')}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {t('retos.subtitle', { count: challenges.length, used })}
          </Text>
        </View>
        <GradientButton label={t('common.add')} onPress={openNew} icon={<PlusIcon size={18} color="#fff" />} />
      </View>

      <CollectionSelector />

      <FlatList
        key={challengeColumns}
        data={challenges}
        keyExtractor={(item) => String(item.id)}
        numColumns={challengeColumns}
        columnWrapperStyle={challengeColumns > 1 ? styles.columnWrap : undefined}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Card style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              {t('retos.empty')}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={[challengeColumns > 1 && styles.gridItem, item.is_used && styles.usedCard]}>
            <View style={styles.cardTop}>
              <View style={styles.flex1}>
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.repeatable && (
                    <View style={styles.repeatBadge}>
                      <Text style={[styles.repeatBadgeText, { color: colors.accentPurple }]}>
                        {t('retos.repeatable')}
                      </Text>
                    </View>
                  )}
                  {item.is_used && !item.repeatable && (
                    <View style={styles.usedBadge}>
                      <Text style={styles.usedBadgeText}>{t('retos.used')}</Text>
                    </View>
                  )}
                </View>
                {item.description ? (
                  <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.playersBadge, { backgroundColor: 'rgba(168,85,247,0.2)' }]}>
                <Text style={{ color: colors.accentPurple, fontWeight: '800', fontSize: 12 }}>
                  👥 {item.required_users}
                  {item.involved_users != null ? (
                    <Text style={{ color: colors.accentPurple, opacity: 0.7 }}>
                      {' '}/ {item.involved_users}
                    </Text>
                  ) : null}
                </Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => openEdit(item)}
                style={[styles.iconBtn, { backgroundColor: colors.card }]}
              >
                <EditIcon size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setConfirmDelete(item)}
                style={[styles.iconBtn, { backgroundColor: colors.dangerBg }]}
              >
                <TrashIcon size={18} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        )}
      />
      </View>

      <ChallengeForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (data) => {
          if (editing) {
            await editChallenge(editing.id, data)
          } else {
            await addChallenge(data)
          }
          setFormOpen(false)
        }}
      />

      <AppModal open={!!confirmDelete} title={t('retos.delTitle')} onClose={() => setConfirmDelete(null)}>
        <Text style={{ color: colors.textMuted }}>
          {t('retos.delConfirm', { name: confirmDelete?.title ?? '' })}
        </Text>
        <View style={styles.modalActions}>
          <GhostButton label={t('common.cancel')} onPress={() => setConfirmDelete(null)} />
          <GradientButton
            label={t('common.delete')}
            onPress={async () => {
              if (confirmDelete) {
                await removeChallenge(confirmDelete.id)
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

// Selector de colección: cambia la activa y permite crear/renombrar/borrar.
function CollectionSelector() {
  const colors = useColors()
  const t = useT()
  const {
    collections,
    activeCollectionId,
    setActiveCollection,
    addCollection,
    editCollection,
    removeCollection,
  } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<
    null | { mode: 'new' | 'rename'; id?: number; name: string }
  >(null)
  const [confirmDel, setConfirmDel] = useState<Collection | null>(null)
  const [saving, setSaving] = useState(false)

  const active = collections.find((c) => c.id === activeCollectionId) ?? null

  async function submitForm() {
    if (!form || !form.name.trim()) {
      return
    }
    setSaving(true)
    try {
      if (form.mode === 'new') {
        await addCollection({ name: form.name.trim() })
      } else if (form.id != null) {
        await editCollection(form.id, { name: form.name.trim() })
      }
      setForm(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.collPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      >
        <CollectionIcon size={20} color={colors.accentPurple} />
        <View style={styles.flex1}>
          <Text style={[styles.collKicker, { color: colors.textFaint }]}>{t('col.label')}</Text>
          <Text style={[styles.collName, { color: colors.text }]} numberOfLines={1}>
            {active?.name ?? '—'}
          </Text>
        </View>
        <ChevronIcon size={16} color={colors.textMuted} />
      </Pressable>

      <AppModal open={open} title={t('col.title')} onClose={() => setOpen(false)}>
        <ScrollView style={styles.collList} contentContainerStyle={styles.collListContent}>
          {collections.map((c) => {
            const isActive = c.id === activeCollectionId
            return (
              <View key={c.id} style={styles.collRow}>
                <Pressable
                  style={styles.flex1}
                  onPress={() => {
                    void setActiveCollection(c.id)
                    setOpen(false)
                  }}
                >
                  {isActive ? (
                    <LinearGradient colors={NEON_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.collItem}>
                      <Text style={styles.collItemActive} numberOfLines={1}>{c.name}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.collItem, { backgroundColor: colors.card }]}>
                      <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{c.name}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setForm({ mode: 'rename', id: c.id, name: c.name })}
                  style={[styles.iconBtn, { backgroundColor: colors.card }]}
                >
                  <EditIcon size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDel(c)}
                  disabled={collections.length <= 1}
                  style={[styles.iconBtn, { backgroundColor: colors.dangerBg, opacity: collections.length <= 1 ? 0.3 : 1 }]}
                >
                  <TrashIcon size={16} color={colors.danger} />
                </Pressable>
              </View>
            )
          })}
        </ScrollView>
        <Pressable onPress={() => setForm({ mode: 'new', name: '' })} style={styles.newColl}>
          <PlusIcon size={16} color={colors.accentPurple} />
          <Text style={{ color: colors.accentPurple, fontWeight: '700' }}>{t('col.new')}</Text>
        </Pressable>
      </AppModal>

      <AppModal
        open={!!form}
        title={form?.mode === 'rename' ? t('col.rename') : t('col.new')}
        onClose={() => setForm(null)}
      >
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
          value={form?.name ?? ''}
          onChangeText={(text) => setForm((f) => (f ? { ...f, name: text } : f))}
          placeholder={t('col.namePh')}
          placeholderTextColor={colors.textFaint}
          autoFocus
        />
        <View style={styles.modalActions}>
          <GhostButton label={t('common.cancel')} onPress={() => setForm(null)} />
          <GradientButton
            label={saving ? t('common.saving') : form?.mode === 'rename' ? t('common.save') : t('common.create')}
            onPress={submitForm}
            disabled={saving}
            style={styles.flex1}
          />
        </View>
      </AppModal>

      <AppModal open={!!confirmDel} title={t('col.delTitle')} onClose={() => setConfirmDel(null)}>
        <Text style={{ color: colors.textMuted }}>
          {t('col.delConfirm', { name: confirmDel?.name ?? '' })}
        </Text>
        <View style={styles.modalActions}>
          <GhostButton label={t('common.cancel')} onPress={() => setConfirmDel(null)} />
          <GradientButton
            label={t('common.delete')}
            onPress={async () => {
              if (confirmDel) {
                await removeCollection(confirmDel.id)
              }
              setConfirmDel(null)
            }}
            style={styles.flex1}
          />
        </View>
      </AppModal>
    </>
  )
}

function ChallengeForm({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean
  editing: Challenge | null
  onClose: () => void
  onSubmit: (data: {
    title: string
    description: string
    required_users: number
    involved_users: number | null
    repeatable: boolean
  }) => Promise<void>
}) {
  const colors = useColors()
  const t = useT()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [players, setPlayers] = useState('1')
  // Campo opcional: se guarda como texto para poder dejarlo vacío.
  const [involved, setInvolved] = useState('')
  const [repeatable, setRepeatable] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setDescription(editing?.description ?? '')
      setPlayers(String(editing?.required_users ?? 1))
      setInvolved(editing?.involved_users != null ? String(editing.involved_users) : '')
      setRepeatable(editing?.repeatable ?? false)
      setError('')
    }
  }, [open, editing])

  async function handleSubmit() {
    const parsedPlayers = Math.max(1, parseInt(players || '1', 10))
    if (!title.trim()) {
      setError(t('retos.form.errTitle'))
      return
    }
    const involvedTrimmed = involved.trim()
    const involvedValue = involvedTrimmed === '' ? null : parseInt(involvedTrimmed, 10)
    if (involvedValue != null && (Number.isNaN(involvedValue) || involvedValue < parsedPlayers)) {
      setError(t('retos.form.errInvolved'))
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        required_users: parsedPlayers,
        involved_users: involvedValue,
        repeatable,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('retos.form.errSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal open={open} title={editing ? t('retos.edit') : t('retos.new')} onClose={onClose}>
      <Field label={t('retos.form.title')}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
          value={title}
          onChangeText={setTitle}
          placeholder={t('retos.form.titlePh')}
          placeholderTextColor={colors.textFaint}
        />
      </Field>
      <Field label={t('retos.form.description')}>
        <TextInput
          style={[styles.input, styles.textarea, { color: colors.text, borderColor: colors.cardBorder }]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('retos.form.descriptionPh')}
          placeholderTextColor={colors.textFaint}
          multiline
        />
      </Field>
      <View style={styles.row2}>
        <View style={styles.flex1}>
          <Field label={t('retos.form.performers')}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
              value={players}
              onChangeText={setPlayers}
              keyboardType="number-pad"
            />
          </Field>
        </View>
        <View style={styles.flex1}>
          <Field label={t('retos.form.involved')}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
              value={involved}
              onChangeText={setInvolved}
              keyboardType="number-pad"
              placeholder={t('retos.form.optional')}
              placeholderTextColor={colors.textFaint}
            />
          </Field>
        </View>
      </View>
      <Text style={[styles.helper, { color: colors.textFaint }]}>
        {t('retos.form.note')}
      </Text>

      <Pressable
        onPress={() => setRepeatable((value) => !value)}
        style={[styles.repeatRow, { backgroundColor: colors.card }]}
      >
        <View style={styles.flex1}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t('retos.form.repeatable')}</Text>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
            {t('retos.form.repeatableHint')}
          </Text>
        </View>
        <Switch
          value={repeatable}
          onValueChange={setRepeatable}
          trackColor={{ false: colors.cardBorder, true: colors.accentPurple }}
        />
      </Pressable>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <View style={styles.modalActions}>
        <GhostButton label={t('common.cancel')} onPress={onClose} />
        <GradientButton
          label={saving ? t('common.saving') : editing ? t('common.save') : t('common.create')}
          onPress={handleSubmit}
          disabled={saving}
          style={styles.flex1}
        />
      </View>
    </AppModal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      {children}
    </View>
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
  collPill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  collKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  collName: { fontSize: 15, fontWeight: '700' },
  collList: { maxHeight: 300 },
  collListContent: { gap: 8 },
  collRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collItem: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  collItemActive: { color: '#fff', fontWeight: '800' },
  newColl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 8 },
  title: { fontSize: 24, fontWeight: '900' },
  sub: { fontSize: 13 },
  list: { gap: 12, paddingBottom: 120 },
  columnWrap: { gap: 12, alignItems: 'flex-start' },
  gridItem: { flex: 1 },
  empty: { alignItems: 'center', gap: 8, marginTop: 16 },
  emptyEmoji: { fontSize: 36 },
  usedCard: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  flex1: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontWeight: '800', flexShrink: 1 },
  cardDesc: { fontSize: 13, marginTop: 4 },
  usedBadge: { backgroundColor: 'rgba(244,63,94,0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  usedBadgeText: { color: '#fda4af', fontSize: 10, fontWeight: '700' },
  repeatBadge: { backgroundColor: 'rgba(168,85,247,0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  repeatBadgeText: { fontSize: 10, fontWeight: '700' },
  playersBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  helper: { fontSize: 12, marginTop: -4, marginBottom: 12, lineHeight: 16 },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  error: { fontSize: 13, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  ghost: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
})
