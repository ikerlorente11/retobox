import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Avatar } from '../components/Avatar'
import { Confetti } from '../components/Confetti'
import { CollectionIcon } from '../components/icons'
import { useT } from '../lib/useT'
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
    collections,
    activeCollectionId,
  } = useStore()

  const activeCollection =
    collections.find((c) => c.id === activeCollectionId) ?? null
  const t = useT()

  const [showConfetti, setShowConfetti] = useState(false)
  const [resetting, setResetting] = useState(false)
  // true cuando la tragaperras/dado ha terminado de revelar el reto: entonces se
  // muestra el detalle debajo y el popup crece.
  const [revealed, setRevealed] = useState(false)

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
        <p className="mt-1 text-sm text-slate-400">{t('sorteo.subtitle')}</p>
      </div>

      {/* Colección activa (de la que se sortea) */}
      {activeCollection && (
        <div className="flex items-center gap-1.5 text-sm">
          <CollectionIcon className="h-4 w-4 text-neon-purple" />
          <span className="font-semibold text-slate-200">
            {activeCollection.name}
          </span>
        </div>
      )}

      {/* Contador de retos restantes */}
      <div className="glass flex items-center gap-3 rounded-full px-5 py-2">
        <span className="text-2xl font-extrabold gradient-text">{available}</span>
        <span className="text-sm text-slate-400">
          {t('sorteo.remaining', { total })}
        </span>
      </div>

      {/* Selector de modo (oculto si no hay usuarios: modo aleatorio simple) */}
      {!noUsers && (
        <div className="glass flex w-full max-w-md gap-1 rounded-2xl p-1 md:max-w-lg">
          <ModeButton
            active={mode === 'random'}
            onClick={() => setMode('random')}
            label={t('sorteo.modeRandom')}
          />
          <ModeButton
            active={mode === 'selected'}
            onClick={() => setMode('selected')}
            label={t('sorteo.modeSelected')}
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
                  className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition ${
                    sel
                      ? 'bg-neon-gradient text-white shadow-glow'
                      : 'bg-white/5 text-slate-300 opacity-60 hover:opacity-100'
                  }`}
                >
                  <Avatar user={u} size="sm" ring={sel} />
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
          setRevealed(false)
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
              <span>{t('sorteo.tirar')}</span>
            </>
          )}
        </span>
      </motion.button>

      <p className="text-center text-xs text-slate-500">
        {noUsers
          ? t('sorteo.hintNoUsers')
          : mode === 'selected'
            ? t('sorteo.hintSelected')
            : t('sorteo.hintRandom')}
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
            <h3 className="text-lg font-bold">{t('sorteo.outTitle')}</h3>
            <p className="text-sm text-slate-400">{t('sorteo.outBody')}</p>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="btn-primary w-full"
            >
              {resetting ? t('sorteo.resetting') : t('sorteo.resetSession')}
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
            {/* El popup se ajusta al contenido (w-auto) y, al revelarse el reto,
                crece de forma animada (layout) para mostrar el detalle debajo. */}
            <motion.div
              key={drawId}
              layout
              className="glass-strong relative flex w-auto min-w-[17rem] max-w-[calc(100vw-2rem)] flex-col items-center rounded-4xl p-6"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            >
              {/* La tragaperras / el dado se centran. No mostramos aquí los
                  usuarios (assignedUsers=[]); van en el detalle de abajo. */}
              <div>
                {revealStyle === 'slot' ? (
                  <SlotMachine
                    challenge={result.challenge}
                    assignedUsers={[]}
                    decoyTitles={decoyTitles}
                    soundEnabled={soundEnabled}
                    onSettled={() => {
                      setShowConfetti(true)
                      setRevealed(true)
                    }}
                  />
                ) : (
                  <Dice3D
                    challenge={result.challenge}
                    assignedUsers={[]}
                    decoyTitles={decoyTitles}
                    soundEnabled={soundEnabled}
                    onSettled={() => {
                      setShowConfetti(true)
                      setRevealed(true)
                    }}
                  />
                )}
              </div>

              {/* Detalle del reto: aparece debajo SOLO cuando ya se ha revelado. */}
              {revealed && (
                <motion.div
                  layout
                  className="mt-3 w-full text-center"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
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
                          {t(
                            result.anonymous_count > 1
                              ? 'sorteo.anonPlural'
                              : 'sorteo.anon',
                            { n: result.anonymous_count },
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    {t('sorteo.remainingSession', { n: result.remaining })}
                  </p>

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => {
                        setShowConfetti(false)
                        clearResult()
                      }}
                      className="btn-ghost flex-1"
                    >
                      {t('common.close')}
                    </button>
                    <button
                      onClick={() => {
                        setShowConfetti(false)
                        setRevealed(false)
                        clearResult()
                        void doDraw()
                      }}
                      className="btn-primary flex-1"
                    >
                      {t('common.again')} 🎲
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
                      {t('sorteo.manageUsers')}
                    </button>
                  )}
                </motion.div>
              )}
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
