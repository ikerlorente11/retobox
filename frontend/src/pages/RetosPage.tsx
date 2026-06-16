import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { Modal } from '../components/Modal'
import {
  CollectionIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons'
import { useT } from '../lib/i18n'
import type { Challenge, Collection } from '../types'

export function RetosPage() {
  const { challenges, addChallenge, editChallenge, removeChallenge } = useStore()
  const t = useT()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Challenge | null>(null)
  const [confirmDel, setConfirmDel] = useState<Challenge | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }
  function openEdit(c: Challenge) {
    setEditing(c)
    setModalOpen(true)
  }

  const used = challenges.filter((c) => c.is_used).length

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{t('retos.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('retos.subtitle', { count: challenges.length, used })}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary !px-4">
          <PlusIcon className="h-5 w-5" />
          {t('common.add')}
        </button>
      </header>

      <CollectionSelector />

      {challenges.length === 0 && (
        <div className="glass mt-6 rounded-3xl p-8 text-center text-slate-400">
          <span className="mb-2 block text-4xl">📭</span>
          {t('retos.empty')}
        </div>
      )}

      <ul className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              c={c}
              expanded={expandedId === c.id}
              onToggle={() =>
                setExpandedId((id) => (id === c.id ? null : c.id))
              }
              onEdit={() => openEdit(c)}
              onDelete={() => setConfirmDel(c)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <ChallengeForm
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={async (data) => {
          if (editing) await editChallenge(editing.id, data)
          else await addChallenge(data)
          setModalOpen(false)
        }}
      />

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={t('retos.delTitle')}
      >
        <p className="text-sm text-slate-300">
          {t('retos.delConfirmPre')}
          <span className="font-bold">{confirmDel?.title}</span>
          {t('retos.delConfirmPost')}
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">
            {t('common.cancel')}
          </button>
          <button
            onClick={async () => {
              if (confirmDel) await removeChallenge(confirmDel.id)
              setConfirmDel(null)
            }}
            className="btn-danger flex-1"
          >
            {t('common.delete')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Altura (px) que ocupa la previsualización colapsada (~2 líneas de text-sm).
const COLLAPSED_DESC_H = 40

function ChallengeCard({
  c,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  c: Challenge
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useT()
  const descRef = useRef<HTMLParagraphElement>(null)
  const [fullH, setFullH] = useState<number | null>(null)

  // Medimos la altura real del texto antes de pintar para animar de forma
  // controlada (de la altura colapsada a la completa) sin saltos ni rebotes.
  useLayoutEffect(() => {
    if (descRef.current) setFullH(descRef.current.scrollHeight)
  }, [c.description])

  // Solo es desplegable si el texto no cabe ya en la vista colapsada.
  const expandable = fullH != null && fullH > COLLAPSED_DESC_H + 1
  const collapsedH = fullH != null ? Math.min(fullH, COLLAPSED_DESC_H) : COLLAPSED_DESC_H

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      onClick={() => expandable && onToggle()}
      className={`glass rounded-3xl p-4 transition-colors ${
        c.is_used ? 'opacity-60' : ''
      } ${expandable ? 'cursor-pointer hover:bg-white/[0.07]' : ''}`}
      aria-expanded={expandable ? expanded : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold">{c.title}</h3>
            {c.repeatable && (
              <span className="shrink-0 rounded-full bg-neon-purple/20 px-2 py-0.5 text-[10px] font-semibold text-neon-purple">
                🔁 {t('retos.repeatable')}
              </span>
            )}
            {c.is_used && !c.repeatable && (
              <span className="shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                {t('retos.used')}
              </span>
            )}
          </div>
          {c.description && (
            <motion.div
              initial={false}
              animate={{ height: expanded ? (fullH ?? 'auto') : collapsedH }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="mt-1 overflow-hidden"
            >
              <p
                ref={descRef}
                className="whitespace-pre-wrap text-sm leading-5 text-slate-400"
              >
                {c.description}
              </p>
            </motion.div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-neon-purple/20 px-3 py-1 text-xs font-bold text-neon-purple">
            👥 {c.required_users}
            {c.involved_users != null && (
              <span className="text-neon-purple/70"> / {c.involved_users}</span>
            )}
          </span>
          {expandable && (
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              className="text-slate-400"
              aria-hidden
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10"
          aria-label={`Editar ${c.title}`}
        >
          <EditIcon className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
          aria-label={`Borrar ${c.title}`}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </motion.li>
  )
}

// Desplegable de colecciones: cambia la activa y permite crear/renombrar/borrar.
function CollectionSelector() {
  const {
    collections,
    activeCollectionId,
    setActiveCollection,
    addCollection,
    editCollection,
    removeCollection,
  } = useStore()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<
    null | { mode: 'new' | 'rename'; id?: number; name: string }
  >(null)
  const [confirmDel, setConfirmDel] = useState<Collection | null>(null)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const active = collections.find((c) => c.id === activeCollectionId) ?? null

  // Cerrar el menú al hacer clic fuera.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !form.name.trim()) return
    setSaving(true)
    try {
      if (form.mode === 'new') await addCollection({ name: form.name.trim() })
      else if (form.id != null)
        await editCollection(form.id, { name: form.name.trim() })
      setForm(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2.5"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CollectionIcon className="h-5 w-5 shrink-0 text-neon-purple" />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500">
              {t('col.label')}
            </span>
            <span className="block truncate font-semibold">
              {active?.name ?? '—'}
            </span>
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} aria-hidden>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass-strong absolute z-30 mt-2 w-full rounded-2xl p-2 shadow-glow"
          >
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {collections.map((c) => (
                <li key={c.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      void setActiveCollection(c.id)
                      setOpen(false)
                    }}
                    className={`min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-sm font-medium ${
                      c.id === activeCollectionId
                        ? 'bg-neon-gradient text-white'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {c.name}
                  </button>
                  <button
                    onClick={() => setForm({ mode: 'rename', id: c.id, name: c.name })}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10"
                    aria-label={`Renombrar ${c.name}`}
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDel(c)}
                    disabled={collections.length <= 1}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-200 hover:bg-rose-500/20 disabled:opacity-30"
                    aria-label={`Borrar ${c.name}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setForm({ mode: 'new', name: '' })}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-neon-purple hover:bg-white/10"
            >
              <PlusIcon className="h-4 w-4" />
              {t('col.new')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crear / renombrar colección */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.mode === 'rename' ? t('col.rename') : t('col.new')}
      >
        <form onSubmit={submitForm} className="flex flex-col gap-4">
          <input
            className="input"
            value={form?.name ?? ''}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, name: e.target.value } : f))
            }
            placeholder={t('col.namePh')}
            autoFocus
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="btn-ghost flex-1"
            >
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving
                ? t('common.saving')
                : form?.mode === 'rename'
                  ? t('common.save')
                  : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmar borrado de colección */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={t('col.delTitle')}
      >
        <p className="text-sm text-slate-300">
          {t('col.delConfirmPre')}
          <span className="font-bold">{confirmDel?.name}</span>
          {t('col.delConfirmPost')}
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">
            {t('common.cancel')}
          </button>
          <button
            onClick={async () => {
              if (confirmDel) await removeCollection(confirmDel.id)
              setConfirmDel(null)
            }}
            className="btn-danger flex-1"
          >
            {t('common.delete')}
          </button>
        </div>
      </Modal>
    </div>
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

function ChallengeForm({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean
  editing: Challenge | null
  onClose: () => void
  onSubmit: (data: {
    title: string
    description: string
    required_users: number
    involved_users: number | null
    repeatable: boolean
  }) => Promise<void>
}) {
  const t = useT()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [players, setPlayers] = useState(1)
  // Campo opcional: se guarda como texto para poder dejarlo vacío.
  const [involved, setInvolved] = useState('')
  const [repeatable, setRepeatable] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Inicializa los campos cada vez que se abre el formulario
  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setDescription(editing?.description ?? '')
      setPlayers(editing?.required_users ?? 1)
      setInvolved(
        editing?.involved_users != null ? String(editing.involved_users) : '',
      )
      setRepeatable(editing?.repeatable ?? false)
      setError('')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError(t('retos.form.errTitle'))
      return
    }
    if (players < 1) {
      setError(t('retos.form.errPerformers'))
      return
    }
    const involvedTrimmed = involved.trim()
    const involvedValue = involvedTrimmed === '' ? null : parseInt(involvedTrimmed, 10)
    if (involvedValue != null && (Number.isNaN(involvedValue) || involvedValue < players)) {
      setError(t('retos.form.errInvolved'))
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        required_users: players,
        involved_users: involvedValue,
        repeatable,
      })
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
      title={editing ? t('retos.edit') : t('retos.new')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            {t('retos.form.title')}
          </label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('retos.form.titlePh')}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            {t('retos.form.description')}
          </label>
          <textarea
            className="input min-h-[180px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('retos.form.descriptionPh')}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              {t('retos.form.performers')}
            </label>
            <input
              type="number"
              min={1}
              className="input"
              value={players}
              onChange={(e) =>
                setPlayers(Math.max(1, parseInt(e.target.value || '1', 10)))
              }
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              {t('retos.form.involved')}
            </label>
            <input
              type="number"
              min={players}
              className="input"
              value={involved}
              onChange={(e) => setInvolved(e.target.value)}
              placeholder={t('retos.form.optional')}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-500">{t('retos.form.note')}</p>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium text-slate-200">
              🔁 {t('retos.repeatable')}
            </span>
            <span className="text-xs text-slate-500">
              {t('retos.form.repeatableHint')}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-neon-purple"
            checked={repeatable}
            onChange={(e) => setRepeatable(e.target.checked)}
          />
        </label>
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
