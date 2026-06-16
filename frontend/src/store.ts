import { create } from 'zustand'
import { api, ApiError } from './api'
import type {
  Challenge,
  ChallengeInput,
  ChallengeUpdate,
  DrawMode,
  DrawResult,
  ImportResult,
  RevealStyle,
  Stats,
  Theme,
  User,
  UserInput,
} from './types'

const REVEAL_KEY = 'retobox.revealStyle'
const SOUND_KEY = 'retobox.sound'
const THEME_KEY = 'retobox.theme'

function loadRevealStyle(): RevealStyle {
  const v = localStorage.getItem(REVEAL_KEY)
  return v === 'dice' || v === 'slot' ? v : 'slot'
}

function loadSound(): boolean {
  return localStorage.getItem(SOUND_KEY) === '1'
}

function loadTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

// Aplica el tema añadiendo/quitando la clase `light` en <html>.
function applyTheme(theme: Theme) {
  const el = document.documentElement
  el.classList.toggle('light', theme === 'light')
  el.style.colorScheme = theme === 'light' ? 'light' : 'dark'
}

// Aplica el tema guardado nada más cargar (antes del primer render -> sin parpadeo).
applyTheme(loadTheme())

interface AppState {
  // datos
  challenges: Challenge[]
  users: User[]
  stats: Stats | null

  // sorteo
  mode: DrawMode
  selectedUserIds: number[]
  drawing: boolean
  result: DrawResult | null
  drawId: number // se incrementa en cada tirada para forzar el remontaje de la animación
  drawError: { status: number; detail: string } | null

  // ajustes
  revealStyle: RevealStyle
  soundEnabled: boolean
  theme: Theme

  // estado general
  loading: boolean
  loadError: string | null

  // acciones
  bootstrap: () => Promise<void>
  refreshStats: () => Promise<void>

  setMode: (mode: DrawMode) => void
  toggleUserSelection: (id: number) => void
  clearSelection: () => void

  doDraw: () => Promise<void>
  clearResult: () => void
  resetSession: () => Promise<number>

  addChallenge: (input: ChallengeInput) => Promise<void>
  editChallenge: (id: number, input: ChallengeUpdate) => Promise<void>
  removeChallenge: (id: number) => Promise<void>
  importChallenges: (inputs: ChallengeInput[]) => Promise<ImportResult>

  addUser: (input: UserInput) => Promise<void>
  removeUser: (id: number) => Promise<void>

  setRevealStyle: (style: RevealStyle) => void
  setSoundEnabled: (on: boolean) => void
  setTheme: (theme: Theme) => void
}

export const useStore = create<AppState>((set, get) => ({
  challenges: [],
  users: [],
  stats: null,

  mode: 'random',
  selectedUserIds: [],
  drawing: false,
  result: null,
  drawId: 0,
  drawError: null,

  revealStyle: loadRevealStyle(),
  soundEnabled: loadSound(),
  theme: loadTheme(),

  loading: true,
  loadError: null,

  bootstrap: async () => {
    set({ loading: true, loadError: null })
    try {
      const [challenges, users, stats] = await Promise.all([
        api.getChallenges(),
        api.getUsers(),
        api.getStats(),
      ])
      set({ challenges, users, stats, loading: false })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar datos.'
      set({ loading: false, loadError: msg })
    }
  },

  refreshStats: async () => {
    try {
      const stats = await api.getStats()
      set({ stats })
    } catch {
      /* silencioso */
    }
  },

  setMode: (mode) => set({ mode, drawError: null }),

  toggleUserSelection: (id) => {
    const cur = get().selectedUserIds
    set({
      selectedUserIds: cur.includes(id)
        ? cur.filter((x) => x !== id)
        : [...cur, id],
    })
  },

  clearSelection: () => set({ selectedUserIds: [] }),

  doDraw: async () => {
    const { mode, selectedUserIds, users } = get()
    set({ drawing: true, drawError: null, result: null })

    // modo selected sin usuarios elegidos (y existiendo usuarios) -> error local amistoso
    if (mode === 'selected' && users.length > 0 && selectedUserIds.length === 0) {
      set({
        drawing: false,
        drawError: { status: 400, detail: 'Selecciona al menos un usuario.' },
      })
      return
    }

    try {
      const body =
        mode === 'selected' && users.length > 0
          ? { mode, selected_user_ids: selectedUserIds }
          : { mode: 'random' as const }
      const result = await api.draw(body)
      // Reflejar el estado de la carta de forma optimista. Las repetibles no se
      // marcan como usadas (el backend devuelve is_used=false) y por tanto no
      // descuentan del contador; refreshStats luego reconcilia con el servidor.
      const consumed = result.challenge.is_used
      set((s) => ({
        result,
        drawId: s.drawId + 1,
        drawing: false,
        challenges: s.challenges.map((c) =>
          c.id === result.challenge.id
            ? { ...c, is_used: result.challenge.is_used }
            : c,
        ),
        stats:
          s.stats && consumed
            ? {
                ...s.stats,
                used: s.stats.used + 1,
                available: Math.max(0, s.stats.available - 1),
              }
            : s.stats,
      }))
      void get().refreshStats()
    } catch (e) {
      if (e instanceof ApiError) {
        set({ drawing: false, drawError: { status: e.status, detail: e.detail } })
      } else {
        set({
          drawing: false,
          drawError: { status: 0, detail: 'Error inesperado al tirar.' },
        })
      }
    }
  },

  clearResult: () => set({ result: null }),

  resetSession: async () => {
    const { reset } = await api.reset()
    set((s) => ({
      challenges: s.challenges.map((c) => ({ ...c, is_used: false })),
      result: null,
      drawError: null,
    }))
    await get().refreshStats()
    return reset
  },

  addChallenge: async (input) => {
    const c = await api.createChallenge(input)
    set((s) => ({ challenges: [...s.challenges, c] }))
    void get().refreshStats()
  },

  editChallenge: async (id, input) => {
    const updated = await api.updateChallenge(id, input)
    set((s) => ({
      challenges: s.challenges.map((c) => (c.id === id ? updated : c)),
    }))
    void get().refreshStats()
  },

  removeChallenge: async (id) => {
    await api.deleteChallenge(id)
    set((s) => ({ challenges: s.challenges.filter((c) => c.id !== id) }))
    void get().refreshStats()
  },

  importChallenges: async (inputs) => {
    const res = await api.importChallenges(inputs)
    // Recargamos la lista completa para reflejar lo realmente insertado (ids,
    // created_at) y reconciliar el contador de stats.
    if (res.imported > 0) {
      const challenges = await api.getChallenges()
      set({ challenges })
      void get().refreshStats()
    }
    return res
  },

  addUser: async (input) => {
    const u = await api.createUser(input)
    set((s) => ({ users: [...s.users, u] }))
    void get().refreshStats()
  },

  removeUser: async (id) => {
    await api.deleteUser(id)
    set((s) => ({
      users: s.users.filter((u) => u.id !== id),
      selectedUserIds: s.selectedUserIds.filter((x) => x !== id),
    }))
    void get().refreshStats()
  },

  setRevealStyle: (style) => {
    localStorage.setItem(REVEAL_KEY, style)
    set({ revealStyle: style })
  },

  setSoundEnabled: (on) => {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0')
    set({ soundEnabled: on })
  },

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
}))
