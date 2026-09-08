"""Public preset collections and word groups, shared read-only by everyone.

``seed_presets()`` runs on every startup and is idempotent: each preset has a
stable ``preset_key`` and is only inserted when missing. Editing the content
here only affects presets that do not exist yet in the database.
"""

import json
from datetime import datetime, timezone

from app.database import _lock, get_connection

# Cada reto: (title, description, required_users, involved_users | None)
Preset = tuple[str, str, int, int | None]

PRESET_COLLECTIONS: list[tuple[str, str, list[Preset]]] = [
    (
        "fiesta",
        "🎉 Fiesta clásica",
        [
            ("Imita a un famoso durante 30s", "El resto tiene que adivinar quién es.", 1, None),
            ("Haz 10 flexiones", "Si no puedes, hazlas de rodillas. ¡Sin excusas!", 1, None),
            ("Cuenta un secreto vergonzoso", "Algo que nunca hayas contado en este grupo.", 1, None),
            ("Canta el estribillo de tu canción favorita", "A pleno pulmón, sin música.", 1, None),
            ("Habla con acento extranjero durante 2 minutos", "Hasta tu próximo turno.", 1, None),
            ("Imita el sonido de 3 animales", "Que los demás adivinen cuáles son.", 1, None),
            ("Cuenta un chiste", "Si nadie se ríe, repites el reto.", 1, None),
            ("Haz tu mejor pose de superhéroe", "Mantenla 15 segundos sin reírte.", 1, None),
            ("Manda un mensaje gracioso a un contacto al azar", "Captura de pantalla obligatoria.", 1, None),
            ("Recita el abecedario al revés", "Sin equivocarte. Tienes un intento.", 1, None),
            ("Haz una imitación de otro jugador", "El grupo vota si lo has clavado.", 1, None),
            ("Aguanta la risa 1 minuto", "Mientras los demás intentan hacerte reír.", 1, None),
            ("Inventa un rap sobre la persona de tu derecha", "Mínimo 4 versos.", 1, None),
            ("Haz 20 sentadillas", "Cuenta en voz alta cada una.", 1, None),
            ("Baile improvisado en pareja", "30 segundos de baile coordinado.", 2, None),
            ("Concurso de muecas", "Quien aguante más serio gana, el otro hace otro reto.", 2, None),
            ("Pulso (echar un pulso)", "El mejor de tres. El perdedor bebe agua de un trago.", 2, None),
            ("Adivina la palabra mímica", "Uno actúa, el otro adivina en 30s.", 2, None),
            ("Imitad una escena de película", "Elegid una y representadla 30 segundos.", 2, None),
            ("Espalda con espalda", "Describid al otro con los ojos cerrados.", 2, None),
            ("Dúo de karaoke", "Cantad juntos el estribillo de una canción famosa.", 2, None),
            ("Reto del idioma inventado", "Mantened una conversación en un idioma que no existe.", 2, None),
            ("Cara o cruz de retos", "El que pierda hace dos retos seguidos en el próximo turno.", 2, None),
            ("Pirámide humana (de pie)", "Formad una figura estable y aguantad 10 segundos.", 3, None),
            ("Cuento encadenado", "Cada uno añade una frase a una historia disparatada.", 3, None),
            ("Estatuas musicales", "Bailad y congelaos; el último en parar repite reto.", 3, None),
            ("Coreografía exprés", "Inventad un baile de 15 segundos todos juntos.", 3, None),
            ("El teléfono escacharrado", "Pasad una frase susurrada; el último la dice en voz alta.", 4, None),
            ("Tribunal de mímica", "Uno actúa una película y los demás adivinan a la vez.", 4, None),
        ],
    ),
    (
        "familia",
        "👨‍👩‍👧 En familia",
        [
            ("Cuenta tu recuerdo favorito con alguien de la mesa", "Y explica por qué te marcó.", 1, None),
            ("Imita a un miembro de la familia", "Los demás adivinan a quién.", 1, None),
            ("Di tres cosas que te gustan de la persona de tu izquierda", "Sin repetir tópicos.", 1, None),
            ("Canta la canción de un dibujo animado", "Con coreografía si la tiene.", 1, None),
            ("Inventa un cuento en 1 minuto", "Con un dragón, una tostadora y tu abuela.", 1, None),
            ("Haz una figura con el cuerpo y que adivinen qué es", "Sin hablar.", 1, None),
            ("Recorre la habitación andando como un pingüino", "Ida y vuelta.", 1, None),
            ("Dibuja a otro jugador con los ojos cerrados", "Después se lo enseñas.", 1, None),
            ("Adivina el objeto con los ojos vendados", "Los demás te ponen tres cosas en la mano.", 1, None),
            ("Carrera de sacos imaginaria", "Saltad con los pies juntos hasta la pared.", 2, None),
            ("Concurso de miradas", "El primero que parpadee pierde.", 2, None),
            ("Dúo de aplausos", "Inventad un ritmo de palmas y repetidlo sin fallar.", 2, None),
            ("Torre de cojines", "Construid la torre más alta en 30 segundos.", 2, None),
            ("Coreografía familiar", "Enseñad un paso de baile al resto y que lo copien.", 3, None),
        ],
    ),
    (
        "preguntas",
        "🍷 Cena de amigos (preguntas)",
        [
            ("¿Cuál es tu mayor manía?", "Sé honesto: los demás pueden confirmarla.", 1, None),
            ("¿Qué harías con un millón de euros mañana?", "Lo primero, sin pensar.", 1, None),
            ("Cuenta el viaje que más te ha marcado", "Y qué aprendiste.", 1, None),
            ("¿Cuál fue tu primera decepción con un famoso?", "O con un ídolo de la infancia.", 1, None),
            ("Confiesa una serie que ves en secreto", "Y por qué no lo cuentas.", 1, None),
            ("¿Qué superpoder elegirías y para qué?", "Nada de volar por defecto.", 1, None),
            ("Describe tu día perfecto", "Desde que te levantas hasta que te acuestas.", 1, None),
            ("¿Cuál es el consejo que más repites?", "¿Y lo aplicas tú?", 1, None),
            ("Cuenta tu mayor metedura de pata en el trabajo", "Con detalles.", 1, None),
            ("¿Qué canción define tu vida ahora mismo?", "Y explica por qué.", 1, None),
            ("¿Qué comida no comerías ni por dinero?", "Y cuánta cantidad de dinero haría que cambiases de idea.", 1, None),
            ("Decid algo que tenéis en común y nadie sepa", "Tenéis 1 minuto para encontrarlo.", 2, None),
            ("Adivina qué respondería el otro", "A: ¿playa o montaña? Contestad a la vez.", 2, None),
            ("Cuenta cómo os conocisteis", "Cada uno su versión; el resto vota la más creíble.", 2, None),
        ],
    ),
    (
        "fisico",
        "💪 Físicos y deportivos",
        [
            ("Plancha 45 segundos", "Con la espalda recta. Si caes, empiezas de nuevo.", 1, None),
            ("15 saltos de tijera", "Cuenta en voz alta.", 1, None),
            ("Aguanta a la pata coja 30 segundos", "Con los ojos cerrados.", 1, None),
            ("10 burpees", "A tu ritmo, pero completos.", 1, None),
            ("Toca el suelo con las manos sin doblar las rodillas", "Aguanta 10 segundos.", 1, None),
            ("Sube y baja las escaleras dos veces", "Si no hay, 20 zancadas.", 1, None),
            ("Haz la rueda (o inténtalo)", "El grupo puntúa del 1 al 10.", 1, None),
            ("Carrera de carretilla", "Uno lleva las piernas del otro. Hasta la pared y vuelta.", 2, None),
            ("Sentadilla espalda con espalda", "Bajad y subid a la vez sin caeros, 5 veces.", 2, None),
            ("Duelo de flexiones", "Quien haga más en 30 segundos gana.", 2, None),
            ("Pulso con la mano izquierda", "El mejor de tres.", 2, None),
            ("Relevo de globos", "Pasaos un globo sin usar las manos.", 2, None),
            ("Plancha en cadena", "Cada uno apoya los pies en la espalda del siguiente. 15 segundos.", 3, None),
            ("Tira y afloja humano", "Dos equipos, agarrados por la cintura.", 4, None),
        ],
    ),
    (
        "oficina",
        "💼 Oficina y equipo",
        [
            ("Presenta tu trabajo como si fuera un anuncio de teletienda", "30 segundos.", 1, None),
            ("Cuenta un fallo que te enseñó algo", "Sin echar la culpa a nadie.", 1, None),
            ("Explica tu proyecto actual a un niño de 6 años", "Sin tecnicismos.", 1, None),
            ("Di algo que admiras de un compañero", "Elige a alguien de la sala.", 1, None),
            ("Imita una reunión típica de tu equipo", "Con todos sus tics.", 1, None),
            ("Tu emoji más usado y por qué", "Enséñalo si hace falta.", 1, None),
            ("Cuenta cuál fue tu primer trabajo", "Y qué te llevaste de él.", 1, None),
            ("Vende este objeto", "Coge lo que tengas a mano y véndelo al grupo en 30s.", 1, None),
            ("Pitch a dos voces", "Inventad un producto y presentadlo en 1 minuto.", 2, None),
            ("Entrevista exprés", "Uno entrevista al otro para un trabajo absurdo.", 2, None),
            ("Adivina la palabra sin decirla", "Uno describe una palabra de la oficina, el otro adivina.", 2, None),
            ("Torre de post-its", "Construid la más alta en 45 segundos.", 3, None),
            ("Brainstorming relámpago", "10 ideas para mejorar la oficina en 1 minuto.", 3, None),
        ],
    ),
    (
        "viaje",
        "🚗 Viaje y carretera",
        [
            ("Nombra 10 marcas de coche en 20 segundos", "Sin repetir.", 1, None),
            ("Canta la primera canción que suene en la radio", "Cambiando la letra.", 1, None),
            ("Cuenta tu peor experiencia en un viaje", "Con final feliz o no.", 1, None),
            ("Inventa la historia del coche de al lado", "¿Quién va dentro y adónde?", 1, None),
            ("Di una ciudad por cada letra de tu nombre", "Sin ayuda.", 1, None),
            ("Describe el paisaje como un documental", "Con voz de narrador.", 1, None),
            ("Adivina cuánto queda para llegar", "El que más se acerque gana.", 1, None),
            ("Palabras encadenadas", "Empieza por la última sílaba de la anterior. 1 minuto.", 2, None),
            ("Veo veo", "Uno elige, el otro adivina en 5 intentos.", 2, None),
            ("Duelo de matrículas", "Quien sume antes los números de una matrícula gana.", 2, None),
            ("Karaoke a dos voces", "Con la siguiente canción que suene.", 2, None),
            ("Historia por turnos", "Cada uno una frase; nadie puede decir 'y entonces'.", 3, None),
        ],
    ),
    (
        "pareja",
        "💑 En pareja",
        [
            ("Di lo primero que pensaste al conocer a tu pareja", "Con sinceridad.", 1, 2),
            ("Cuenta vuestro plan ideal de fin de semana", "Sin mirar al otro.", 1, 2),
            ("Imita a tu pareja cuando se enfada", "Con cariño.", 1, 2),
            ("Elige la canción de los dos", "Y explica por qué.", 1, 2),
            ("Mírala/lo a los ojos 30 segundos sin reír", "Sin hablar.", 2, None),
            ("Adivina la respuesta del otro", "¿Cuál es mi comida favorita? Contestad a la vez.", 2, None),
            ("Baile lento improvisado", "1 minuto, con la primera canción que salga.", 2, None),
            ("Tres cosas que harías por el otro", "Cada uno dice las suyas.", 2, None),
            ("Recordad vuestra primera cita", "Cada uno su versión; comparadlas.", 2, None),
            ("Planead un viaje en 2 minutos", "Destino, fechas y una actividad.", 2, None),
            ("Un cumplido que nunca le hayas dicho", "Por turnos.", 2, None),
        ],
    ),
    (
        "verdad_reto",
        "🎭 Verdad o reto (suave)",
        [
            ("Verdad: ¿cuál es tu mayor miedo?", "Responde sin rodeos.", 1, None),
            ("Verdad: ¿cuál fue tu última mentira piadosa?", "Y a quién.", 1, None),
            ("Verdad: ¿qué te gustaría cambiar de ti?", "Solo una cosa.", 1, None),
            ("Verdad: ¿de qué te avergüenzas de tu adolescencia?", "Ropa, música, lo que sea.", 1, None),
            ("Verdad: ¿a quién de aquí llamarías en una emergencia?", "Y por qué.", 1, None),
            ("Reto: habla cantando hasta tu próximo turno", "Sin excepciones.", 1, None),
            ("Reto: haz una llamada con voz de robot", "A alguien de tu confianza.", 1, None),
            ("Reto: baila sin música 30 segundos", "El grupo puntúa.", 1, None),
            ("Reto: deja que el grupo te peine", "Y aguanta así 3 turnos.", 1, None),
            ("Reto: cuenta una historia usando solo preguntas", "1 minuto.", 1, None),
            ("Reto: intercambiad una prenda", "Hasta el final de la partida.", 2, None),
            ("Verdad a dúo: decid algo que os moleste del otro", "Con humor.", 2, None),
            ("Reto: representad una escena romántica de cine", "El resto adivina la película.", 2, None),
        ],
    ),
]

