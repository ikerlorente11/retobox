import { motion, useAnimationControls } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { RevealStyle } from '../../types'

// Un rodillo (tragaperras o dado) para UNA palabra de un grupo del mezclador.
// El sonido lo gestiona el contenedor (un único sonido al acabar todos), para
// no solapar pitidos cuando hay varios rodillos a la vez.

interface Props {
  style: RevealStyle
  label: string // nombre del grupo
  winner: string // palabra que sale
  words: string[] // palabras del grupo (señuelos)
  delay?: number // retardo de arranque (cascada entre rodillos)
  onSettled: () => void
}

const ROW_H = 60 // px por fila del rodillo slot
const SPINS = 6
const SLOT_DURATION = 2.8
const DICE_DURATION = 2.2

function buildStrip(winner: string, words: string[]): string[] {
  const pool = words.length ? words : [winner]
  const strip: string[] = []
  const total = SPINS * 5
  for (let i = 0; i < total; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)])
  }
  strip.push(winner) // posición final visible
  return strip
}

export function WordReel(props: Props) {
  return (
    <div className="flex w-28 flex-col items-center gap-2 sm:w-32">
      <p className="max-w-full truncate text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        {props.label}
      </p>
      {props.style === 'slot' ? <SlotReel {...props} /> : <DiceReel {...props} />}
    </div>
  )
}

function SlotReel({ winner, words, delay = 0, onSettled }: Props) {
  const controls = useAnimationControls()
  const strip = useMemo(() => buildStrip(winner, words), [winner, words])

  useEffect(() => {
    const target = -((strip.length - 1) * ROW_H)
    void controls
      .start({
        y: target,
        transition: { duration: SLOT_DURATION, delay, ease: [0.12, 0.7, 0.1, 1] },
      })
      .then(onSettled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="glass-strong relative w-full overflow-hidden rounded-2xl shadow-glow"
      style={{ height: ROW_H }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2 bg-white/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-ink-800/90 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-ink-800/90 to-transparent" />
      <motion.div animate={controls} initial={{ y: 0 }}>
        {strip.map((word, i) => (
          <div
            key={i}
            className="grid place-items-center px-2 text-center"
            style={{ height: ROW_H }}
          >
            <span className="line-clamp-2 text-sm font-bold leading-tight gradient-text">
              {word}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

const SIZE = 66 // lado del cubo
const HALF = SIZE / 2
// Caja fija que contiene al dado. Es mayor que el cubo para que, al girar (sus
// esquinas sobresalen ~√2), nunca cambie el tamaño ni asome del recuadro; con
// overflow-hidden el giro no altera el área de scroll del contenedor.
const DICE_BOX = 104

const faceTransforms = [
  `rotateY(0deg) translateZ(${HALF}px)`,
  `rotateY(180deg) translateZ(${HALF}px)`,
  `rotateY(90deg) translateZ(${HALF}px)`,
  `rotateY(-90deg) translateZ(${HALF}px)`,
  `rotateX(90deg) translateZ(${HALF}px)`,
  `rotateX(-90deg) translateZ(${HALF}px)`,
]

function DiceReel({ winner, words, delay = 0, onSettled }: Props) {
  const [faces] = useState(() => {
    const pick = () =>
      words.length ? words[Math.floor(Math.random() * words.length)] : winner
    return [winner, pick(), pick(), pick(), pick(), pick()]
  })

  useEffect(() => {
    const t = window.setTimeout(onSettled, (DICE_DURATION + delay) * 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="grid place-items-center overflow-hidden"
      style={{ perspective: 600, height: DICE_BOX, width: DICE_BOX }}
    >
      <motion.div
        style={{ width: SIZE, height: SIZE, transformStyle: 'preserve-3d' }}
        initial={{ rotateX: 0, rotateY: 180 }}
        animate={{ rotateX: 720, rotateY: 1080 }}
        transition={{
          rotateX: { duration: DICE_DURATION, delay, ease: [0.16, 0.7, 0.22, 1] },
          rotateY: { duration: DICE_DURATION, delay, ease: [0.16, 0.7, 0.22, 1] },
        }}
      >
        {faces.map((word, i) => (
          <div
            key={i}
            className="absolute grid place-items-center rounded-2xl border border-purple-400/40 p-1.5 text-center"
            style={{
              width: SIZE,
              height: SIZE,
              transform: faceTransforms[i],
              background:
                'linear-gradient(145deg, #2a2342 0%, #181428 60%, #110f1c 100%)',
              boxShadow:
                '0 0 30px -8px rgba(168,85,247,0.6) inset, 0 8px 24px -10px rgba(0,0,0,0.6)',
              backfaceVisibility: 'hidden',
            }}
          >
            <span
              className={`line-clamp-3 text-xs font-extrabold leading-tight ${
                i === 0 ? 'gradient-text' : 'text-slate-200'
              }`}
            >
              {word}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
