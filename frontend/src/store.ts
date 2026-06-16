import { create } from 'zustand'
import { api, ApiError } from './api'
import { LANG_KEY, loadLang, translate } from './lib/i18n'
import type {
  Challenge,
  ChallengeInput,
  ChallengeUpdate,
  Collection,
  CollectionInput,
  DrawMode,
  DrawResult,
  ImportResult,
  Lang,
  RevealStyle,
  Stats,
  Theme,
  User,
  UserInput,
  WordGroup,
  WordGroupInput,
} from './types'

const REVEAL_KEY = 'retobox.revealStyle'
const SOUND_KEY = 'retobox.sound'
const THEME_KEY = 'retobox.theme'
const COLLECTION_KEY = 'retobox.collection'

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

  // colecciones (agrupan los retos; la activa filtra Retos y el Sorteo)
  collections: Collection[]
  activeCollectionId: number | null

  // mezclador (grupos de palabras)
  wordGroups: WordGroup[]
  selectedGroupIds: number[]

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
  lang: Lang

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

  setActiveCollection: (id: number) => Promise<void>
  addCollection: (input: CollectionInput) => Promise<void>
  editCollection: (id: number, input: CollectionInput) => Promise<void>
  removeCollection: (id: number) => Promise<void>

  addChallenge: (input: ChallengeInput) => Promise<void>
  editChallenge: (id: number, input: ChallengeUpdate) => Promise<void>
  removeChallenge: (id: number) => Promise<void>
  importChallenges: (inputs: ChallengeInput[]) => Promise<ImportResult>

  addUser: (input: UserInput) => Promise<void>
  removeUser: (id: number) => Promise<void>

  addWordGroup: (input: WordGroupInput) => Promise<void>
  editWordGroup: (id: number, input: Partial<WordGroupInput>) => Promise<void>
  removeWordGroup: (id: number) => Promise<void>
  importWordGroups: (inputs: WordGroupInput[]) => Promise<ImportResult>
  toggleGroupSelection: (id: number) => void

  setRevealStyle: (style: RevealStyle) => void
  setSoundEnabled: (on: boolean) => void
  setTheme: (theme: Theme) => void
  setLang: (lang: Lang) => void
}

