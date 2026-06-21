// Store global (zustand) de la app móvil. Es un calco del store de la web, pero
// en vez de un cliente HTTP usa el repositorio SQLite local (offline). Las
// preferencias (tema, estilo de revelado, sonido) se persisten con AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { DomainError } from '@retobox/shared'
import { LANG_KEY, translate, type Lang } from './lib/i18n'
import type {
  Challenge,
  ChallengeInput,
  ChallengeUpdate,
  Collection,
  CollectionInput,
  CollectionUpdateInput,
  DrawMode,
  DrawResult,
  ImportResult,
  Stats,
  User,
  UserInput,
  WordGroup,
  WordGroupInput,
  WordGroupUpdateInput,
} from '@retobox/shared'
import { repository } from './db/sqliteRepository'

export type RevealStyle = 'slot' | 'dice'
export type Theme = 'dark' | 'light'

const REVEAL_KEY = 'retobox.revealStyle'
const SOUND_KEY = 'retobox.sound'
const THEME_KEY = 'retobox.theme'
const COLLECTION_KEY = 'retobox.collection'

interface DrawErrorState {
  status: number
  detail: string
}

interface AppState {
  challenges: Challenge[]
  users: User[]
  stats: Stats | null

  // colecciones (agrupan los retos; la activa filtra Retos y el Sorteo)
  collections: Collection[]
  activeCollectionId: number | null

  // mezclador (grupos de palabras)
  wordGroups: WordGroup[]
  selectedGroupIds: number[]

  mode: DrawMode
  selectedUserIds: number[]
  drawing: boolean
  result: DrawResult | null
  drawId: number
  drawError: DrawErrorState | null

  revealStyle: RevealStyle
  soundEnabled: boolean
  theme: Theme
  lang: Lang

  loading: boolean
  loadError: string | null

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
  editCollection: (id: number, input: CollectionUpdateInput) => Promise<void>
  removeCollection: (id: number) => Promise<void>

  addChallenge: (input: ChallengeInput) => Promise<void>
  editChallenge: (id: number, input: ChallengeUpdate) => Promise<void>
  removeChallenge: (id: number) => Promise<void>
  importChallenges: (inputs: ChallengeInput[]) => Promise<ImportResult>

  addUser: (input: UserInput) => Promise<void>
  removeUser: (id: number) => Promise<void>

  addWordGroup: (input: WordGroupInput) => Promise<void>
  editWordGroup: (id: number, input: WordGroupUpdateInput) => Promise<void>
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

  revealStyle: 'slot',
  soundEnabled: false,
  theme: 'dark',
  lang: 'es',

  loading: true,
  loadError: null,

