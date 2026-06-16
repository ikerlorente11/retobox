import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Challenge, User } from '../../types'
import { Avatar } from '../Avatar'
import { playReveal } from '../../lib/sound'

interface Props {
  challenge: Challenge
  assignedUsers: User[]
  decoyTitles: string[]
  soundEnabled: boolean
  onSettled: () => void
}

const SIZE = 150 // px del cubo
const HALF = SIZE / 2

// Caras: front muestra el reto al aterrizar; resto, señuelos decorativos.
function faceTitles(winner: string, decoys: string[]): string[] {
  const pool = [...decoys]
  const pick = () =>
    pool.length ? pool[Math.floor(Math.random() * pool.length)] : '🎲'
  return [winner, pick(), pick(), pick(), pick(), pick()]
}

const faceTransforms = [
  `rotateY(0deg) translateZ(${HALF}px)`, // front
  `rotateY(180deg) translateZ(${HALF}px)`, // back
  `rotateY(90deg) translateZ(${HALF}px)`, // right
  `rotateY(-90deg) translateZ(${HALF}px)`, // left
  `rotateX(90deg) translateZ(${HALF}px)`, // top
  `rotateX(-90deg) translateZ(${HALF}px)`, // bottom
]

export function Dice3D({
  challenge,
  assignedUsers,
  decoyTitles,
  soundEnabled,
  onSettled,
}: Props) {
  const [titles] = useState(() => faceTitles(challenge.title, decoyTitles))
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLanded(true)
      if (soundEnabled) playReveal()
      onSettled()
    }, 2400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs uppercase tracking-widest text-slate-400">El reto</p>

      <div
        className="grid place-items-center"
        style={{ perspective: 1000, height: SIZE + 12 }}
      >
        <motion.div
          style={{ width: SIZE, height: SIZE, transformStyle: 'preserve-3d' }}
          initial={{ rotateX: 0, rotateY: 180, y: -10 }}
          animate={{
            // giro monótono (siempre hacia delante) que frena de forma uniforme y
            // aterriza en la cara front: 720 y 1080 son múltiplos de 360 -> orientación 0.
            rotateX: 720,
            rotateY: 1080,
            y: [-8, -40, 0],
          }}
          transition={{
            rotateX: { duration: 2.4, ease: [0.16, 0.7, 0.22, 1] },
            rotateY: { duration: 2.4, ease: [0.16, 0.7, 0.22, 1] },
            y: { duration: 2.4, ease: 'easeInOut', times: [0, 0.45, 1] },
          }}
        >
          {titles.map((title, i) => (
            <div
              key={i}
              className="absolute grid place-items-center rounded-3xl border border-purple-400/40 p-4 text-center"
              style={{
                width: SIZE,
                height: SIZE,
                transform: faceTransforms[i],
                // caras OPACAS: nada de transparencia/blur para que el texto se lea
                // y no se vea a través del cubo mientras gira.
                background:
                  'linear-gradient(145deg, #2a2342 0%, #181428 60%, #110f1c 100%)',
                boxShadow:
                  '0 0 40px -8px rgba(168,85,247,0.6) inset, 0 10px 30px -10px rgba(0,0,0,0.6)',
                backfaceVisibility: 'hidden',
              }}
            >
              <span
                className={`line-clamp-3 text-sm font-extrabold leading-tight ${
                  i === 0 ? 'gradient-text' : 'text-slate-200'
                }`}
              >
                {title}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* sombra que reacciona al aterrizaje */}
      <motion.div
        className="h-3 rounded-full bg-black/50 blur-md"
        initial={{ width: 80, opacity: 0.3 }}
        animate={{
          width: landed ? 150 : 70,
          opacity: landed ? 0.55 : 0.3,
        }}
        transition={{ duration: 0.3 }}
      />

      {assignedUsers.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-center text-xs uppercase tracking-widest text-slate-400">
            Le toca a
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {assignedUsers.map((u, i) => (
              <motion.div
                key={u.id}
                className="flex flex-col items-center gap-1"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 2.5 + i * 0.12,
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
