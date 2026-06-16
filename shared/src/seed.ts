// Datos de ejemplo iniciales: ~28 retos divertidos, sanos y en español.
// Idénticos a SEED_CHALLENGES del backend para que web y móvil arranquen igual.

import type { RetoBoxRepository } from './repository'

export interface SeedChallenge {
  title: string
  description: string
  required_users: number
}

export const SEED_CHALLENGES: ReadonlyArray<SeedChallenge> = [
  { title: 'Imita a un famoso durante 30s', description: 'El resto tiene que adivinar quién es.', required_users: 1 },
  { title: 'Haz 10 flexiones', description: 'Si no puedes, hazlas de rodillas. ¡Sin excusas!', required_users: 1 },
  { title: 'Cuenta un secreto vergonzoso', description: 'Algo que nunca hayas contado en este grupo.', required_users: 1 },
  { title: 'Canta el estribillo de tu canción favorita', description: 'A pleno pulmón, sin música.', required_users: 1 },
  { title: 'Habla con acento extranjero durante 2 minutos', description: 'Hasta tu próximo turno.', required_users: 1 },
  { title: 'Imita el sonido de 3 animales', description: 'Que los demás adivinen cuáles son.', required_users: 1 },
  { title: 'Cuenta un chiste', description: 'Si nadie se ríe, repites el reto.', required_users: 1 },
  { title: 'Haz tu mejor pose de superhéroe', description: 'Mantenla 15 segundos sin reírte.', required_users: 1 },
  { title: 'Manda un mensaje gracioso a un contacto al azar', description: 'Captura de pantalla obligatoria.', required_users: 1 },
  { title: 'Recita el abecedario al revés', description: 'Sin equivocarte. Tienes un intento.', required_users: 1 },
  { title: 'Haz una imitación de otro jugador', description: 'El grupo vota si lo has clavado.', required_users: 1 },
  { title: 'Aguanta la risa 1 minuto', description: 'Mientras los demás intentan hacerte reír.', required_users: 1 },
  { title: 'Inventa un rap sobre la persona de tu derecha', description: 'Mínimo 4 versos.', required_users: 1 },
  { title: 'Haz 20 sentadillas', description: 'Cuenta en voz alta cada una.', required_users: 1 },

  { title: 'Baile improvisado en pareja', description: '30 segundos de baile coordinado.', required_users: 2 },
  { title: 'Concurso de muecas', description: 'Quien aguante más serio gana, el otro hace otro reto.', required_users: 2 },
  { title: 'Pulso (echar un pulso)', description: 'El mejor de tres. El perdedor bebe agua de un trago.', required_users: 2 },
  { title: 'Adivina la palabra mímica', description: 'Uno actúa, el otro adivina en 30s.', required_users: 2 },
  { title: 'Imitad una escena de película', description: 'Elegid una y representadla 30 segundos.', required_users: 2 },
  { title: 'Espalda con espalda', description: 'Describid al otro con los ojos cerrados.', required_users: 2 },
  { title: 'Dúo de karaoke', description: 'Cantad juntos el estribillo de una canción famosa.', required_users: 2 },
  { title: 'Reto del idioma inventado', description: 'Mantened una conversación en un idioma que no existe.', required_users: 2 },
  { title: 'Cara o cruz de retos', description: 'El que pierda hace dos retos seguidos en el próximo turno.', required_users: 2 },

  { title: 'Pirámide humana (de pie)', description: 'Formad una figura estable y aguantad 10 segundos.', required_users: 3 },
  { title: 'Cuento encadenado', description: 'Cada uno añade una frase a una historia disparatada.', required_users: 3 },
  { title: 'Estatuas musicales', description: 'Bailad y congelaos; el último en parar repite reto.', required_users: 3 },
  { title: 'Coreografía exprés', description: 'Inventad un baile de 15 segundos todos juntos.', required_users: 3 },

  { title: 'El teléfono escacharrado', description: 'Pasad una frase susurrada; el último la dice en voz alta.', required_users: 4 },
  { title: 'Tribunal de mímica', description: 'Uno actúa una película y los demás adivinan a la vez.', required_users: 4 },
]

/**
 * Inserta los retos de ejemplo solo si el repositorio está vacío.
 * Devuelve el número de retos insertados (0 si ya había datos). Idempotente.
 */
export async function seedIfEmpty(repository: RetoBoxRepository): Promise<number> {
  const existing = await repository.getChallenges()
  if (existing.length > 0) {
    return 0
  }
  for (const challenge of SEED_CHALLENGES) {
    await repository.createChallenge({
      title: challenge.title,
      description: challenge.description,
      required_users: challenge.required_users,
    })
  }
  return SEED_CHALLENGES.length
}
