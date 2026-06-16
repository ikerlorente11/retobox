// Un rodillo (tragaperras) para UNA palabra de un grupo del mezclador (Combos).
// Portado de frontend/src/components/reveal/WordReel.tsx con la API Animated.
// El sonido lo gestiona el contenedor (un único sonido al acabar todos), para
// no solapar pitidos cuando hay varios rodillos a la vez.

import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '../theme'

interface Props {
  label: string // nombre del grupo
  winner: string // palabra que sale
  words: string[] // palabras del grupo (señuelos)
  delay?: number // retardo de arranque (cascada entre rodillos)
  onSettled: () => void
}

const ROW_H = 56
const SPINS = 6
const DURATION = 2600

function buildStrip(winner: string, words: string[]): string[] {
  const pool = words.length ? words : [winner]
  const strip: string[] = []
  for (let i = 0; i < SPINS * 5; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)] as string)
  }
  strip.push(winner) // posición final visible
  return strip
}

export function WordReel({ label, winner, words, delay = 0, onSettled }: Props) {
  const colors = useColors()
  const translateY = useRef(new Animated.Value(0)).current
  const strip = useMemo(() => buildStrip(winner, words), [winner, words])

  // onSettled cambia de identidad en cada render del contenedor (incrementa un
  // contador); lo guardamos en un ref para llamarlo sin reiniciar la animación.
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  // La animación se lanza UNA sola vez al montar. El componente se remonta en
  // cada tirada porque su `key` incluye el spinId (no hace falta más deps).
  useEffect(() => {
    translateY.setValue(0)
    const finalIndex = strip.length - 1
    const animation = Animated.timing(translateY, {
      toValue: -(finalIndex * ROW_H),
      duration: DURATION,
      delay,
      easing: Easing.bezier(0.12, 0.7, 0.1, 1),
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (finished) {
        onSettledRef.current()
      }
    })
    return () => animation.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.reel, { borderColor: colors.cardBorderStrong, backgroundColor: colors.card }]}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          {strip.map((word, index) => (
            <View key={index} style={styles.row}>
              <Text style={[styles.word, { color: colors.accentPurple }]} numberOfLines={2}>
                {word}
              </Text>
            </View>
          ))}
        </Animated.View>
        <LinearGradient pointerEvents="none" colors={[colors.bgTint, 'transparent']} style={[styles.fade, styles.fadeTop]} />
        <LinearGradient pointerEvents="none" colors={['transparent', colors.bgTint]} style={[styles.fade, styles.fadeBottom]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: 116, alignItems: 'center', gap: 6 },
  label: {
    maxWidth: '100%',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  reel: { width: '100%', height: ROW_H, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { height: ROW_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  word: { fontSize: 15, fontWeight: '800', textAlign: 'center', lineHeight: 18 },
  fade: { position: 'absolute', left: 0, right: 0, height: 16 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
})
