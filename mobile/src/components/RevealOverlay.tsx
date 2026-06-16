// Overlay de revelado tipo TRAGAPERRAS: un rodillo vertical que pasa títulos,
// desacelera y aterriza en el reto elegido (portado de SlotMachine.tsx de la web
// con la API Animated). Al asentarse muestra el detalle completo del reto y confeti.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { DrawResult } from '@retobox/shared'
import { useStore } from '../store'
import { useColors } from '../theme'
import { useT } from '../lib/useT'
import { playReveal, playTick } from '../lib/sound'
import { Avatar } from '../ui/Avatar'
import { GradientButton } from '../ui/GradientButton'
import { GradientText } from '../ui/GradientText'
import { Confetti } from './Confetti'

interface Props {
  result: DrawResult
  decoyTitles: string[]
  noUsers: boolean
  onClose: () => void
  onAgain: () => void
  onManageUsers: () => void
}

// ---------------------------------------------------------------------------
// Tragaperras: rodillo vertical
// ---------------------------------------------------------------------------

const ROW_H = 84
const SPINS = 6

function buildStrip(winner: string, decoys: string[], fallback: string[]): string[] {
  const pool = decoys.length ? decoys : fallback
  const strip: string[] = []
  for (let i = 0; i < SPINS * 5; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)] as string)
  }
  strip.push(winner)
  return strip
}

function SlotReel({
  winner,
  decoyTitles,
  soundEnabled,
  onSettled,
}: {
  winner: string
  decoyTitles: string[]
  soundEnabled: boolean
  onSettled: () => void
}) {
  const colors = useColors()
  const t = useT()
  const translateY = useRef(new Animated.Value(0)).current
  // strip y fallback se calculan UNA vez al montar: el componente se remonta en
  // cada tirada (su `key` incluye el id del reto), así que no hay que recalcular.
  // Construirlos en el render con deps inestables (p. ej. la función `t`) hacía
  // que el efecto se relanzara al asentarse y la tragaperras girara otra vez.
  const strip = useRef<string[]>(
    buildStrip(winner, decoyTitles, t('reveal.decoys').split(',')),
  ).current
  // onSettled cambia de identidad en cada render del overlay; ref para no relanzar.
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  // La animación se lanza UNA sola vez al montar.
  useEffect(() => {
    translateY.setValue(0)
    const finalIndex = strip.length - 1

    // tic-tic decreciente durante el giro (igual que la web: 60ms → ×1.18 → 320ms)
    let tickTimer: ReturnType<typeof setTimeout> | null = null
    if (soundEnabled) {
      let delay = 60
      const tick = () => {
        playTick()
        delay = Math.min(delay * 1.18, 320)
        tickTimer = setTimeout(tick, delay)
      }
      tickTimer = setTimeout(tick, delay)
    }

    const animation = Animated.timing(translateY, {
      toValue: -(finalIndex * ROW_H),
      duration: 3100,
      easing: Easing.bezier(0.12, 0.7, 0.1, 1),
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (tickTimer) clearTimeout(tickTimer)
      if (finished) {
        if (soundEnabled) playReveal()
        onSettledRef.current()
      }
    })
    return () => {
      if (tickTimer) clearTimeout(tickTimer)
      animation.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={[styles.reel, { borderColor: colors.cardBorderStrong, backgroundColor: colors.card }]}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {strip.map((title, index) => (
          <View key={index} style={styles.row}>
            <Text numberOfLines={2} style={[styles.rowText, { color: colors.accentPurple }]}>
              {title}
            </Text>
          </View>
        ))}
      </Animated.View>
      <LinearGradient pointerEvents="none" colors={[colors.bgTint, 'transparent']} style={[styles.fade, styles.fadeTop]} />
      <LinearGradient pointerEvents="none" colors={['transparent', colors.bgTint]} style={[styles.fade, styles.fadeBottom]} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

export function RevealOverlay({
  result,
  decoyTitles,
  noUsers,
  onClose,
  onAgain,
  onManageUsers,
}: Props) {
  const colors = useColors()
  const t = useT()
  const soundEnabled = useStore((state) => state.soundEnabled)
  const [settled, setSettled] = useState(false)

  // Reinicia el estado cuando cambia el reto (nueva tirada).
  const handleSettled = useMemo(() => () => setSettled(true), [])
  useEffect(() => setSettled(false), [result])

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.bgTint, borderColor: colors.cardBorderStrong, shadowColor: colors.primary },
          ]}
        >
          <Text style={[styles.kicker, { color: colors.textMuted }]}>{t('reveal.elReto')}</Text>

          <SlotReel
            key={`slot-${result.challenge.id}`}
            winner={result.challenge.title}
            decoyTitles={decoyTitles}
            soundEnabled={soundEnabled}
            onSettled={handleSettled}
          />

          {settled && (
            <View style={styles.detail}>
              <GradientText style={styles.title}>{result.challenge.title}</GradientText>
              {result.challenge.description ? (
                <Text style={[styles.description, { color: colors.text }]}>
                  {result.challenge.description}
                </Text>
              ) : null}

              {result.assigned_users.length > 0 && (
                <>
                  <Text style={[styles.kicker, styles.kickerUsers, { color: colors.textMuted }]}>{t('reveal.leTocaA')}</Text>
                  <View style={styles.users}>
                    {result.assigned_users.map((user) => (
                      <View key={user.id} style={styles.userChip}>
                        <Avatar user={user} size="md" />
                        <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                          {user.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {result.anonymous_count > 0 && (
                    <Text style={[styles.anonymous, { color: colors.textMuted }]}>
                      {t(result.anonymous_count > 1 ? 'sorteo.anonPlural' : 'sorteo.anon', {
                        n: result.anonymous_count,
                      })}
                    </Text>
                  )}
                </>
              )}

              <Text style={[styles.remaining, { color: colors.textFaint }]}>
                {t('sorteo.remainingSession', { n: result.remaining })}
              </Text>

              <View style={styles.actions}>
                <Pressable onPress={onClose} style={[styles.ghost, { borderColor: colors.cardBorder }]}>
                  <Text style={[styles.ghostText, { color: colors.text }]}>{t('common.close')}</Text>
                </Pressable>
                <GradientButton label={t('common.again')} onPress={onAgain} style={styles.flex1} />
              </View>

              {result.assigned_users.length === 0 && !noUsers && (
                <Pressable onPress={onManageUsers}>
                  <Text style={[styles.link, { color: colors.textMuted }]}>{t('sorteo.manageUsers')}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {settled && <Confetti />}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 32,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  kickerUsers: { marginTop: 16 },
  // Slot
  reel: { width: '100%', height: ROW_H, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  row: { height: ROW_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  rowText: { fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 22 },
  fade: { position: 'absolute', left: 0, right: 0, height: 22 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  // Detalle
  detail: { marginTop: 20, alignItems: 'center', width: '100%' },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  description: { marginTop: 8, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  users: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  userChip: { alignItems: 'center', gap: 4, maxWidth: 84 },
  userName: { fontSize: 12, fontWeight: '500' },
  anonymous: { marginTop: 10, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  remaining: { marginTop: 16, fontSize: 12 },
  actions: { marginTop: 18, flexDirection: 'row', gap: 12, width: '100%' },
  flex1: { flex: 1 },
  ghost: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontWeight: '700' },
  link: { marginTop: 12, fontSize: 12, textDecorationLine: 'underline' },
})
