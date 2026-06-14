import { motion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['#a855f7', '#ec4899', '#22d3ee', '#f97316', '#22c55e', '#eab308']

interface Props {
  count?: number
}

// Confeti ligero basado en Framer Motion. Se monta una vez al revelar.
export function Confetti({ count = 40 }: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 100,
        rotate: Math.random() * 720 - 360,
        delay: Math.random() * 0.2,
        duration: 1.2 + Math.random() * 0.9,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        left: Math.random() * 100,
      })),
    [count],
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-[-5%] rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
          }}
          initial={{ y: '-10vh', opacity: 1, rotate: 0 }}
          animate={{
            y: '110vh',
            x: p.x,
            rotate: p.rotate,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
