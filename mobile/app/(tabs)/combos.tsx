// Pantalla de Combos (mezclador). Porta CombosPage de la web: crear grupos de
// palabras, seleccionar cuáles entran y, al jugar, salen tantos rodillos como
// grupos activos con una combinación aleatoria. La combinación se calcula en el
// cliente; los grupos se persisten en SQLite vía el repositorio compartido.

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { WordGroup } from '@retobox/shared'
import { useStore } from '../../src/store'
import { useResponsive } from '../../src/lib/responsive'
import { useT } from '../../src/lib/useT'
import { NEON_GRADIENT, useColors } from '../../src/theme'
import { playReveal } from '../../src/lib/sound'
import { Card } from '../../src/ui/Card'
import { AppModal } from '../../src/ui/AppModal'
import { GradientButton } from '../../src/ui/GradientButton'
import { Screen } from '../../src/ui/Screen'
import { Confetti } from '../../src/components/Confetti'
import { WordReel } from '../../src/components/WordReel'
import { ChevronIcon, EditIcon, PlusIcon, TrashIcon } from '../../src/ui/icons'

interface ComboItem {
  id: number
  name: string
  words: string[]
  winner: string
}

export default function CombosScreen() {
  const colors = useColors()
  const t = useT()
  const { isTablet, maxContentWidth } = useResponsive()
  const {
    wordGroups,
    selectedGroupIds,
    addWordGroup,
    editWordGroup,
    removeWordGroup,
    toggleGroupSelection,
    soundEnabled,
  } = useStore()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WordGroup | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WordGroup | null>(null)
  const [combo, setCombo] = useState<{ spinId: number; items: ComboItem[] } | null>(null)
  const [groupsOpen, setGroupsOpen] = useState(true)

  // Grupos que entran en la tirada: seleccionados y con al menos una palabra.
  const activeGroups = useMemo(
    () => wordGroups.filter((g) => selectedGroupIds.includes(g.id) && g.words.length > 0),
    [wordGroups, selectedGroupIds],
  )
  const canSpin = activeGroups.length > 0

  function roll(spinId: number) {
    const items: ComboItem[] = activeGroups.map((g) => ({
      id: g.id,
      name: g.name,
      words: g.words,
      winner: g.words[Math.floor(Math.random() * g.words.length)] as string,
    }))
    setCombo({ spinId, items })
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }
  // Estables para que GroupCard (memo) no se repinte al pulsar ¡Jugar!.
  const openEdit = useCallback((group: WordGroup) => {
    setEditing(group)
    setFormOpen(true)
  }, [])

  return (
    <Screen style={styles.screen}>
      <View
        style={[
          styles.container,
          isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.flex1}>
            <Text style={[styles.title, { color: colors.text }]}>{t('combos.title')}</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              {t('combos.subtitle')}
            </Text>
          </View>
          <GradientButton label={t('combos.group')} onPress={openNew} icon={<PlusIcon size={18} color="#fff" />} />
        </View>

        {wordGroups.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎰</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              {t('combos.empty')}
            </Text>
          </Card>
        ) : (
          <>
            <Card style={[styles.panel, groupsOpen && styles.panelOpen]}>
              <Pressable
                style={({ pressed }) => [styles.panelHeader, pressed && { opacity: 0.6 }]}
                onPress={() => setGroupsOpen((o) => !o)}
                hitSlop={10}
                android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
              >
                <Text style={[styles.panelTitle, { color: colors.textMuted }]}>
                  {t('combos.groupsCount', { n: wordGroups.length })}
                  {activeGroups.length > 0 ? t('combos.activeCount', { n: activeGroups.length }) : ''}
                </Text>
                <ChevronIcon size={16} color={colors.textMuted} rotated={groupsOpen} />
              </Pressable>
              {groupsOpen && (
                <ScrollView style={styles.panelList} contentContainerStyle={styles.panelListContent}>
                  {wordGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      selected={selectedGroupIds.includes(group.id)}
                      onToggle={toggleGroupSelection}
                      onEdit={openEdit}
                      onDelete={setConfirmDelete}
                    />
                  ))}
                </ScrollView>
              )}
            </Card>

            <View style={styles.playArea}>
              <Pressable
                onPress={() => roll(nextSpinId())}
                disabled={!canSpin}
                hitSlop={16}
                style={({ pressed }) => [
                  styles.playOuter,
                  {
                    shadowColor: colors.primary,
                    opacity: !canSpin ? 0.5 : pressed ? 0.85 : 1,
                    transform: [{ scale: pressed && canSpin ? 0.94 : 1 }],
                  },
                ]}
              >
                <LinearGradient
                  colors={NEON_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playInner}
                >
                  <Text style={styles.playLabel}>{t('combos.play')}</Text>
                </LinearGradient>
              </Pressable>
              <Text style={[styles.hint, { color: colors.textFaint }]}>
                {canSpin
                  ? t('combos.willRoll', {
                      n: activeGroups.length,
                      reels: activeGroups.length === 1 ? t('combos.reel') : t('combos.reels'),
                    })
                  : t('combos.needGroup')}
              </Text>
            </View>
          </>
        )}
      </View>

      <GroupForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (data) => {
          if (editing) {
            await editWordGroup(editing.id, data)
          } else {
            await addWordGroup(data)
          }
          setFormOpen(false)
        }}
      />

      <AppModal open={!!confirmDelete} title={t('combos.delTitle')} onClose={() => setConfirmDelete(null)}>
        <Text style={{ color: colors.textMuted }}>
          {t('combos.delConfirm', { name: confirmDelete?.name ?? '' })}
        </Text>
        <View style={styles.modalActions}>
          <GhostButton label={t('common.cancel')} onPress={() => setConfirmDelete(null)} />
          <GradientButton
            label={t('common.delete')}
            onPress={async () => {
              if (confirmDelete) {
                await removeWordGroup(confirmDelete.id)
              }
              setConfirmDelete(null)
            }}
            style={styles.flex1}
          />
        </View>
      </AppModal>

      {combo && (
        <ComboReveal
          items={combo.items}
          spinId={combo.spinId}
          soundEnabled={soundEnabled}
          onAgain={() => roll(combo.spinId + 1)}
          onClose={() => setCombo(null)}
        />
      )}
    </Screen>
  )
}

