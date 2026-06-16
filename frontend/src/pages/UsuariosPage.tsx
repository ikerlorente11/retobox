import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useStore } from '../store'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { PlusIcon, TrashIcon } from '../components/icons'
import { USER_COLORS } from '../lib/colors'
import type { User } from '../types'

export function UsuariosPage() {
  const { users, addUser, removeUser } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(USER_COLORS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<User | null>(null)

  function openNew() {
    setName('')
    setColor(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)])
    setError('')
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    try {
      await addUser({ name: name.trim(), color })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Usuarios</h1>
          <p className="text-sm text-slate-400">{users.length} jugadores</p>
        </div>
        <button onClick={openNew} className="btn-primary !px-4">
          <PlusIcon className="h-5 w-5" />
          Añadir
        </button>
      </header>

      {users.length === 0 && (
        <div className="glass mt-6 rounded-3xl p-8 text-center text-slate-400">
          <span className="mb-2 block text-4xl">🧑‍🤝‍🧑</span>
          No hay usuarios. Sin ellos, el sorteo será aleatorio simple.
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence initial={false}>
          {users.map((u) => (
            <motion.li
              key={u.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass flex items-center gap-3 rounded-3xl p-3"
            >
              <Avatar user={u} size="md" />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {u.name}
              </span>
              <button
                onClick={() => setConfirmDel(u)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                aria-label={`Borrar ${u.name}`}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Nombre
            </label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Lucía"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {USER_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-9 w-9 rounded-full transition ${
                    color === c
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-800 scale-110'
                      : ''
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost flex-1"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Borrar usuario"
      >
        <p className="text-sm text-slate-300">
          ¿Seguro que quieres borrar a{' '}
          <span className="font-bold">{confirmDel?.name}</span>?
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (confirmDel) await removeUser(confirmDel.id)
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
