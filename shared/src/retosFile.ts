// Utilidades puras para exportar/importar retos a un fichero JSON compartible.
// Compartidas por web y móvil (la web mantiene además su propia copia en
// frontend/src/lib/retosFile.ts; el formato debe permanecer idéntico).

import type { Challenge, ChallengeInput } from './types'

const APP_TAG = 'retobox'
const FORMAT_VERSION = 1

export const EXPORT_FILENAME = 'retobox-retos.json'
export const EXPORT_MIME = 'application/json'

// Forma del fichero exportado. Solo guardamos la definición del reto; los
// campos volátiles (id, is_used, created_at) se omiten a propósito para que el
// fichero sirva tanto para compartir como para backup/restauración.
interface RetosFile {
  app: typeof APP_TAG
  version: number
  exported_at: string
  challenges: ChallengeInput[]
}

function toExportChallenge(c: Challenge): ChallengeInput {
  return {
    title: c.title,
    description: c.description,
    required_users: c.required_users,
    involved_users: c.involved_users,
    repeatable: c.repeatable,
  }
}

// Construye el contenido JSON (texto) del fichero de exportación.
export function buildRetosFileContent(challenges: Challenge[]): string {
  const data: RetosFile = {
    app: APP_TAG,
    version: FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    challenges: challenges.map(toExportChallenge),
  }
  return JSON.stringify(data, null, 2)
}

// Extrae los retos de un fichero importado. Acepta tanto el formato con
// envoltorio { challenges: [...] } como una lista pelada de retos, y descarta
// entradas sin título. Lanza un Error con mensaje en español si no es válido.
export function parseRetosFile(text: string): ChallengeInput[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Se lanza la CLAVE i18n; la capa de UI la traduce (ver mobile/src/lib/i18n).
    throw new Error('file.invalidJson')
  }

  const rawList = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'challenges' in parsed
      ? (parsed as { challenges: unknown }).challenges
      : null

  if (!Array.isArray(rawList)) {
    throw new Error('file.noRetosList')
  }

  const challenges: ChallengeInput[] = []
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const title = typeof obj.title === 'string' ? obj.title.trim() : ''
    if (!title) continue
    const required =
      typeof obj.required_users === 'number' && obj.required_users >= 1
        ? Math.floor(obj.required_users)
        : 1
    const involved =
      typeof obj.involved_users === 'number' && obj.involved_users >= required
        ? Math.floor(obj.involved_users)
        : null
    challenges.push({
      title,
      description: typeof obj.description === 'string' ? obj.description : '',
      required_users: required,
      involved_users: involved,
      repeatable: obj.repeatable === true,
    })
  }

  if (challenges.length === 0) {
    throw new Error('file.noRetosValid')
  }
  return challenges
}
