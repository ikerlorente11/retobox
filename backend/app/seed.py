"""Initial seed data: ~28 fun, party-friendly (but wholesome) Spanish retos."""

from datetime import datetime, timezone

from app.database import get_connection, _lock

# (title, description, required_users)
SEED_CHALLENGES: list[tuple[str, str, int]] = [
    ("Imita a un famoso durante 30s", "El resto tiene que adivinar quién es.", 1),
    ("Haz 10 flexiones", "Si no puedes, hazlas de rodillas. ¡Sin excusas!", 1),
    ("Cuenta un secreto vergonzoso", "Algo que nunca hayas contado en este grupo.", 1),
    ("Canta el estribillo de tu canción favorita", "A pleno pulmón, sin música.", 1),
    ("Habla con acento extranjero durante 2 minutos", "Hasta tu próximo turno.", 1),
    ("Imita el sonido de 3 animales", "Que los demás adivinen cuáles son.", 1),
    ("Cuenta un chiste", "Si nadie se ríe, repites el reto.", 1),
    ("Haz tu mejor pose de superhéroe", "Mantenla 15 segundos sin reírte.", 1),
    ("Manda un mensaje gracioso a un contacto al azar", "Captura de pantalla obligatoria.", 1),
    ("Recita el abecedario al revés", "Sin equivocarte. Tienes un intento.", 1),
    ("Haz una imitación de otro jugador", "El grupo vota si lo has clavado.", 1),
    ("Aguanta la risa 1 minuto", "Mientras los demás intentan hacerte reír.", 1),
    ("Inventa un rap sobre la persona de tu derecha", "Mínimo 4 versos.", 1),
    ("Haz 20 sentadillas", "Cuenta en voz alta cada una.", 1),

    ("Baile improvisado en pareja", "30 segundos de baile coordinado.", 2),
    ("Concurso de muecas", "Quien aguante más serio gana, el otro hace otro reto.", 2),
    ("Pulso (echar un pulso)", "El mejor de tres. El perdedor bebe agua de un trago.", 2),
    ("Adivina la palabra mímica", "Uno actúa, el otro adivina en 30s.", 2),
    ("Imitad una escena de película", "Elegid una y representadla 30 segundos.", 2),
    ("Espalda con espalda", "Describid al otro con los ojos cerrados.", 2),
    ("Dúo de karaoke", "Cantad juntos el estribillo de una canción famosa.", 2),
    ("Reto del idioma inventado", "Mantened una conversación en un idioma que no existe.", 2),
    ("Cara o cruz de retos", "El que pierda hace dos retos seguidos en el próximo turno.", 2),

    ("Pirámide humana (de pie)", "Formad una figura estable y aguantad 10 segundos.", 3),
    ("Cuento encadenado", "Cada uno añade una frase a una historia disparatada.", 3),
    ("Estatuas musicales", "Bailad y congelaos; el último en parar repite reto.", 3),
    ("Coreografía exprés", "Inventad un baile de 15 segundos todos juntos.", 3),

    ("El teléfono escacharrado", "Pasad una frase susurrada; el último la dice en voz alta.", 4),
    ("Tribunal de mímica", "Uno actúa una película y los demás adivinan a la vez.", 4),
]


def seed_if_empty() -> int:
    """Insert seed challenges only when the table is empty. Returns count inserted."""
    conn = get_connection()
    with _lock:
        count = conn.execute("SELECT COUNT(*) AS c FROM challenges").fetchone()["c"]
        if count > 0:
            return 0

        now = datetime.now(timezone.utc).isoformat()
        conn.executemany(
            "INSERT INTO challenges (title, description, required_users, is_used, created_at) "
            "VALUES (?, ?, ?, 0, ?)",
            [(title, desc, req, now) for (title, desc, req) in SEED_CHALLENGES],
        )
        conn.commit()
        return len(SEED_CHALLENGES)
