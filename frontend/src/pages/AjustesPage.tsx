import { motion } from 'framer-motion'
import { useState } from 'react'
import { useStore } from '../store'
import { Modal } from '../components/Modal'

export function AjustesPage() {
  const {
    theme,
    setTheme,
    revealStyle,
    setRevealStyle,
    soundEnabled,
    setSoundEnabled,
    stats,
    resetSession,
  } = useStore()

  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetCount, setResetCount] = useState<number | null>(null)

  async function handleReset() {
    setResetting(true)
    try {
      const n = await resetSession()
      setResetCount(n)
      setConfirmReset(false)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <h1 className="text-2xl font-extrabold">Ajustes</h1>

      {/* Tema */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-bold">Tema</h2>
        <p className="mb-4 text-sm text-slate-400">
          Elige la apariencia de la app.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StyleCard
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            emoji="🌙"
            label="Oscuro"
            desc="Neón sobre negro"
          />
          <StyleCard
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            emoji="☀️"
            label="Claro"
            desc="Luminoso y limpio"
          />
        </div>
      </section>

      {/* Estilo de animación */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-bold">Animación de revelado</h2>
        <p className="mb-4 text-sm text-slate-400">
          Elige cómo se revela el reto al tirar.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StyleCard
            active={revealStyle === 'slot'}
            onClick={() => setRevealStyle('slot')}
            emoji="🎰"
            label="Tragaperras"
            desc="Rodillos giratorios"
          />
          <StyleCard
            active={revealStyle === 'dice'}
            onClick={() => setRevealStyle('dice')}
            emoji="🎲"
            label="Dado 3D"
            desc="Cubo que rueda"
          />
        </div>
      </section>

      {/* Sonido */}
      <section className="glass flex items-center justify-between rounded-3xl p-5">
        <div>
          <h2 className="font-bold">Sonido</h2>
          <p className="text-sm text-slate-400">
            Efectos al girar y revelar.
          </p>
        </div>
        <Toggle on={soundEnabled} onChange={setSoundEnabled} label="Sonido" />
      </section>

      {/* Stats */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-3 font-bold">Estadísticas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total retos" value={stats?.total ?? 0} />
          <Stat label="Disponibles" value={stats?.available ?? 0} accent="cyan" />
          <Stat label="Usados" value={stats?.used ?? 0} accent="pink" />
          <Stat label="Usuarios" value={stats?.users ?? 0} accent="purple" />
        </div>
      </section>

      {/* Reset */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-bold">Sesión</h2>
        <p className="mb-4 text-sm text-slate-400">
          Reinicia para que todos los retos vuelvan a estar disponibles.
        </p>
        <button
          onClick={() => setConfirmReset(true)}
          className="btn-ghost w-full"
        >
          ♻️ Reiniciar sesión
        </button>
        {resetCount !== null && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-center text-sm text-emerald-300"
          >
            {resetCount} retos reseteados.
          </motion.p>
        )}
      </section>

      <p className="text-center text-xs text-slate-600">RetoBox · v1.0</p>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reiniciar sesión"
      >
        <p className="text-sm text-slate-300">
          Todos los retos volverán a estar disponibles. ¿Continuar?
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setConfirmReset(false)}
            className="btn-ghost flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="btn-primary flex-1"
          >
            {resetting ? 'Reiniciando…' : 'Reiniciar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function StyleCard({
  active,
  onClick,
  emoji,
  label,
  desc,
}: {
  active: boolean
  onClick: () => void
  emoji: string
  label: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-transparent bg-neon-gradient/10 shadow-glow'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      {active && (
        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-neon-gradient text-[10px] text-white">
          ✓
        </span>
      )}
      <span className="text-3xl">{emoji}</span>
      <p className={`mt-2 font-bold ${active ? 'gradient-text' : ''}`}>{label}</p>
      <p className="text-xs text-slate-400">{desc}</p>
    </button>
  )
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 rounded-full transition ${
        on ? 'bg-neon-gradient' : 'bg-white/10'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow"
        style={{ left: on ? 'calc(100% - 1.75rem)' : '0.25rem' }}
      />
    </button>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'cyan' | 'pink' | 'purple'
}) {
  const color =
    accent === 'cyan'
      ? 'text-neon-cyan'
      : accent === 'pink'
        ? 'text-neon-pink'
        : accent === 'purple'
          ? 'text-neon-purple'
          : 'text-slate-100'
  return (
    <div className="rounded-2xl bg-white/5 p-3 text-center">
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
