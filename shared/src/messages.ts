// Mensajes de error de dominio. Se mantienen idénticos a los del backend Python
// (CONTRACT.md) para que la app móvil offline muestre exactamente los mismos textos.

export const MESSAGES = {
  titleRequired: 'title no puede estar vacío',
  nameRequired: 'name no puede estar vacío',
  requiredUsersMin: 'required_users debe ser >= 1',
  involvedUsersMin: 'involved_users debe ser >= 1',
  involvedLtRequired: 'involved_users no puede ser menor que required_users',
  invalidMode: "mode debe ser 'random' o 'selected'",
  selectAtLeastOne: 'Selecciona al menos un usuario.',
  noChallengesLeft: 'No quedan retos disponibles. Reinicia la sesión.',
  challengeNotFound: 'Reto no encontrado.',
  userNotFound: 'Usuario no encontrado.',
  groupNameRequired: 'name no puede estar vacío',
  groupNotFound: 'Grupo no encontrado.',
  collectionNameRequired: 'name no puede estar vacío',
  collectionNotFound: 'Colección no encontrada.',
  lastCollection: 'No puedes borrar la única colección.',
} as const
