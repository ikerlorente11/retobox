// Confeti equivalente al de la web (Confetti.tsx): piezas de colores que caen
// desde arriba con deriva horizontal, giro y desvanecido. Implementado con la API
// Animated. Overlay a pantalla completa, sin capturar toques.

import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native'

const COLORS = ['#a855f7', '#ec4899', '#22d3ee', '#f97316', '#22c55e', '#eab308']

interface PieceData {
  id: number
  leftRatio: number
  driftX: number
  rotate: number
  delay: number
  duration: number
  color: string
  size: number
}

function Piece({ piece, height }: { piece: PieceData; height: number }) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [progress, piece])

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-height * 0.1, height * 1.1],
  })
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.driftX] })
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.rotate}deg`] })
  const opacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] })

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: `${piece.leftRatio * 100}%`,
        width: piece.size,
        height: piece.size * 0.5,
        backgroundColor: piece.color,
        borderRadius: 2,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  )
}

export function Confetti({ count = 40 }: { count?: number }) {
  const { height } = useWindowDimensions()
  const pieces = useMemo<PieceData[]>(
    () =>
      Array.from({ length: count }).map((_, index) => ({
        id: index,
        leftRatio: Math.random(),
        driftX: (Math.random() - 0.5) * 100,
        rotate: Math.random() * 720 - 360,
        delay: Math.random() * 200,
        duration: 1200 + Math.random() * 900,
        color: COLORS[index % COLORS.length] as string,
        size: 6 + Math.random() * 8,
      })),
    [count],
  )

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece) => (
        <Piece key={piece.id} piece={piece} height={height} />
      ))}
    </Animated.View>
  )
}
