import { motion, useAnimationControls } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { User } from '../../types'
import { Avatar } from '../Avatar'
import { playReveal, playTick } from '../../lib/sound'
import { useT } from '../../lib/useT'

interface Props {
  // Personas que pueden tocar de compañero (todos menos los asignados al reto).
  candidates: User[]
  soundEnabled: boolean
}

const ROW_H = 56 // px por fila del rodillo de compañeros
const SPINS = 5 // vueltas antes de parar (más corto que la tragaperras del reto)

// Cinta del rodillo: filas señuelo al azar y el ganador al final (posición visible).
function buildStrip(winner: User, pool: User[]): User[] {
  const strip: User[] = []
  const total = SPINS * 5
  for (let i = 0; i < total; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)])
  }
  strip.push(winner)
  return strip
}

// Mini-tragaperras para sortear un compañero entre los participantes restantes.
// El reto ya está asignado a alguien; esto elige con quién lo hace.
export function PartnerRoll({ candidates, soundEnabled }: Props) {
  const t = useT()
  const controls = useAnimationControls()
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle')
  const [strip, setStrip] = useState<User[]>([])
  // Se incrementa en cada tirada para disparar el giro DESPUÉS de montar el
  // rodillo (lanzar controls.start() en el onClick, con el rodillo aún sin
  // montar, hacía que framer resolviera la animación al instante: salía directo).
  const [spin, setSpin] = useState(0)
  const tickRef = useRef<number | null>(null)

  function roll() {
    if (candidates.length === 0) return
    const winner = candidates[Math.floor(Math.random() * candidates.length)]
    setStrip(buildStrip(winner, candidates))
    setPhase('rolling')
    setSpin((n) => n + 1)
  }

  // Lanza el giro una vez el rodillo está en el DOM (tras el render de 'rolling').
  useEffect(() => {
    if (spin === 0 || strip.length === 0) return

    controls.set({ y: 0 }) // arriba del todo antes de lanzar (clave al re-tirar)

    if (tickRef.current) window.clearTimeout(tickRef.current)
    if (soundEnabled) {
      let delay = 60
      const tick = () => {
        playTick()
        delay = Math.min(delay * 1.18, 320)
        tickRef.current = window.setTimeout(tick, delay)
      }
      tickRef.current = window.setTimeout(tick, delay)
    }

    const finalIndex = strip.length - 1
    void controls
      .start({
        y: -(finalIndex * ROW_H),
        transition: { duration: 2, ease: [0.12, 0.7, 0.1, 1] },
      })
      .then(() => {
        if (tickRef.current) window.clearTimeout(tickRef.current)
        if (soundEnabled) playReveal()
        setPhase('done')
      })

    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin])

  if (phase === 'idle') {
    return (
      <div className="mt-4 border-t border-white/10 pt-4">
        <button onClick={roll} className="btn-ghost w-full">
          🎲 {t('partner.cta')}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="mb-2 text-center text-xs uppercase tracking-widest text-slate-400">
        {t('partner.heading')}
      </p>
      <motion.div
        // Pequeño “pop” del marco al asentarse el ganador.
        animate={phase === 'done' ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.4 }}
        className={`glass-strong relative mx-auto w-full overflow-hidden rounded-3xl ${
          phase === 'done' ? 'shadow-glow ring-2 ring-neon-purple/40' : ''
        }`}
        style={{ height: ROW_H }}
      >
        {/* degradados arriba/abajo para enmascarar el desplazamiento */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-ink-800/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-ink-800/90 to-transparent" />
        <motion.div animate={controls} initial={{ y: 0 }}>
          {strip.map((u, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2.5 px-4"
              style={{ height: ROW_H }}
            >
              <Avatar user={u} size="sm" ring={phase === 'done'} />
              <span className="truncate text-lg font-bold text-slate-100">
                {u.name}
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {phase === 'done' && (
        <button onClick={roll} className="btn-ghost mt-3 w-full text-sm">
          🎲 {t('partner.again')}
        </button>
      )}
    </div>
  )
}
