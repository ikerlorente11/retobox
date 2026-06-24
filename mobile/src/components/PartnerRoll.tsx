// Mini-tragaperras para sortear un COMPAÑERO entre los participantes restantes
// (todos los usuarios menos los asignados al reto). El reto ya está asignado a
// alguien; esto elige con quién lo hace. Portado de la web (PartnerRoll.tsx) con
// la API Animated, siguiendo el patrón de WordReel/SlotReel: la animación corre
// una sola vez al montar y se reinicia remontando el rodillo vía `key` (spinId).

import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { User } from '@retobox/shared'
import { useColors } from '../theme'
import { useT } from '../lib/useT'
import { playReveal, playTick } from '../lib/sound'
import { Avatar } from '../ui/Avatar'

interface Props {
  // Personas que pueden tocar de compañero (todos menos los asignados al reto).
  candidates: User[]
  soundEnabled: boolean
}

const ROW_H = 52
const SPINS = 5 // vueltas antes de parar (más corto que la tragaperras del reto)
const DURATION = 2000

function buildStrip(winner: User, pool: User[]): User[] {
  const strip: User[] = []
  for (let i = 0; i < SPINS * 5; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)] as User)
  }
  strip.push(winner) // posición final visible
  return strip
}

// Rodillo que gira una vez al montar y aterriza en `winner`. Se remonta en cada
// tirada (su `key` incluye el spinId), así que el strip se construye una sola vez.
function PartnerReel({
  winner,
  pool,
  soundEnabled,
  done,
  onSettled,
}: {
  winner: User
  pool: User[]
  soundEnabled: boolean
  done: boolean
  onSettled: () => void
}) {
  const colors = useColors()
  const translateY = useRef(new Animated.Value(0)).current
  const strip = useRef<User[]>(buildStrip(winner, pool)).current
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    translateY.setValue(0)
    const finalIndex = strip.length - 1

    // tic-tic decreciente durante el giro (igual que el resto de rodillos).
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
      duration: DURATION,
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
    <View
      style={[
        styles.reel,
        {
          backgroundColor: colors.card,
          borderColor: done ? colors.accentPurple : colors.cardBorderStrong,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ translateY }] }}>
        {strip.map((user, index) => (
          <View key={index} style={styles.row}>
            <Avatar user={user} size="sm" />
            <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={1}>
              {user.name}
            </Text>
          </View>
        ))}
      </Animated.View>
      <LinearGradient pointerEvents="none" colors={[colors.bgTint, 'transparent']} style={[styles.fade, styles.fadeTop]} />
      <LinearGradient pointerEvents="none" colors={['transparent', colors.bgTint]} style={[styles.fade, styles.fadeBottom]} />
    </View>
  )
}

export function PartnerRoll({ candidates, soundEnabled }: Props) {
  const t = useT()
  const colors = useColors()
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle')
  const [spin, setSpin] = useState(0)
  const [winner, setWinner] = useState<User | null>(null)

  function roll() {
    if (candidates.length === 0) return
    setWinner(candidates[Math.floor(Math.random() * candidates.length)] as User)
    setPhase('rolling')
    setSpin((n) => n + 1) // remonta el rodillo -> nueva animación
  }

  if (phase === 'idle') {
    return (
      <View style={[styles.wrap, { borderTopColor: colors.cardBorder }]}>
        <Pressable onPress={roll} style={[styles.ghost, { borderColor: colors.cardBorder }]}>
          <Text style={[styles.ghostText, { color: colors.text }]}>🎲 {t('partner.cta')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.wrap, { borderTopColor: colors.cardBorder }]}>
      <Text style={[styles.kicker, { color: colors.textMuted }]}>{t('partner.heading')}</Text>
      {winner && (
        <PartnerReel
          key={`partner-${spin}`}
          winner={winner}
          pool={candidates}
          soundEnabled={soundEnabled}
          done={phase === 'done'}
          onSettled={() => setPhase('done')}
        />
      )}
      {phase === 'done' && (
        <Pressable onPress={roll} style={[styles.ghost, styles.ghostAgain, { borderColor: colors.cardBorder }]}>
          <Text style={[styles.ghostText, { color: colors.text }]}>🎲 {t('partner.again')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, paddingTop: 16, width: '100%', alignItems: 'center', borderTopWidth: 1 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  reel: { width: '100%', height: ROW_H, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  rowText: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, height: 16 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  ghost: { width: '100%', borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  ghostAgain: { marginTop: 12 },
  ghostText: { fontWeight: '700' },
})
