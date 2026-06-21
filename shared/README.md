# 📦 @retobox/shared

Paquete TypeScript con la **lógica de negocio y los tipos compartidos** de RetoBox.
Es el puente que evita duplicar la lógica entre la web y la app móvil offline.

Fuente de verdad de las reglas: [`../CONTRACT.md`](../CONTRACT.md).

## Contenido

| Módulo | Qué expone |
|--------|------------|
| `types.ts` | `Challenge`, `User`, `DrawResult`, `Stats`, inputs… |
| `draw.ts` | `selectDraw` (elegibilidad + sorteo ponderado anti-repetición + asignación) y `computeStats`; `REPEAT_DECAY` |
| `validation.ts` | Validadores que replican los modelos Pydantic (lanzan `DomainError` 422) |
| `colors.ts` | Paleta y `pickColor` (asignación de color a usuarios) |
| `seed.ts` | `SEED_CHALLENGES` (29 retos en español) y `seedIfEmpty` |
| `repository.ts` | Interfaz `RetoBoxRepository` + `InMemoryRepository` de referencia |
| `errors.ts` | `DomainError` con `status` (400/404/409/422) |
| `rng.ts` | Aleatoriedad inyectable: `choice`, `weighted` (sorteo ponderado), `sample` |

La app móvil implementa `RetoBoxRepository` sobre `expo-sqlite` reutilizando estas
funciones puras; el `InMemoryRepository` sirve de implementación de referencia y es
el objeto contra el que corren los tests de paridad.

## Tests

```bash
cd shared
npm install
npm test            # tests de paridad con backend/tests/test_api.py
npm run test:random # tests ESTADÍSTICOS del aleatorio (solo al tocar draw.ts / rng.ts)
npm run typecheck
```

> Cualquier cambio en las reglas de negocio debe reflejarse en **ambos** lados
> (backend Python y este paquete) y mantener verdes los tests de paridad. Los tests
> del aleatorio (`test:random`) son estadísticos y van aparte: solo al cambiar el sorteo.
