// i18n ligero propio (sin dependencias). Diccionarios es/en + helpers puros.
// El hook reactivo `useT` vive en ./useT (este módulo NO importa el store, para
// evitar un ciclo store <-> i18n).
import type { Lang } from '../types'

export const LANG_KEY = 'retobox.lang'

export function loadLang(): Lang {
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'
}

type Dict = Record<string, string>

const es: Dict = {
  // común
  'common.add': 'Añadir',
  'common.cancel': 'Cancelar',
  'common.delete': 'Borrar',
  'common.save': 'Guardar',
  'common.create': 'Crear',
  'common.saving': 'Guardando…',
  'common.close': 'Cerrar',
  'common.again': 'Otra vez',
  'common.retry': 'Reintentar',

  // pestañas
  'tab.sorteo': 'Sorteo',
  'tab.retos': 'Retos',
  'tab.usuarios': 'Usuarios',
  'tab.combos': 'Combos',
  'tab.ajustes': 'Ajustes',

  // app
  'app.loadErrorTitle': 'No se pudo cargar',
  'app.loadError': 'Error al cargar datos.',
  'app.unexpectedDraw': 'Error inesperado al tirar.',
  'app.noConnection': 'No se pudo conectar con el servidor.',
  'app.selectUser': 'Selecciona al menos un usuario.',

  // sorteo
  'sorteo.subtitle': 'Retos al azar para tus fiestas',
  'sorteo.remaining': '/ {total} sin salir',
  'sorteo.modeRandom': 'Aleatorio total',
  'sorteo.modeSelected': 'Usuarios seleccionados',
  'sorteo.tirar': '¡Tirar!',
  'sorteo.hintNoUsers':
    'Sin usuarios: modo aleatorio simple. Añade gente en la pestaña Usuarios.',
  'sorteo.hintSelected': 'Solo entrarán los usuarios seleccionados.',
  'sorteo.hintRandom': 'Participan todos los usuarios registrados.',
  'sorteo.outTitle': 'No quedan retos',
  'sorteo.outBody':
    'Habéis agotado todas las cartas de esta sesión. Reinicia para volver a empezar.',
  'sorteo.resetSession': 'Reiniciar sesión',
  'sorteo.resetting': 'Reiniciando…',
  'sorteo.remainingSession': 'Quedan {n} retos por salir',
  'sorteo.anon': '🎭 +{n} anónimo',
  'sorteo.anonPlural': '🎭 +{n} anónimos',
  'sorteo.manageUsers': 'Gestionar usuarios',
  'reveal.elReto': 'El reto',
  'reveal.leTocaA': 'Le toca a',
  'partner.cta': 'Sortear compañero',
  'partner.heading': 'Lo hace con',
  'partner.again': 'Otro compañero',

  // retos
  'retos.title': 'Retos',
  'retos.subtitle': '{count} retos · {used} usados',
  'retos.empty': 'Aún no hay retos. ¡Crea el primero!',
  'retos.repeatable': 'Repetible',
  'retos.used': 'Usado',
  'retos.new': 'Nuevo reto',
  'retos.edit': 'Editar reto',
  'retos.delTitle': 'Borrar reto',
  'retos.delConfirmPre': '¿Seguro que quieres borrar ',
  'retos.delConfirmPost': '?',
  'retos.form.title': 'Título',
  'retos.form.titlePh': 'Ej: Imita a un famoso',
  'retos.form.description': 'Descripción',
  'retos.form.descriptionPh': 'Detalles del reto (opcional)',
  'retos.form.performers': 'Realizan el reto',
  'retos.form.involved': 'Involucrados',
  'retos.form.optional': 'Opcional',
  'retos.form.note':
    'Solo se asignan personas a quienes lo realizan; el resto de involucrados participan de forma anónima. Si lo dejas vacío solo cuentan los que lo realizan.',
  'retos.form.repeatableHint': 'Puede salir más de una vez en la misma sesión.',
  'retos.form.errTitle': 'El título es obligatorio.',
  'retos.form.errPerformers':
    'El nº de personas que realizan el reto debe ser al menos 1.',
  'retos.form.errInvolved':
    'Las personas involucradas no pueden ser menos que las que lo realizan.',
  'retos.form.errSave': 'Error al guardar.',

  // colecciones
  'col.label': 'Colección',
  'col.new': 'Nueva colección',
  'col.rename': 'Renombrar colección',
  'col.namePh': 'Ej: Fiesta, Tranqui, Picante…',
  'col.delTitle': 'Borrar colección',
  'col.delConfirmPre': '¿Seguro que quieres borrar ',
  'col.delConfirmPost': '? Se borrarán también todos sus retos.',

  // usuarios
  'users.title': 'Usuarios',
  'users.subtitle': '{count} jugadores',
  'users.empty': 'No hay usuarios. Sin ellos, el sorteo será aleatorio simple.',
  'users.new': 'Nuevo usuario',
  'users.name': 'Nombre',
  'users.namePh': 'Ej: Lucía',
  'users.color': 'Color',
  'users.errName': 'El nombre es obligatorio.',
  'users.delTitle': 'Borrar usuario',
  'users.delConfirmPre': '¿Seguro que quieres borrar a ',
  'users.delConfirmPost': '?',

  // combos
  'combos.title': 'Combos',
  'combos.subtitle': 'Crea grupos de palabras y combínalos al azar',
  'combos.group': 'Grupo',
  'combos.empty':
    'Aún no hay grupos. Crea uno (p. ej. Zona, Acción, Tiempo) con sus palabras.',
  'combos.play': '¡Jugar!',
  'combos.willRoll': 'Saldrán {n} {reels} con una combinación al azar.',
  'combos.reel': 'rodillo',
  'combos.reels': 'rodillos',
  'combos.needGroup': 'Selecciona al menos un grupo con palabras para jugar.',
  'combos.groupsCount': 'Grupos · {n}',
  'combos.activeCount': '({n} activos)',
  'combos.combination': 'Combinación',
  'combos.noWords': 'Sin palabras todavía. Edítalo para añadirlas.',
  'combos.wordsCount': '{n} palabras',
  'combos.newGroup': 'Nuevo grupo',
  'combos.editGroup': 'Editar grupo',
  'combos.groupName': 'Nombre del grupo',
  'combos.groupNamePh': 'Ej: Zona, Acción, Tiempo…',
  'combos.words': 'Palabras',
  'combos.wordsHelper': '(una por línea · {n})',
  'combos.wordsNote': 'Se ignoran líneas vacías y palabras repetidas.',
  'combos.delTitle': 'Borrar grupo',
  'combos.delConfirmPre': '¿Seguro que quieres borrar ',
  'combos.delConfirmPost': '?',

  // ajustes
  'settings.title': 'Ajustes',
  'settings.language': 'Idioma',
  'settings.languageHint': 'Elige el idioma de la app.',
  'settings.theme': 'Tema',
  'settings.themeHint': 'Elige la apariencia de la app.',
  'settings.dark': 'Oscuro',
  'settings.darkDesc': 'Neón sobre negro',
  'settings.light': 'Claro',
  'settings.lightDesc': 'Luminoso y limpio',
  'settings.reveal': 'Animación de revelado',
  'settings.revealHint': 'Elige cómo se revela el reto al tirar.',
  'settings.slot': 'Tragaperras',
  'settings.slotDesc': 'Rodillos giratorios',
  'settings.dice': 'Dado 3D',
  'settings.diceDesc': 'Cubo que rueda',
  'settings.sound': 'Sonido',
  'settings.soundHint': 'Efectos al girar y revelar.',
  'settings.stats': 'Estadísticas',
  'settings.statTotal': 'Total retos',
  'settings.statAvailable': 'Sin salir',
  'settings.statUsed': 'Salidas',
  'settings.statUsers': 'Usuarios',
  'settings.session': 'Sesión',
  'settings.sessionHint':
    'Reinicia para que todos los retos vuelvan a estar disponibles.',
  'settings.resetDone': '{n} retos reseteados.',
  'settings.resetConfirmTitle': 'Reiniciar sesión',
  'settings.resetConfirmBody':
    'Todos los retos volverán a estar disponibles. ¿Continuar?',
  'settings.retosCard': 'Retos: exportar e importar',
  'settings.retosCardHint':
    'Exporta o importa los retos de la colección activa. Al importar, los retos que ya existan en esa colección no se duplican.',
  'settings.exportRetos': 'Exportar retos',
  'settings.combosCard': 'Combos: exportar e importar',
  'settings.combosCardHint':
    'Descarga tus grupos de palabras en un fichero. Al importar, los grupos que ya existan (por nombre) no se duplican.',
  'settings.exportGroups': 'Exportar grupos',
  'settings.import': 'Importar fichero',
  'settings.importing': 'Importando…',
  'settings.exportedTo': 'Exportado a {file}.',
  'settings.importNothing': 'Nada nuevo: {n} ya existían.',
  'settings.importDone': '{imported} {noun} añadidos{extra}.',
  'settings.importDoneExtra': ' · {n} ya existían',
  'settings.importError': 'No se pudo importar.',
  'noun.retos': 'retos',
  'noun.grupos': 'grupos',

  // accesibilidad / aria-labels
  'aria.nav': 'Navegación principal',
  'common.edit': 'Editar',
  'common.rename': 'Renombrar',
  'common.select': 'Seleccionar',
  'aria.color': 'Color',

  // rodillo de relleno (señuelos) cuando no hay suficientes retos
  'reveal.decoys': 'Reto,Sorpresa,Prenda,Misión',

  // placeholder de palabras de un grupo
  'combos.wordsPh': 'Cocina\nSalón\nJardín',

  // errores de importación de fichero
  'file.invalidJson': 'El fichero no es un JSON válido.',
  'file.noRetosList': 'El fichero no contiene una lista de retos.',
  'file.noRetosValid': 'El fichero no contiene ningún reto válido.',
  'file.noGroupsList': 'El fichero no contiene una lista de grupos.',
  'file.noGroupsValid': 'El fichero no contiene ningún grupo válido.',

  // errores devueltos por el backend (traducidos en el cliente)
  'err.validation': 'Datos no válidos.',
  'err.noChallenges': 'No quedan retos disponibles. Reinicia la sesión.',
  'err.challengeNotFound': 'Reto no encontrado.',
  'err.userNotFound': 'Usuario no encontrado.',
  'err.collectionNotFound': 'Colección no encontrada.',
  'err.cannotDeleteLastCollection': 'No puedes borrar la única colección.',
  'err.groupNotFound': 'Grupo no encontrado.',
  'err.involvedBelowRequired':
    'Las personas involucradas no pueden ser menos que las que realizan el reto.',
}

