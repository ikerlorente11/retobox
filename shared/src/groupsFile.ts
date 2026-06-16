// Utilidades puras para exportar/importar los grupos de palabras (Combos) a
// fichero. Compartidas por web y móvil; el formato debe permanecer idéntico al
// de frontend/src/lib/groupsFile.ts.

import type { WordGroup, WordGroupInput } from './types'

const APP_TAG = 'retobox'
const FORMAT_VERSION = 1

export const GROUPS_EXPORT_FILENAME = 'retobox-combos.json'

interface GroupsFile {
  app: typeof APP_TAG
  version: number
  exported_at: string
  groups: WordGroupInput[]
}

function toExportGroup(g: WordGroup): WordGroupInput {
  return { name: g.name, words: g.words }
}

// Construye el contenido JSON (texto) del fichero de exportación de grupos.
export function buildGroupsFileContent(groups: WordGroup[]): string {
  const data: GroupsFile = {
    app: APP_TAG,
    version: FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    groups: groups.map(toExportGroup),
  }
  return JSON.stringify(data, null, 2)
}

// Extrae los grupos de un fichero importado. Acepta el formato con envoltorio
// { groups: [...] } o una lista pelada, y descarta entradas sin nombre. Lanza
// un Error con mensaje en español si no es válido.
export function parseGroupsFile(text: string): WordGroupInput[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Se lanza la CLAVE i18n; la capa de UI la traduce (ver mobile/src/lib/i18n).
    throw new Error('file.invalidJson')
  }

  const rawList = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'groups' in parsed
      ? (parsed as { groups: unknown }).groups
      : null

  if (!Array.isArray(rawList)) {
    throw new Error('file.noGroupsList')
  }

  const groups: WordGroupInput[] = []
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!name) continue
    const words = Array.isArray(obj.words)
      ? obj.words.filter((w): w is string => typeof w === 'string')
      : []
    groups.push({ name, words })
  }

  if (groups.length === 0) {
    throw new Error('file.noGroupsValid')
  }
  return groups
}
