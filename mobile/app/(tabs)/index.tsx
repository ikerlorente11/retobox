// Pantalla de Sorteo. Replica SorteoPage de la web: título con gradiente, contador
// en pastilla, selector de modo con pastilla neón, chips de usuarios, botón circular
// "¡Tirar!" con gradiente y glow, avisos 400/409 y overlay de revelado.

import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useStore } from '../../src/store'
import { useResponsive } from '../../src/lib/responsive'
import { useT } from '../../src/lib/useT'
import { translateApiError } from '../../src/lib/i18n'
import { NEON_GRADIENT, useColors } from '../../src/theme'
import { GradientButton } from '../../src/ui/GradientButton'
import { GradientText } from '../../src/ui/GradientText'
import { Avatar } from '../../src/ui/Avatar'
import { Card } from '../../src/ui/Card'
import { Screen } from '../../src/ui/Screen'
import { CollectionIcon } from '../../src/ui/icons'
import { RevealOverlay } from '../../src/components/RevealOverlay'

export default function SorteoScreen() {
  const colors = useColors()
  const { isTablet, maxContentWidth } = useResponsive()
  const t = useT()
  const router = useRouter()
  const lang = useStore((state) => state.lang)
  const {
    mode,
    setMode,
    users,
    challenges,
    collections,
    activeCollectionId,
    selectedUserIds,
    toggleUserSelection,
    drawing,
    doDraw,
    result,
    drawError,
    clearResult,
    stats,
    resetSession,
  } = useStore()

  const [resetting, setResetting] = useState(false)

  const decoyTitles = useMemo(
    () => challenges.map((challenge) => challenge.title).slice(0, 30),
    [challenges],
  )

  const available = stats?.available ?? 0
  const total = stats?.total ?? challenges.length
  const noUsers = users.length === 0
  const activeCollection = collections.find((c) => c.id === activeCollectionId) ?? null
  const isOutOfCards = drawError?.status === 409

  async function handleReset() {
    setResetting(true)
    try {
      await resetSession()
    } finally {
      setResetting(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.inner,
            isTablet && { maxWidth: maxContentWidth, flex: 1 },
          ]}
        >
        <View style={styles.brandRow}>
          <GradientText style={styles.brand}>Reto</GradientText>
          <Text style={[styles.brand, { color: colors.text }]}>Box</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('sorteo.subtitle')}
        </Text>

        {activeCollection && (
          <View style={styles.collRow}>
            <CollectionIcon size={16} color={colors.accentPurple} />
            <Text style={[styles.collName, { color: colors.text }]}>{activeCollection.name}</Text>
          </View>
        )}

        <View style={[styles.counter, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <GradientText style={styles.counterValue}>{String(available)}</GradientText>
          <Text style={[styles.counterLabel, { color: colors.textMuted }]}>
            {t('sorteo.remaining', { total })}
          </Text>
        </View>

        {!noUsers && (
          <View style={[styles.modeRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <ModeButton active={mode === 'random'} label={t('sorteo.modeRandom')} onPress={() => setMode('random')} />
            <ModeButton
              active={mode === 'selected'}
              label={t('sorteo.modeSelected')}
              onPress={() => setMode('selected')}
            />
          </View>
        )}

        {!noUsers && mode === 'selected' && (
          <View style={styles.chips}>
            {users.map((user) => {
              const selected = selectedUserIds.includes(user.id)
              return (
                <Pressable
                  key={user.id}
                  onPress={() => toggleUserSelection(user.id)}
                  style={styles.chipWrap}
                >
                  {selected ? (
                    <LinearGradient
                      colors={NEON_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.chip}
                    >
                      <Avatar user={user} size="sm" />
                      <Text style={styles.chipTextActive}>{user.name}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
                      <Avatar user={user} size="sm" />
                      <Text style={{ color: colors.textMuted }}>{user.name}</Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        )}

        <View style={[styles.action, isTablet && styles.actionTablet]}>
        <Pressable
          onPress={() => void doDraw()}
          disabled={drawing || isOutOfCards}
          style={({ pressed }) => [styles.throwOuter, { shadowColor: colors.primary, opacity: drawing || isOutOfCards ? 0.6 : pressed ? 0.92 : 1 }]}
        >
          <LinearGradient
            colors={NEON_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.throwCircle, isTablet && styles.throwCircleTablet]}
          >
            {drawing ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <>
                <Text style={styles.throwDice}>🎲</Text>
                <Text style={styles.throwLabel}>{t('sorteo.tirar')}</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={[styles.hint, { color: colors.textFaint }]}>
          {noUsers
            ? t('sorteo.hintNoUsers')
            : mode === 'selected'
              ? t('sorteo.hintSelected')
              : t('sorteo.hintRandom')}
        </Text>

        {drawError?.status === 400 && (
          <View style={[styles.warnBox, { borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.1)' }]}>
            <Text style={{ color: '#fcd34d' }}>{translateApiError(drawError.detail, lang)}</Text>
          </View>
        )}

        {isOutOfCards && (
          <Card style={styles.outBox}>
            <Text style={styles.outEmoji}>🪫</Text>
            <Text style={[styles.outTitle, { color: colors.text }]}>{t('sorteo.outTitle')}</Text>
            <Text style={[styles.outMsg, { color: colors.textMuted }]}>
              {t('sorteo.outBody')}
            </Text>
            <GradientButton
              label={resetting ? t('sorteo.resetting') : t('sorteo.resetSession')}
              onPress={handleReset}
              disabled={resetting}
              style={styles.fullWidth}
            />
          </Card>
        )}
        </View>
        </View>
      </ScrollView>

      {result && (
        <RevealOverlay
          result={result}
          decoyTitles={decoyTitles}
          noUsers={noUsers}
          onClose={clearResult}
          onAgain={() => {
            clearResult()
            void doDraw()
          }}
          onManageUsers={() => {
            clearResult()
            router.push('/usuarios')
          }}
        />
      )}
    </Screen>
  )
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  const colors = useColors()
  return (
    <Pressable onPress={onPress} style={styles.modeBtnWrap}>
      {active ? (
        <LinearGradient
          colors={NEON_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modeBtn}
        >
          <Text style={styles.modeTextActive}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.modeBtn}>
          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  inner: { width: '100%', alignItems: 'center', gap: 18 },
  action: { width: '100%', alignItems: 'center', gap: 18 },
  actionTablet: { flex: 1, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  brand: { fontSize: 38, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 14 },
  collRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collName: { fontSize: 14, fontWeight: '700' },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  counterValue: { fontSize: 22, fontWeight: '900' },
  counterLabel: { fontSize: 14 },
  modeRow: { flexDirection: 'row', gap: 4, borderWidth: 1, borderRadius: 16, padding: 4, width: '100%' },
  modeBtnWrap: { flex: 1 },
  modeBtn: { borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  modeTextActive: { color: '#fff', fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chipWrap: { borderRadius: 999, overflow: 'hidden' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  throwOuter: {
    borderRadius: 999,
    marginTop: 6,
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  throwCircle: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  throwCircleTablet: { width: 220, height: 220, borderRadius: 110 },
  throwDice: { fontSize: 40 },
  throwLabel: { color: '#fff', fontSize: 22, fontWeight: '900' },
  hint: { fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
  warnBox: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, width: '100%' },
  outBox: { width: '100%', alignItems: 'center', gap: 10 },
  outEmoji: { fontSize: 44 },
  outTitle: { fontSize: 18, fontWeight: '800' },
  outMsg: { fontSize: 14, textAlign: 'center' },
  fullWidth: { width: '100%' },
})