const en: Dict = {
  'common.add': 'Add',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.create': 'Create',
  'common.saving': 'Saving…',
  'common.close': 'Close',
  'common.again': 'Again',
  'common.retry': 'Retry',

  'tab.sorteo': 'Draw',
  'tab.retos': 'Challenges',
  'tab.usuarios': 'Users',
  'tab.combos': 'Combos',
  'tab.ajustes': 'Settings',

  'app.loadErrorTitle': "Couldn't load",
  'app.loadError': 'Error loading data.',
  'app.unexpectedDraw': 'Unexpected error drawing.',
  'app.noConnection': "Couldn't connect to the server.",
  'app.selectUser': 'Select at least one user.',

  'sorteo.subtitle': 'Random challenges for your parties',
  'sorteo.remaining': '/ {total} not yet drawn',
  'sorteo.modeRandom': 'Fully random',
  'sorteo.modeSelected': 'Selected users',
  'sorteo.tirar': 'Draw!',
  'sorteo.hintNoUsers':
    'No users: simple random mode. Add people in the Users tab.',
  'sorteo.hintSelected': 'Only the selected users will take part.',
  'sorteo.hintRandom': 'All registered users take part.',
  'sorteo.outTitle': 'No challenges left',
  'sorteo.outBody':
    "You've used all the cards this session. Reset to start over.",
  'sorteo.resetSession': 'Reset session',
  'sorteo.resetting': 'Resetting…',
  'sorteo.remainingSession': '{n} challenges left to draw',
  'sorteo.anon': '🎭 +{n} anonymous',
  'sorteo.anonPlural': '🎭 +{n} anonymous',
  'sorteo.manageUsers': 'Manage users',
  'reveal.elReto': 'The challenge',
  'reveal.leTocaA': "It's for",
  'partner.cta': 'Draw a partner',
  'partner.heading': 'Does it with',
  'partner.again': 'Another partner',

  'retos.title': 'Challenges',
  'retos.subtitle': '{count} challenges · {used} used',
  'retos.empty': 'No challenges yet. Create the first one!',
  'retos.repeatable': 'Repeatable',
  'retos.used': 'Used',
  'retos.new': 'New challenge',
  'retos.edit': 'Edit challenge',
  'retos.delTitle': 'Delete challenge',
  'retos.delConfirmPre': 'Are you sure you want to delete ',
  'retos.delConfirmPost': '?',
  'retos.form.title': 'Title',
  'retos.form.titlePh': 'E.g. Impersonate a celebrity',
  'retos.form.description': 'Description',
  'retos.form.descriptionPh': 'Challenge details (optional)',
  'retos.form.performers': 'Perform the challenge',
  'retos.form.involved': 'Involved',
  'retos.form.optional': 'Optional',
  'retos.form.note':
    'Only performers get assigned a name; the other involved people take part anonymously. If left empty, only performers count.',
  'retos.form.repeatableHint': 'Can come up more than once in the same session.',
  'retos.form.errTitle': 'Title is required.',
  'retos.form.errPerformers': 'The number of performers must be at least 1.',
  'retos.form.errInvolved':
    'Involved people cannot be fewer than the performers.',
  'retos.form.errSave': "Couldn't save.",

  'col.label': 'Collection',
  'col.new': 'New collection',
  'col.rename': 'Rename collection',
  'col.namePh': 'E.g. Party, Chill, Spicy…',
  'col.delTitle': 'Delete collection',
  'col.delConfirmPre': 'Are you sure you want to delete ',
  'col.delConfirmPost': '? All its challenges will be deleted too.',

  'users.title': 'Users',
  'users.subtitle': '{count} players',
  'users.empty': 'No users. Without them, the draw is simple random.',
  'users.new': 'New user',
  'users.name': 'Name',
  'users.namePh': 'E.g. Lucía',
  'users.color': 'Color',
  'users.errName': 'Name is required.',
  'users.delTitle': 'Delete user',
  'users.delConfirmPre': 'Are you sure you want to delete ',
  'users.delConfirmPost': '?',

  'combos.title': 'Combos',
  'combos.subtitle': 'Create word groups and combine them at random',
  'combos.group': 'Group',
  'combos.empty':
    'No groups yet. Create one (e.g. Zone, Action, Time) with its words.',
  'combos.play': 'Play!',
  'combos.willRoll': '{n} {reels} will appear with a random combination.',
  'combos.reel': 'reel',
  'combos.reels': 'reels',
  'combos.needGroup': 'Select at least one group with words to play.',
  'combos.groupsCount': 'Groups · {n}',
  'combos.activeCount': '({n} active)',
  'combos.combination': 'Combination',
  'combos.noWords': 'No words yet. Edit it to add some.',
  'combos.wordsCount': '{n} words',
  'combos.newGroup': 'New group',
  'combos.editGroup': 'Edit group',
  'combos.groupName': 'Group name',
  'combos.groupNamePh': 'E.g. Zone, Action, Time…',
  'combos.words': 'Words',
  'combos.wordsHelper': '(one per line · {n})',
  'combos.wordsNote': 'Empty lines and repeated words are ignored.',
  'combos.delTitle': 'Delete group',
  'combos.delConfirmPre': 'Are you sure you want to delete ',
  'combos.delConfirmPost': '?',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageHint': 'Choose the app language.',
  'settings.theme': 'Theme',
  'settings.themeHint': 'Choose the app appearance.',
  'settings.dark': 'Dark',
  'settings.darkDesc': 'Neon on black',
  'settings.light': 'Light',
  'settings.lightDesc': 'Bright and clean',
  'settings.reveal': 'Reveal animation',
  'settings.revealHint': 'Choose how the challenge is revealed.',
  'settings.slot': 'Slot machine',
  'settings.slotDesc': 'Spinning reels',
  'settings.dice': '3D dice',
  'settings.diceDesc': 'A rolling cube',
  'settings.sound': 'Sound',
  'settings.soundHint': 'Effects when spinning and revealing.',
  'settings.stats': 'Stats',
  'settings.statTotal': 'Total challenges',
  'settings.statAvailable': 'Not drawn',
  'settings.statUsed': 'Drawn',
  'settings.statUsers': 'Users',
  'settings.session': 'Session',
  'settings.sessionHint': 'Reset so all challenges are available again.',
  'settings.resetDone': '{n} challenges reset.',
  'settings.resetConfirmTitle': 'Reset session',
  'settings.resetConfirmBody': 'All challenges will be available again. Continue?',
  'settings.retosCard': 'Challenges: export & import',
  'settings.retosCardHint':
    "Export or import the active collection's challenges. On import, challenges already in that collection are not duplicated.",
  'settings.exportRetos': 'Export challenges',
  'settings.combosCard': 'Combos: export & import',
  'settings.combosCardHint':
    "Download your word groups to a file. On import, groups that already exist (by name) are not duplicated.",
  'settings.exportGroups': 'Export groups',
  'settings.import': 'Import file',
  'settings.importing': 'Importing…',
  'settings.exportedTo': 'Exported to {file}.',
  'settings.importNothing': 'Nothing new: {n} already existed.',
  'settings.importDone': '{imported} {noun} added{extra}.',
  'settings.importDoneExtra': ' · {n} already existed',
  'settings.importError': "Couldn't import.",
  'noun.retos': 'challenges',
  'noun.grupos': 'groups',

  'aria.nav': 'Main navigation',
  'common.edit': 'Edit',
  'common.rename': 'Rename',
  'common.select': 'Select',
  'aria.color': 'Color',

  'reveal.decoys': 'Challenge,Surprise,Dare,Mission',

  'combos.wordsPh': 'Kitchen\nLiving room\nGarden',

  'file.invalidJson': 'The file is not valid JSON.',
  'file.noRetosList': 'The file does not contain a list of challenges.',
  'file.noRetosValid': 'The file contains no valid challenges.',
  'file.noGroupsList': 'The file does not contain a list of groups.',
  'file.noGroupsValid': 'The file contains no valid groups.',

  'err.validation': 'Invalid data.',
  'err.noChallenges': 'No challenges left. Reset the session.',
  'err.challengeNotFound': 'Challenge not found.',
  'err.userNotFound': 'User not found.',
  'err.collectionNotFound': 'Collection not found.',
  'err.cannotDeleteLastCollection': "You can't delete the only collection.",
  'err.groupNotFound': 'Group not found.',
  'err.involvedBelowRequired':
    'Involved people cannot be fewer than the performers.',
}

const dicts: Record<Lang, Dict> = { es, en }

// Mapea los mensajes (en español) que devuelve el backend a claves i18n, para
// poder mostrarlos en el idioma activo. Si no se reconoce, se deja tal cual.
const apiErrorMap: Record<string, string> = {
  'Selecciona al menos un usuario.': 'app.selectUser',
  'No quedan retos disponibles. Reinicia la sesión.': 'err.noChallenges',
  'Reto no encontrado.': 'err.challengeNotFound',
  'Usuario no encontrado.': 'err.userNotFound',
  'Colección no encontrada.': 'err.collectionNotFound',
  'No puedes borrar la única colección.': 'err.cannotDeleteLastCollection',
  'Grupo no encontrado.': 'err.groupNotFound',
  'Las personas involucradas no pueden ser menos que las que realizan el reto.':
    'err.involvedBelowRequired',
}

export function translateApiError(detail: string, lang?: Lang): string {
  const key = apiErrorMap[detail]
  return key ? translate(lang ?? loadLang(), key) : detail
}

export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  let s = dicts[lang][key] ?? es[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(`{${k}}`, String(v))
    }
  }
  return s
}

export type TFunc = (
  key: string,
  params?: Record<string, string | number>,
) => string
