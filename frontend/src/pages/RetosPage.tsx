import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Modal } from '../components/Modal'
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { Challenge } from '../types'

export function RetosPage() {
  const { challenges, addChallenge, editChallenge, removeChallenge } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Challenge | null>(null)
  const [confirmDel, setConfirmDel] = useState<Challenge | null>(null)

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
          <h1 className="text-2xl font-extrabold">Retos</h1>
          <p className="text-sm text-slate-400">
            {challenges.length} retos · {used} usados
          </p>
        </div>
        <button onClick={openNew} className="btn-primary !px-4">
          <PlusIcon className="h-5 w-5" />
          Añadir
        </button>
      </header>

      {challenges.length === 0 && (
        <div className="glass mt-6 rounded-3xl p-8 text-center text-slate-400">
          <span className="mb-2 block text-4xl">📭</span>
          Aún no hay retos. ¡Crea el primero!
        </div>
      )}

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {challenges.map((c) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className={`glass rounded-3xl p-4 ${
                c.is_used ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold">{c.title}</h3>
                    {c.is_used && (
                      <span className="shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                        Usado
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                      {c.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-neon-purple/20 px-3 py-1 text-xs font-bold text-neon-purple">
                  👥 {c.required_users}
                </span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => openEdit(c)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10"
                  aria-label={`Editar ${c.title}`}
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDel(c)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                  aria-label={`Borrar ${c.title}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </motion.li>
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
        title="Borrar reto"
      >
        <p className="text-sm text-slate-300">
          ¿Seguro que quieres borrar{' '}
          <span className="font-bold">{confirmDel?.title}</span>?
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (confirmDel) await removeChallenge(confirmDel.id)
              setConfirmDel(null)
            }}
            className="btn-danger flex-1"
          >
            Borrar
          </button>
        </div>
      </Modal>
    </div>
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
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [players, setPlayers] = useState(1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Inicializa los campos cada vez que se abre el formulario
  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setDescription(editing?.description ?? '')
      setPlayers(editing?.required_users ?? 1)
      setError('')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('El título es obligatorio.')
      return
    }
    if (players < 1) {
      setError('El nº de jugadores debe ser al menos 1.')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        required_users: players,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar reto' : 'Nuevo reto'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            Título
          </label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Imita a un famoso"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            Descripción
          </label>
          <textarea
            className="input min-h-[80px] resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalles del reto (opcional)"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            Nº de jugadores
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
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