  bootstrap: async () => {
    set({ loading: true, loadError: null })
    try {
      await repository.init()

      // Cargar preferencias persistidas (no bloquea si fallan).
      const [reveal, sound, theme, storedCollection, langStored] = await Promise.all([
        AsyncStorage.getItem(REVEAL_KEY),
        AsyncStorage.getItem(SOUND_KEY),
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(COLLECTION_KEY),
        AsyncStorage.getItem(LANG_KEY),
      ])

      const [collections, users, wordGroups] = await Promise.all([
        repository.getCollections(),
        repository.getUsers(),
        repository.getWordGroups(),
      ])

      // Colección activa: la guardada si sigue existiendo, si no la primera.
      const stored = Number(storedCollection)
      const activeCollectionId =
        collections.find((collection) => collection.id === stored)?.id ??
        collections[0]?.id ??
        null

      const [challenges, stats] = await Promise.all([
        repository.getChallenges(activeCollectionId ?? undefined),
        repository.getStats(activeCollectionId ?? undefined),
      ])

      // Por defecto se seleccionan los grupos que ya tienen palabras.
      const selectedGroupIds = wordGroups
        .filter((group) => group.words.length > 0)
        .map((group) => group.id)

      if (activeCollectionId != null) {
        void AsyncStorage.setItem(COLLECTION_KEY, String(activeCollectionId))
      }

      set({
        collections,
        activeCollectionId,
        challenges,
        users,
        stats,
        wordGroups,
        selectedGroupIds,
        revealStyle: reveal === 'dice' ? 'dice' : 'slot',
        soundEnabled: sound === '1',
        theme: theme === 'light' ? 'light' : 'dark',
        lang: langStored === 'en' ? 'en' : 'es',
        loading: false,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : translate(get().lang, 'app.loadError')
      set({ loading: false, loadError: message })
    }
  },

  refreshStats: async () => {
    try {
      const stats = await repository.getStats(get().activeCollectionId ?? undefined)
      set({ stats })
    } catch {
      /* silencioso */
    }
  },

  setMode: (mode) => set({ mode, drawError: null }),

  toggleUserSelection: (id) => {
    const current = get().selectedUserIds
    set({
      selectedUserIds: current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    })
  },

  clearSelection: () => set({ selectedUserIds: [] }),

  doDraw: async () => {
    const { mode, selectedUserIds, users } = get()
    set({ drawing: true, drawError: null, result: null })

    // modo selected sin usuarios elegidos (existiendo usuarios) -> aviso local.
    if (mode === 'selected' && users.length > 0 && selectedUserIds.length === 0) {
      set({
        drawing: false,
        drawError: { status: 400, detail: translate(get().lang, 'app.selectUser') },
      })
      return
    }

    try {
      const collectionId = get().activeCollectionId ?? undefined
      const request =
        mode === 'selected' && users.length > 0
          ? { mode, selected_user_ids: selectedUserIds, collection_id: collectionId }
          : { mode: 'random' as const, collection_id: collectionId }
      const result = await repository.draw(request)
      // result.remaining = cartas que aún no han salido (incluye repetibles la
      // primera vez); el contador muestra eso. refreshStats luego reconcilia.
      set((state) => ({
        result,
        drawId: state.drawId + 1,
        drawing: false,
        challenges: state.challenges.map((challenge) =>
          challenge.id === result.challenge.id
            ? { ...challenge, is_used: result.challenge.is_used }
            : challenge,
        ),
        stats: state.stats
          ? {
              ...state.stats,
              available: result.remaining,
              used: state.stats.total - result.remaining,
            }
          : state.stats,
      }))
      void get().refreshStats()
    } catch (error) {
      if (error instanceof DomainError) {
        set({ drawing: false, drawError: { status: error.status, detail: error.message } })
      } else {
        set({
          drawing: false,
          drawError: { status: 0, detail: translate(get().lang, 'app.unexpectedDraw') },
        })
      }
    }
  },

  clearResult: () => set({ result: null }),

  resetSession: async () => {
    const { reset } = await repository.reset(get().activeCollectionId ?? undefined)
    set((state) => ({
      challenges: state.challenges.map((challenge) => ({ ...challenge, is_used: false })),
      result: null,
      drawError: null,
    }))
    await get().refreshStats()
    return reset
  },

  setActiveCollection: async (id) => {
    void AsyncStorage.setItem(COLLECTION_KEY, String(id))
    set({ activeCollectionId: id, result: null, drawError: null })
    try {
      const [challenges, stats] = await Promise.all([
        repository.getChallenges(id),
        repository.getStats(id),
      ])
      set({ challenges, stats })
    } catch {
      /* silencioso */
    }
  },

  addCollection: async (input) => {
    const collection = await repository.createCollection(input)
    set((state) => ({ collections: [...state.collections, collection] }))
    // Cambiamos a la colección recién creada (vacía, lista para añadir retos).
    await get().setActiveCollection(collection.id)
  },

  editCollection: async (id, input) => {
    const updated = await repository.updateCollection(id, input)
    set((state) => ({
      collections: state.collections.map((collection) =>
        collection.id === id ? updated : collection,
      ),
    }))
  },

  removeCollection: async (id) => {
    await repository.deleteCollection(id)
    const wasActive = get().activeCollectionId === id
    set((state) => ({ collections: state.collections.filter((c) => c.id !== id) }))
    if (wasActive) {
      const first = get().collections[0]
      if (first) {
        await get().setActiveCollection(first.id)
      }
    }
  },

  addChallenge: async (input) => {
    const collectionId = get().activeCollectionId ?? undefined
    const challenge = await repository.createChallenge({
      ...input,
      collection_id: input.collection_id ?? collectionId,
    })
    set((state) => ({ challenges: [...state.challenges, challenge] }))
    void get().refreshStats()
  },

  editChallenge: async (id, input) => {
    const updated = await repository.updateChallenge(id, input)
    set((state) => ({
      challenges: state.challenges.map((challenge) =>
        challenge.id === id ? updated : challenge,
      ),
    }))
    void get().refreshStats()
  },

  removeChallenge: async (id) => {
    await repository.deleteChallenge(id)
    set((state) => ({
      challenges: state.challenges.filter((challenge) => challenge.id !== id),
    }))
    void get().refreshStats()
  },

  importChallenges: async (inputs) => {
    const collectionId = get().activeCollectionId ?? undefined
    const res = await repository.importChallenges(inputs, collectionId)
    // Recargamos la lista de la colección activa para reflejar lo insertado.
    if (res.imported > 0) {
      const challenges = await repository.getChallenges(collectionId)
      set({ challenges })
      void get().refreshStats()
    }
    return res
  },

  addUser: async (input) => {
    const user = await repository.createUser(input)
    set((state) => ({ users: [...state.users, user] }))
    void get().refreshStats()
  },

  removeUser: async (id) => {
    await repository.deleteUser(id)
    set((state) => ({
      users: state.users.filter((user) => user.id !== id),
      selectedUserIds: state.selectedUserIds.filter((value) => value !== id),
    }))
    void get().refreshStats()
  },

  addWordGroup: async (input) => {
    const group = await repository.createWordGroup(input)
    set((state) => ({
      wordGroups: [...state.wordGroups, group],
      // Se autoselecciona si nace con palabras.
      selectedGroupIds:
        group.words.length > 0
          ? [...state.selectedGroupIds, group.id]
          : state.selectedGroupIds,
    }))
  },

  editWordGroup: async (id, input) => {
    const updated = await repository.updateWordGroup(id, input)
    set((state) => {
      const hasWords = updated.words.length > 0
      const wasSelected = state.selectedGroupIds.includes(id)
      // Si se queda sin palabras, deja de estar seleccionable.
      const selectedGroupIds = !hasWords
        ? state.selectedGroupIds.filter((value) => value !== id)
        : wasSelected
          ? state.selectedGroupIds
          : [...state.selectedGroupIds, id]
      return {
        wordGroups: state.wordGroups.map((group) => (group.id === id ? updated : group)),
        selectedGroupIds,
      }
    })
  },

  removeWordGroup: async (id) => {
    await repository.deleteWordGroup(id)
    set((state) => ({
      wordGroups: state.wordGroups.filter((group) => group.id !== id),
      selectedGroupIds: state.selectedGroupIds.filter((value) => value !== id),
    }))
  },

  importWordGroups: async (inputs) => {
    const res = await repository.importWordGroups(inputs)
    if (res.imported > 0) {
      const prevIds = new Set(get().wordGroups.map((group) => group.id))
      const wordGroups = await repository.getWordGroups()
      // Autoselecciona los grupos nuevos que tengan palabras.
      const newSelectable = wordGroups
        .filter((group) => !prevIds.has(group.id) && group.words.length > 0)
        .map((group) => group.id)
      set((state) => ({
        wordGroups,
        selectedGroupIds: [...new Set([...state.selectedGroupIds, ...newSelectable])],
      }))
    }
    return res
  },

  toggleGroupSelection: (id) => {
    const current = get().selectedGroupIds
    set({
      selectedGroupIds: current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    })
  },

  setRevealStyle: (style) => {
    void AsyncStorage.setItem(REVEAL_KEY, style)
    set({ revealStyle: style })
  },

  setSoundEnabled: (on) => {
    void AsyncStorage.setItem(SOUND_KEY, on ? '1' : '0')
    set({ soundEnabled: on })
  },

  setLang: (lang) => {
    void AsyncStorage.setItem(LANG_KEY, lang)
    set({ lang })
  },

  setTheme: (theme) => {
    void AsyncStorage.setItem(THEME_KEY, theme)
    set({ theme })
  },
}))
