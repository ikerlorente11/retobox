// Exportar/compartir e importar retos en el móvil. La lógica de formato (qué se
// guarda y cómo se parsea) vive en @retobox/shared; aquí solo envolvemos el
// acceso a fichero nativo: escribir + abrir el menú de compartir del sistema
// (WhatsApp, Telegram, Gmail…) y el selector de documentos para importar.

import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import {
  buildGroupsFileContent,
  buildRetosFileContent,
  parseGroupsFile,
  parseRetosFile,
  EXPORT_FILENAME,
  EXPORT_MIME,
  GROUPS_EXPORT_FILENAME,
  type Challenge,
  type ChallengeInput,
  type WordGroup,
  type WordGroupInput,
} from '@retobox/shared'

// Escribe los retos a un fichero en caché y abre el menú nativo para compartir,
// enviando el fichero directamente (WhatsApp, Telegram, correo, etc.).
export async function shareRetos(challenges: Challenge[]): Promise<void> {
  await writeAndShare(EXPORT_FILENAME, buildRetosFileContent(challenges), 'Compartir retos')
}

// Abre el selector de ficheros, lee el JSON y devuelve los retos parseados.
// Devuelve null si el usuario cancela. Lanza Error con CLAVE i18n (la UI la
// traduce) si el fichero no es válido. No se filtra por tipo MIME a propósito:
// los ficheros
// recibidos por mensajería a veces llegan como octet-stream y se ocultarían.
export async function pickRetosFile(): Promise<ChallengeInput[] | null> {
  const text = await pickJsonFile()
  return text === null ? null : parseRetosFile(text)
}

// Igual que shareRetos pero para los grupos de palabras (Combos).
export async function shareGroups(groups: WordGroup[]): Promise<void> {
  await writeAndShare(GROUPS_EXPORT_FILENAME, buildGroupsFileContent(groups), 'Compartir combos')
}

// Selector de fichero para importar grupos. Devuelve null si se cancela.
export async function pickGroupsFile(): Promise<WordGroupInput[] | null> {
  const text = await pickJsonFile()
  return text === null ? null : parseGroupsFile(text)
}

// --- helpers internos ---

async function writeAndShare(filename: string, content: string, dialogTitle: string): Promise<void> {
  const file = new File(Paths.cache, filename)
  if (file.exists) {
    file.delete()
  }
  file.create()
  file.write(content)
  if (!(await Sharing.isAvailableAsync())) {
    // Clave i18n; la capa de UI la traduce (ver mobile/src/lib/i18n).
    throw new Error('settings.shareUnavailable')
  }
  await Sharing.shareAsync(file.uri, { mimeType: EXPORT_MIME, dialogTitle, UTI: 'public.json' })
}

async function pickJsonFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
  if (result.canceled || !result.assets?.[0]) {
    return null
  }
  const file = new File(result.assets[0].uri)
  return file.text()
}