// Contador monótono para identificar cada tirada (evita Date.now en este punto).
let spinCounter = 1
function nextSpinId(): number {
  spinCounter += 1
  return spinCounter
}

// ---------------------------------------------------------------------------
// Tarjeta de grupo (seleccionable + desplegable)
// ---------------------------------------------------------------------------

const GroupCard = memo(function GroupCard({
  group,
  selected,
  onToggle,
  onEdit,
  onDelete,
}: {
  group: WordGroup
  selected: boolean
  onToggle: (id: number) => void
  onEdit: (group: WordGroup) => void
  onDelete: (group: WordGroup) => void
}) {
  const colors = useColors()
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const empty = group.words.length === 0
  const active = selected && !empty

  return (
    <Card
      style={[
        styles.groupCard,
        active && { borderColor: colors.primary, borderWidth: 2 },
        empty && { opacity: 0.7 },
      ]}
    >
      <View style={styles.groupHeader}>
        <Pressable
          onPress={() => onToggle(group.id)}
          disabled={empty}
          hitSlop={12}
          style={[
            styles.checkbox,
            active
              ? { borderColor: 'transparent' }
              : { borderColor: colors.cardBorderStrong },
          ]}
        >
          {active ? (
            <View style={styles.checkboxOn}>
              <Text style={styles.checkboxMark}>✓</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.groupHeaderMain, pressed && { opacity: 0.6 }]}
          onPress={() => setExpanded((e) => !e)}
          hitSlop={8}
          android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
        >
          <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={[styles.groupCount, { color: colors.textFaint }]}>
            {group.words.length}
          </Text>
          <ChevronIcon size={16} color={colors.textMuted} rotated={expanded} />
        </Pressable>
      </View>

      {expanded && (
        <View style={styles.groupBody}>
          {empty ? (
            <Text style={{ color: colors.textFaint, fontSize: 13 }}>
              {t('combos.noWords')}
            </Text>
          ) : (
            <View style={styles.chips}>
              {group.words.map((word, index) => (
                <View key={index} style={[styles.chip, { backgroundColor: colors.card }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{word}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.groupActions}>
            <Pressable onPress={() => onEdit(group)} style={[styles.iconBtn, { backgroundColor: colors.card }]}>
              <EditIcon size={16} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => onDelete(group)} style={[styles.iconBtn, { backgroundColor: colors.dangerBg }]}>
              <TrashIcon size={16} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  )
})

// ---------------------------------------------------------------------------
// Overlay de tirada (N rodillos)
// ---------------------------------------------------------------------------

function ComboReveal({
  items,
  spinId,
  soundEnabled,
  onAgain,
  onClose,
}: {
  items: ComboItem[]
  spinId: number
  soundEnabled: boolean
  onAgain: () => void
  onClose: () => void
}) {
  const colors = useColors()
  const t = useT()
  const [settled, setSettled] = useState(0)
  const done = items.length > 0 && settled >= items.length

  useEffect(() => setSettled(0), [spinId])

  // Un único sonido al asentarse todos los rodillos.
  useEffect(() => {
    if (done && soundEnabled) {
      playReveal()
    }
  }, [done, soundEnabled])

  // Capa absoluta (no Modal nativo): aparece de inmediato al pulsar ¡Jugar! y
  // los rodillos arrancan acto seguido, sin la latencia de crear una ventana.
  return (
    <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.bgTint, borderColor: colors.cardBorderStrong, shadowColor: colors.primary },
        ]}
      >
        <Text style={[styles.kicker, { color: colors.textMuted }]}>{t('combos.combination')}</Text>
        <ScrollView contentContainerStyle={styles.reels}>
          {items.map((item, index) => (
            <WordReel
              key={`${spinId}-${item.id}`}
              label={item.name}
              winner={item.winner}
              words={item.words}
              delay={index * 120}
              onSettled={() => setSettled((s) => s + 1)}
            />
          ))}
        </ScrollView>
        <View style={[styles.modalActions, { opacity: done ? 1 : 0.5 }]}>
          <GhostButton label={t('common.close')} onPress={onClose} />
          <GradientButton label={t('common.again')} onPress={onAgain} style={styles.flex1} />
        </View>
      </View>
      {done && <Confetti />}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Formulario crear/editar grupo
// ---------------------------------------------------------------------------

function GroupForm({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean
  editing: WordGroup | null
  onClose: () => void
  onSubmit: (data: { name: string; words: string[] }) => Promise<void>
}) {
  const colors = useColors()
  const t = useT()
  const [name, setName] = useState('')
  const [wordsText, setWordsText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setWordsText(editing?.words.join('\n') ?? '')
      setError('')
    }
  }, [open, editing])

  const parsedWords = wordsText
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)

  async function handleSubmit() {
    if (!name.trim()) {
      setError(t('retos.form.errTitle'))
      return
    }
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), words: parsedWords })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('retos.form.errSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal open={open} title={editing ? t('combos.editGroup') : t('combos.newGroup')} onClose={onClose}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('combos.groupName')}</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
        value={name}
        onChangeText={setName}
        placeholder={t('combos.groupNamePh')}
        placeholderTextColor={colors.textFaint}
      />
      <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>
        {t('combos.words', { n: parsedWords.length })}
      </Text>
      <TextInput
        style={[styles.input, styles.textarea, { color: colors.text, borderColor: colors.cardBorder }]}
        value={wordsText}
        onChangeText={setWordsText}
        placeholder={t('combos.wordsPh')}
        placeholderTextColor={colors.textFaint}
        multiline
      />
      <Text style={[styles.helper, { color: colors.textFaint }]}>
        {t('combos.wordsNote')}
      </Text>
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
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900' },
  sub: { fontSize: 13 },
  empty: { alignItems: 'center', gap: 8, marginTop: 16 },
  emptyEmoji: { fontSize: 36 },
  panel: {},
  panelOpen: { maxHeight: '52%' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  panelTitle: { fontSize: 13, fontWeight: '700' },
  panelList: { flexGrow: 0, marginTop: 8 },
  panelListContent: { gap: 8, paddingBottom: 4 },
  groupCard: { padding: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupHeaderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  checkboxOn: { ...StyleSheet.absoluteFillObject, backgroundColor: '#a855f7', alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  groupName: { flex: 1, fontWeight: '800', fontSize: 15 },
  groupCount: { fontSize: 12, fontWeight: '700' },
  groupBody: { marginTop: 12, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  groupActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  playArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 110 },
  playOuter: {
    borderRadius: 999,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  playInner: { borderRadius: 999, paddingHorizontal: 52, paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  playLabel: { color: '#fff', fontSize: 22, fontWeight: '900' },
  hint: { fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },
  // Overlay (capa absoluta, no Modal nativo)
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 100,
    elevation: 100,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    borderRadius: 32,
    borderWidth: 1,
    padding: 20,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginBottom: 16 },
  reels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingVertical: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  ghost: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  textarea: { minHeight: 150, textAlignVertical: 'top' },
  helper: { fontSize: 12, marginTop: 6 },
  error: { fontSize: 13, marginTop: 8 },
})