# Grupos de palabras preset para el mezclador: (preset_key, name, words)
PRESET_WORD_GROUPS: list[tuple[str, str, list[str]]] = [
    (
        "acciones",
        "Acciones",
        ["baila", "canta", "imita", "dibuja", "describe", "cuenta un chiste sobre", "haz mímica de"],
    ),
    (
        "personajes",
        "Personajes",
        ["un pirata", "un robot", "tu abuela", "un influencer", "un superhéroe", "un bebé", "un futbolista"],
    ),
    (
        "lugares",
        "Lugares",
        ["en el metro", "en la luna", "en una boda", "en el gimnasio", "en un ascensor", "en el desierto"],
    ),
    (
        "tiempos",
        "Duración",
        ["10 segundos", "30 segundos", "1 minuto", "hasta tu próximo turno"],
    ),
]


def seed_presets() -> int:
    """Insert missing preset collections and word groups. Returns how many
    collections were created."""
    conn = get_connection()
    created = 0
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        for key, name, challenges in PRESET_COLLECTIONS:
            if conn.execute(
                "SELECT 1 FROM collections WHERE preset_key = ?", (key,)
            ).fetchone():
                continue
            cur = conn.execute(
                "INSERT INTO collections (name, owner_id, preset_key, created_at) "
                "VALUES (?, NULL, ?, ?)",
                (name, key, now),
            )
            conn.executemany(
                "INSERT INTO challenges "
                "(title, description, required_users, involved_users, repeatable, created_at, collection_id) "
                "VALUES (?, ?, ?, ?, 0, ?, ?)",
                [
                    (title, desc, req, inv, now, cur.lastrowid)
                    for (title, desc, req, inv) in challenges
                ],
            )
            created += 1
        for key, name, words in PRESET_WORD_GROUPS:
            if conn.execute(
                "SELECT 1 FROM word_groups WHERE preset_key = ?", (key,)
            ).fetchone():
                continue
            conn.execute(
                "INSERT INTO word_groups (owner_key, preset_key, name, words, created_at) "
                "VALUES (NULL, ?, ?, ?, ?)",
                (key, name, json.dumps(words, ensure_ascii=False), now),
            )
        conn.commit()
    return created
