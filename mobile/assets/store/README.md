# Ficha de Google Play

Todo lo que pide Play Console para la ficha, con el mismo formato en todas las apps.

| Archivo | Para qué |
| --- | --- |
| `icono-512.png` | Icono de la aplicación: 512 × 512, PNG sin transparencia ni esquinas redondeadas (Play aplica su máscara) |
| `grafico-destacado-1024x500.png` | Gráfico destacado: 1024 × 500, PNG de 24 bits |
| `capturas-movil/01…08-*.png` | Capturas de teléfono: 1080 × 1920 (9:16), en el orden en que se suben |
| `capturas-tablet/01…08-*.png` | Capturas de tablet de 7" y 10": 1440 × 2560 (9:16) o 2560 × 1440 (16:9) si la tablet está en horizontal |
| `ficha.txt` | Descripción breve (≤ 80), descripción completa (≤ 4000) y notas de cada versión (≤ 500) |

## Cómo se rehacen

- `crudas/movil` y `crudas/tablet`: capturas sin enmarcar sacadas de los emuladores (Pixel 7 a 1080 × 2400 y Pixel Tablet a 1600 × 2560, Android 15) con datos de prueba. La barra de estado está en modo demo.
- `store.json`: colores, lema del gráfico destacado y titular de cada captura.
- `python make_store.py` (necesita Pillow y las fuentes Segoe UI de Windows) vuelve a generar el icono, el gráfico destacado y las capturas enmarcadas a partir de `icono-fuente.png`, `crudas/` y `store.json`.

Para cambiar un titular basta con editar `store.json` y volver a ejecutar el script. Para cambiar una pantalla hay que sustituir la captura en bruto con el mismo nombre.
