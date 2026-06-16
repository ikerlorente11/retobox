import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Modal } from '../components/Modal'
import { Confetti } from '../components/Confetti'
import { WordReel } from '../components/reveal/WordReel'
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons'
import { playReveal } from '../lib/sound'
import { useT } from '../lib/i18n'
import type { RevealStyle, WordGroup } from '../types'

interface ComboItem {
  id: number
  name: string
  words: string[]
  winner: string
}

export function CombosPage() {
  const {
    wordGroups,
    selectedGroupIds,
    addWordGroup,
    editWordGroup,
    removeWordGroup,
    toggleGroupSelection,
    revealStyle,
    soundEnabled,
  } = useStore()
  const t = useT()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WordGroup | null>(null)
  const [confirmDel, setConfirmDel] = useState<WordGroup | null>(null)
  const [combo, setCombo] = useState<{ spinId: number; items: ComboItem[] } | null>(
    null,
  )
  const [groupsOpen, setGroupsOpen] = useState(true)

  // Grupos que entran en la tirada: seleccionados y con al menos una palabra.
  const activeGroups = wordGroups.filter(
    (g) => selectedGroupIds.includes(g.id) && g.words.length > 0,
  )
  const canSpin = activeGroups.length > 0

  function roll(spinId: number) {
    const items: ComboItem[] = activeGroups.map((g) => ({
      id: g.id,
      name: g.name,
      words: g.words,
      winner: g.words[Math.floor(Math.random() * g.words.length)],
    }))
    setCombo({ spinId, items })
  }

  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }
  function openEdit(g: WordGroup) {
    setEditing(g)
    setModalOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{t('combos.title')}</h1>
          <p className="text-sm text-slate-400">{t('combos.subtitle')}</p>
        </div>
        <button onClick={openNew} className="btn-primary !px-4">
          <PlusIcon className="h-5 w-5" />
          {t('combos.group')}
        </button>
      </header>

      {wordGroups.length === 0 ? (
        <div className="glass mt-6 rounded-3xl p-8 text-center text-slate-400">
          <span className="mb-2 block text-4xl">🎰</span>
          {t('combos.empty')}
        </div>
      ) : (
        <>
          {/* Contenedor que rellena bajo la cabecera. ¡Jugar! va CENTRADO de
              forma absoluta -> queda SIEMPRE fijo en el medio. Los grupos crecen
              hacia abajo solo hasta justo encima del botón (max-h) y, si no caben,
              hacen scroll: nunca lo pisan ni lo desplazan. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <section className="glass relative z-10 flex max-h-[calc(50%-2rem)] min-h-0 flex-col rounded-3xl p-3">
              <button
                onClick={() => setGroupsOpen((o) => !o)}
                className="flex w-full shrink-0 items-center justify-between gap-3 px-1"
                aria-expanded={groupsOpen}
              >
                <span className="text-sm font-semibold text-slate-300">
                  {t('combos.groupsCount', { n: wordGroups.length })}
                  {activeGroups.length > 0 && (
                    <span className="text-slate-500">
                      {' '}
                      {t('combos.activeCount', { n: activeGroups.length })}
                    </span>
                  )}
                </span>
                <motion.span
                  animate={{ rotate: groupsOpen ? 180 : 0 }}
                  className="text-slate-400"
                  aria-hidden
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </button>

              {groupsOpen && (
                /* flex-1 + min-h-0 + overflow-y-auto: crece hasta el límite (max-h
                   de la tarjeta) y entonces hace scroll. p-1 deja aire para el aro. */
                <ul className="mt-2 flex min-h-0 flex-1 flex-wrap content-start gap-2.5 overflow-y-auto p-1">
                  <AnimatePresence initial={false}>
                    {wordGroups.map((g) => (
                      <GroupCard
                        key={g.id}
                        g={g}
                        selected={selectedGroupIds.includes(g.id)}
                        onToggle={() =>
                          g.words.length > 0 && toggleGroupSelection(g.id)
                        }
                        onEdit={() => openEdit(g)}
                        onDelete={() => setConfirmDel(g)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>

            {/* ¡Jugar! centrado de forma absoluta -> fijo en el medio.
                pointer-events-none deja clicar los grupos que tiene detrás. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
              <motion.button
                onClick={() => roll(Date.now())}
                disabled={!canSpin}
                whileHover={{ scale: canSpin ? 1.04 : 1 }}
                whileTap={{ scale: canSpin ? 0.96 : 1 }}
                className="btn-primary pointer-events-auto !rounded-full !px-12 !py-4 text-lg disabled:opacity-50"
              >
                {t('combos.play')}
              </motion.button>
              <p className="max-w-xs text-center text-xs text-slate-500">
                {canSpin
                  ? t('combos.willRoll', {
                      n: activeGroups.length,
                      reels: t(
                        activeGroups.length === 1 ? 'combos.reel' : 'combos.reels',
                      ),
                    })
                  : t('combos.needGroup')}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Formulario crear/editar grupo */}
      <GroupForm
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={async (data) => {
          if (editing) await editWordGroup(editing.id, data)
          else await addWordGroup(data)
          setModalOpen(false)
        }}
      />

      {/* Confirmar borrado */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={t('combos.delTitle')}
      >
        <p className="text-sm text-slate-300">
          {t('combos.delConfirmPre')}
          <span className="font-bold">{confirmDel?.name}</span>
          {t('combos.delConfirmPost')}
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">
            {t('common.cancel')}
          </button>
          <button
            onClick={async () => {
              if (confirmDel) await removeWordGroup(confirmDel.id)
              setConfirmDel(null)
            }}
            className="btn-danger flex-1"
          >
            {t('common.delete')}
          </button>
        </div>
      </Modal>

      {/* Overlay de tirada */}
      <AnimatePresence>
        {combo && (
          <ComboReveal
            items={combo.items}
            spinId={combo.spinId}
            style={revealStyle}
            soundEnabled={soundEnabled}
            onAgain={() => roll(combo.spinId + 1)}
            onClose={() => setCombo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta de grupo (seleccionable)
// ---------------------------------------------------------------------------

function GroupCard({
  g,
  selected,
  onToggle,
  onEdit,
  onDelete,
}: {
  g: WordGroup
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  // Colapsada por defecto: solo casilla + nombre. Al desplegar aparece el resto.
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const empty = g.words.length === 0
  const active = selected && !empty

  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`glass transition-colors ${
        active ? 'ring-2 ring-neon-purple/70 shadow-glow' : ''
      } ${empty ? 'opacity-70' : ''} ${
        expanded ? 'basis-full rounded-3xl p-4' : 'rounded-2xl px-3 py-2'
      }`}
    >
      {/* Cabecera (clic = desplegar/colapsar). Colapsada ocupa lo mínimo. */}
      <div
        className="flex cursor-pointer items-center justify-between gap-2.5"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Casilla de selección (independiente del desplegado) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (!empty) onToggle()
            }}
            disabled={empty}
            aria-pressed={active}
            aria-label={`Seleccionar ${g.name}`}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] transition ${
              active
                ? 'border-transparent bg-neon-gradient text-white'
                : 'border-white/25 text-transparent hover:border-white/50'
            } ${empty ? 'cursor-not-allowed' : ''}`}
          >
            ✓
          </button>
          <h3 className="max-w-[11rem] truncate text-sm font-bold">{g.name}</h3>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          className="shrink-0 text-slate-400"
          aria-hidden
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </div>

      {/* Contenido desplegable */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {empty ? (
              <p className="mt-3 text-xs text-slate-500">{t('combos.noWords')}</p>
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">
                  {t('combos.wordsCount', { n: g.words.length })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.words.map((w, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-300"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10"
                aria-label={`Editar ${g.name}`}
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                aria-label={`Borrar ${g.name}`}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Overlay de tirada (N rodillos)
// ---------------------------------------------------------------------------

function ComboReveal({
  items,
  spinId,
  style,
  soundEnabled,
  onAgain,
  onClose,
}: {
  items: ComboItem[]
  spinId: number
  style: RevealStyle
  soundEnabled: boolean
  onAgain: () => void
  onClose: () => void
}) {
  const t = useT()
  const [settled, setSettled] = useState(0)
  const done = items.length > 0 && settled >= items.length

  // Reinicia el contador en cada tirada.
  useEffect(() => {
    setSettled(0)
  }, [spinId])

  // Un único sonido + confeti al asentarse todos los rodillos.
  useEffect(() => {
    if (done && soundEnabled) playReveal()
  }, [done, soundEnabled])

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/80 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {done && <Confetti />}
      <motion.div
        key={spinId}
        className="glass-strong relative flex max-h-[90vh] w-full max-w-md flex-col rounded-4xl p-4 md:max-w-2xl md:p-6"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        <p className="mb-4 shrink-0 text-center text-xs uppercase tracking-widest text-slate-400">
          {t('combos.combination')}
        </p>

        {/* Área de rodillos: envuelve en varias columnas y hace scroll si no
            caben (p. ej. con muchos grupos) para que no se corte ninguno. */}
        <div className="flex min-h-0 flex-1 flex-wrap items-start justify-center gap-3 overflow-y-auto py-1">
          {items.map((it, i) => (
            <WordReel
              key={`${spinId}-${it.id}`}
              style={style}
              label={it.name}
              winner={it.winner}
              words={it.words}
              delay={i * 0.12}
              onSettled={() => setSettled((s) => s + 1)}
            />
          ))}
        </div>

        <motion.div
          className="mt-4 flex shrink-0 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: done ? 1 : 0.4 }}
        >
          <button onClick={onClose} className="btn-ghost flex-1">
            {t('common.close')}
          </button>
          <button onClick={onAgain} className="btn-primary flex-1">
            {t('common.again')}
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Formulario crear/editar grupo
// ---------------------------------------------------------------------------

function GroupForm({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean
  editing: WordGroup | null
  onClose: () => void
  onSubmit: (data: { name: string; words: string[] }) => Promise<void>
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [wordsText, setWordsText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setWordsText(editing?.words.join('\n') ?? '')
      setError('')
    }
  }, [open, editing])

  const parsedWords = wordsText
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('users.errName'))
      return
    }
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), words: parsedWords })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('retos.form.errSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('combos.editGroup') : t('combos.newGroup')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            {t('combos.groupName')}
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('combos.groupNamePh')}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            {t('combos.words')}{' '}
            <span className="font-normal text-slate-500">
              {t('combos.wordsHelper', { n: parsedWords.length })}
            </span>
          </label>
          <textarea
            className="input min-h-[180px] resize-y"
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
            placeholder={'Cocina\nSalón\nJardín'}
          />
          <p className="mt-1.5 text-xs text-slate-500">{t('combos.wordsNote')}</p>
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? t('common.saving') : editing ? t('common.save') : t('common.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
