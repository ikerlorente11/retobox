import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Avatar } from '../components/Avatar'
import { Confetti } from '../components/Confetti'
import { SlotMachine } from '../components/reveal/SlotMachine'
import { Dice3D } from '../components/reveal/Dice3D'
import type { Tab } from '../components/TabBar'

interface Props {
  goTo: (t: Tab) => void
}

export function SorteoPage({ goTo }: Props) {
  const {
    mode,
    setMode,
    users,
    challenges,
    selectedUserIds,
    toggleUserSelection,
    drawing,
    doDraw,
    result,
    drawError,
    clearResult,
    revealStyle,
    soundEnabled,
    stats,
    resetSession,
    drawId,
  } = useStore()

  const [showConfetti, setShowConfetti] = useState(false)
  const [resetting, setResetting] = useState(false)

  const decoyTitles = useMemo(
    () => challenges.map((c) => c.title).slice(0, 30),
    [challenges],
  )

  const available = stats?.available ?? 0
  const total = stats?.total ?? challenges.length

  const noUsers = users.length === 0
  const isOutOfCards = drawError?.status === 409

  async function handleReset() {
    setResetting(true)
    try {
      await resetSession()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 pb-4 md:flex-1">
      {/* Cabecera */}
      <div className="text-center">
        <motion.h1
          className="text-4xl font-extrabold tracking-tight md:text-5xl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="gradient-text">Reto</span>
          <span className="text-slate-100">Box</span>
        </motion.h1>
        <p className="mt-1 text-sm text-slate-400">
          Retos al azar para tus fiestas
        </p>
      </div>

      {/* Contador de retos restantes */}
      <div className="glass flex items-center gap-3 rounded-full px-5 py-2">
        <span className="text-2xl font-extrabold gradient-text">{available}</span>
        <span className="text-sm text-slate-400">/ {total} retos restantes</span>
      </div>

      {/* Selector de modo (oculto si no hay usuarios: modo aleatorio simple) */}
      {!noUsers && (
        <div className="glass flex w-full max-w-md gap-1 rounded-2xl p-1 md:max-w-lg">
          <ModeButton
            active={mode === 'random'}
            onClick={() => setMode('random')}
            label="Aleatorio total"
          />
          <ModeButton
            active={mode === 'selected'}
            onClick={() => setMode('selected')}
            label="Usuarios seleccionados"
          />
        </div>
      )}

      {/* Chips de usuarios para modo selected */}
      <AnimatePresence>
        {!noUsers && mode === 'selected' && (
          <motion.div
            className="flex w-full max-w-md flex-wrap justify-center gap-2 md:max-w-lg"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {users.map((u) => {
              const sel = selectedUserIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUserSelection(u.id)}
                  className={`chip ${
                    sel
                      ? 'border-transparent bg-neon-gradient text-white shadow-glow'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: u.color }}
                  />
                  {u.name}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zona de acción: en tablet crece y centra el botón ¡Tirar! en el
          espacio que queda, dejando la cabecera y controles pegados arriba. */}
      <div className="flex w-full flex-col items-center gap-6 md:flex-1 md:justify-center">
      {/* Botón ¡Tirar! */}
      <motion.button
        onClick={() => {
          setShowConfetti(false)
          void doDraw()
        }}
        disabled={drawing || isOutOfCards}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        className="relative grid h-44 w-44 place-items-center rounded-full bg-neon-gradient text-2xl font-extrabold text-white shadow-glow disabled:opacity-60 md:h-52 md:w-52"
      >
        <span className="absolute inset-0 animate-pulse rounded-full bg-white/10 blur-xl" />
        <span className="relative z-10 flex flex-col items-center">
          {drawing ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="text-4xl"
            >
              🎲
            </motion.span>
          ) : (
            <>
              <span className="text-4xl">🎲</span>
              <span>¡Tirar!</span>
            </>
          )}
        </span>
      </motion.button>

      <p className="text-center text-xs text-slate-500">
        {noUsers
          ? 'Sin usuarios: modo aleatorio simple. Añade gente en la pestaña Usuarios.'
          : mode === 'selected'
            ? 'Solo entrarán los usuarios seleccionados.'
            : 'Participan todos los usuarios registrados.'}
      </p>

      {/* Error 400 amistoso */}
      <AnimatePresence>
        {drawError && drawError.status === 400 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass rounded-2xl border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
          >
            {drawError.detail}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado sin retos (409) */}
      <AnimatePresence>
        {isOutOfCards && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-strong flex w-full max-w-md flex-col items-center gap-4 rounded-3xl p-6 text-center md:max-w-lg"
          >
            <span className="text-5xl">🪫</span>
            <h3 className="text-lg font-bold">No quedan retos</h3>
            <p className="text-sm text-slate-400">
              Habéis agotado todas las cartas de esta sesión. Reinicia para volver
              a empezar.
            </p>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="btn-primary w-full"
            >
              {resetting ? 'Reiniciando…' : 'Reiniciar sesión'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Overlay de revelado */}
      <AnimatePresence>
        {result && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-ink-900/80 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {showConfetti && <Confetti />}
            <motion.div
              key={drawId}
              className="glass-strong relative w-full max-w-md rounded-4xl p-6 md:max-w-lg"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            >
              {revealStyle === 'slot' ? (
                <SlotMachine
                  challenge={result.challenge}
                  assignedUsers={result.assigned_users}
                  decoyTitles={decoyTitles}
                  soundEnabled={soundEnabled}
                  onSettled={() => setShowConfetti(true)}
                />
              ) : (
                <Dice3D
                  challenge={result.challenge}
                  assignedUsers={result.assigned_users}
                  decoyTitles={decoyTitles}
                  soundEnabled={soundEnabled}
                  onSettled={() => setShowConfetti(true)}
                />
              )}

              {/* Detalle del reto */}
              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.6 }}
              >
                <h3 className="text-xl font-extrabold gradient-text">
                  {result.challenge.title}
                </h3>
                {result.challenge.description && (
                  <p className="mt-2 text-sm text-slate-300">
                    {result.challenge.description}
                  </p>
                )}
                {result.assigned_users.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {result.assigned_users.map((u) => (
                      <span
                        key={u.id}
                        className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs"
                      >
                        <Avatar user={u} size="sm" />
                        {u.name}
                      </span>
                    ))}
                    {result.anonymous_count > 0 && (
                      <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                        🎭 +{result.anonymous_count} anónimo
                        {result.anonymous_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  Quedan {result.remaining} retos en esta sesión
                </p>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => {
                      setShowConfetti(false)
                      clearResult()
                    }}
                    className="btn-ghost flex-1"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => {
                      setShowConfetti(false)
                      clearResult()
                      void doDraw()
                    }}
                    className="btn-primary flex-1"
                  >
                    Otra vez 🎲
                  </button>
                </div>
                {result.assigned_users.length === 0 && !noUsers && (
                  <button
                    onClick={() => {
                      clearResult()
                      goTo('usuarios')
                    }}
                    className="mt-3 text-xs text-slate-400 underline"
                  >
                    Gestionar usuarios
                  </button>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex-1 rounded-xl px-3 py-2 text-sm font-semibold"
    >
      {active && (
        <motion.span
          layoutId="mode-pill"
          className="absolute inset-0 rounded-xl bg-neon-gradient shadow-glow"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className={`relative z-10 ${active ? 'text-white' : 'text-slate-400'}`}>
        {label}
      </span>
    </button>
  )
}