export const useStore = create<AppState>((set, get) => ({
  challenges: [],
  users: [],
  stats: null,

  collections: [],
  activeCollectionId: null,

  wordGroups: [],
  selectedGroupIds: [],

  mode: 'random',
  selectedUserIds: [],
  drawing: false,
  result: null,
  drawId: 0,
  drawError: null,

  revealStyle: loadRevealStyle(),
  soundEnabled: loadSound(),
  theme: loadTheme(),
  lang: loadLang(),

  loading: true,
  loadError: null,

  bootstrap: async () => {
    set({ loading: true, loadError: null })
    try {
      const [collections, users, wordGroups] = await Promise.all([
        api.getCollections(),
        api.getUsers(),
        api.getWordGroups(),
      ])
      // Colección activa: la guardada si sigue existiendo, si no la primera.
      const stored = Number(localStorage.getItem(COLLECTION_KEY))
      const activeCollectionId =
        collections.find((c) => c.id === stored)?.id ??
        collections[0]?.id ??
        null
      const [challenges, stats] = await Promise.all([
        api.getChallenges(activeCollectionId ?? undefined),
        api.getStats(activeCollectionId ?? undefined),
      ])
      // Por defecto se seleccionan los grupos que ya tienen palabras.
      const selectedGroupIds = wordGroups
        .filter((g) => g.words.length > 0)
        .map((g) => g.id)
      if (activeCollectionId != null)
        localStorage.setItem(COLLECTION_KEY, String(activeCollectionId))
      set({
        collections,
        activeCollectionId,
        challenges,
        users,
        stats,
        wordGroups,
        selectedGroupIds,
        loading: false,
      })
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : translate(get().lang, 'app.loadError')
      set({ loading: false, loadError: msg })
    }
  },

  refreshStats: async () => {
    try {
      const stats = await api.getStats(get().activeCollectionId ?? undefined)
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
        drawError: {
          status: 400,
          detail: translate(get().lang, 'app.selectUser'),
        },
      })
      return
    }

    try {
      const collectionId = get().activeCollectionId ?? undefined
      const body =
        mode === 'selected' && users.length > 0
          ? { mode, selected_user_ids: selectedUserIds, collection_id: collectionId }
          : { mode: 'random' as const, collection_id: collectionId }
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
          drawError: {
            status: 0,
            detail: translate(get().lang, 'app.unexpectedDraw'),
          },
        })
      }
    }
  },

  clearResult: () => set({ result: null }),

  resetSession: async () => {
    const { reset } = await api.reset(get().activeCollectionId ?? undefined)
    set((s) => ({
      challenges: s.challenges.map((c) => ({ ...c, is_used: false })),
      result: null,
      drawError: null,
    }))
    await get().refreshStats()
    return reset
  },

  setActiveCollection: async (id) => {
    localStorage.setItem(COLLECTION_KEY, String(id))
    set({ activeCollectionId: id, result: null, drawError: null })
    try {
      const [challenges, stats] = await Promise.all([
        api.getChallenges(id),
        api.getStats(id),
      ])
      set({ challenges, stats })
    } catch {
      /* silencioso */
    }
  },

  addCollection: async (input) => {
    const col = await api.createCollection(input)
    set((s) => ({ collections: [...s.collections, col] }))
    // Cambiamos a la colección recién creada (vacía, lista para añadir retos).
    await get().setActiveCollection(col.id)
  },

  editCollection: async (id, input) => {
    const updated = await api.updateCollection(id, input)
    set((s) => ({
      collections: s.collections.map((c) => (c.id === id ? updated : c)),
    }))
  },

  removeCollection: async (id) => {
    await api.deleteCollection(id)
    const wasActive = get().activeCollectionId === id
    set((s) => ({ collections: s.collections.filter((c) => c.id !== id) }))
    if (wasActive) {
      const first = get().collections[0]
      if (first) await get().setActiveCollection(first.id)
    }
  },

  addChallenge: async (input) => {
    const collectionId = get().activeCollectionId ?? undefined
    const c = await api.createChallenge({
      ...input,
      collection_id: input.collection_id ?? collectionId,
    })
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
    const collectionId = get().activeCollectionId ?? undefined
    const res = await api.importChallenges(inputs, collectionId)
    // Recargamos la lista de la colección activa para reflejar lo insertado.
    if (res.imported > 0) {
      const challenges = await api.getChallenges(collectionId)
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

  addWordGroup: async (input) => {
    const g = await api.createWordGroup(input)
    set((s) => ({
      wordGroups: [...s.wordGroups, g],
      // Se autoselecciona si nace con palabras.
      selectedGroupIds:
        g.words.length > 0
          ? [...s.selectedGroupIds, g.id]
          : s.selectedGroupIds,
    }))
  },

  editWordGroup: async (id, input) => {
    const updated = await api.updateWordGroup(id, input)
    set((s) => {
      const hasWords = updated.words.length > 0
      const wasSelected = s.selectedGroupIds.includes(id)
      // Si se queda sin palabras, deja de estar seleccionable.
      const selectedGroupIds = !hasWords
        ? s.selectedGroupIds.filter((x) => x !== id)
        : wasSelected
          ? s.selectedGroupIds
          : [...s.selectedGroupIds, id]
      return {
        wordGroups: s.wordGroups.map((g) => (g.id === id ? updated : g)),
        selectedGroupIds,
      }
    })
  },

  removeWordGroup: async (id) => {
    await api.deleteWordGroup(id)
    set((s) => ({
      wordGroups: s.wordGroups.filter((g) => g.id !== id),
      selectedGroupIds: s.selectedGroupIds.filter((x) => x !== id),
    }))
  },

  importWordGroups: async (inputs) => {
    const res = await api.importWordGroups(inputs)
    if (res.imported > 0) {
      const prevIds = new Set(get().wordGroups.map((g) => g.id))
      const wordGroups = await api.getWordGroups()
      // Autoselecciona los grupos nuevos que tengan palabras.
      const newSelectable = wordGroups
        .filter((g) => !prevIds.has(g.id) && g.words.length > 0)
        .map((g) => g.id)
      set((s) => ({
        wordGroups,
        selectedGroupIds: [...new Set([...s.selectedGroupIds, ...newSelectable])],
      }))
    }
    return res
  },

  toggleGroupSelection: (id) => {
    const cur = get().selectedGroupIds
    set({
      selectedGroupIds: cur.includes(id)
        ? cur.filter((x) => x !== id)
        : [...cur, id],
    })
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

  setLang: (lang) => {
    localStorage.setItem(LANG_KEY, lang)
    set({ lang })
  },
}))
