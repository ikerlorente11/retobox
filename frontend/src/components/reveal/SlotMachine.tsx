import { motion, useAnimationControls } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import type { Challenge, User } from '../../types'
import { Avatar } from '../Avatar'
import { playReveal, playTick } from '../../lib/sound'
import { useT } from '../../lib/useT'

interface Props {
  challenge: Challenge
  assignedUsers: User[]
  decoyTitles: string[]
  soundEnabled: boolean
  onSettled: () => void
}

const ROW_H = 88 // px por fila
const SPINS = 6 // vueltas completas antes de parar

// Construye la cinta del rodillo: muchas filas señuelo y el ganador al final
function buildStrip(winner: string, decoys: string[]): string[] {
  const pool = decoys.length ? decoys : [winner]
  const strip: string[] = []
  const total = SPINS * 5
  for (let i = 0; i < total; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)])
  }
  strip.push(winner) // posición final visible
  return strip
}

export function SlotMachine({
  challenge,
  assignedUsers,
  decoyTitles,
  soundEnabled,
  onSettled,
}: Props) {
  const t = useT()
  const controls = useAnimationControls()
  const strip = useMemo(
    () =>
      buildStrip(
        challenge.title,
        decoyTitles.length ? decoyTitles : t('reveal.decoys').split(','),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [challenge.title, decoyTitles],
  )
  const tickRef = useRef<number | null>(null)

  useEffect(() => {
    const finalIndex = strip.length - 1
    const target = -(finalIndex * ROW_H)

    // tic-tic decreciente
    if (soundEnabled) {
      let delay = 60
      const tick = () => {
        playTick()
        delay = Math.min(delay * 1.18, 320)
        tickRef.current = window.setTimeout(tick, delay)
      }
      tickRef.current = window.setTimeout(tick, delay)
    }

    void controls
      .start({
        y: target,
        transition: { duration: 3.1, ease: [0.12, 0.7, 0.1, 1] },
      })
      .then(() => {
        if (tickRef.current) window.clearTimeout(tickRef.current)
        if (soundEnabled) playReveal()
        onSettled()
      })

    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Rodillo de reto (ancho fijo para que el popup se ajuste a él) */}
      <div className="w-72">
        <p className="mb-2 text-center text-xs uppercase tracking-widest text-slate-400">
          {t('reveal.elReto')}
        </p>
        <div
          className="glass-strong relative mx-auto w-full overflow-hidden rounded-3xl shadow-glow"
          style={{ height: ROW_H }}
        >
          {/* línea central */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2 bg-white/10" />
          {/* degradados arriba/abajo */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-ink-800/90 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-ink-800/90 to-transparent" />
          <motion.div animate={controls} initial={{ y: 0 }}>
            {strip.map((title, i) => (
              <div
                key={i}
                className="grid place-items-center px-4 text-center"
                style={{ height: ROW_H }}
              >
                <span className="line-clamp-2 text-lg font-bold leading-tight gradient-text">
                  {title}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Zona de usuarios asignados */}
      {assignedUsers.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-center text-xs uppercase tracking-widest text-slate-400">
            {t('reveal.leTocaA')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {assignedUsers.map((u, i) => (
              <motion.div
                key={u.id}
                className="flex flex-col items-center gap-1"
                initial={{ scale: 0, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{
                  delay: 2.6 + i * 0.12,
                  type: 'spring',
                  stiffness: 320,
                  damping: 16,
                }}
              >
                <Avatar user={u} size="lg" ring />
                <span className="max-w-[5rem] truncate text-xs font-medium text-slate-200">
                  {u.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
