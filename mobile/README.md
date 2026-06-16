# 📱 RetoBox Mobile (Expo / React Native)

App **Android nativa** de RetoBox, **100% offline**: base de datos SQLite propia en
el dispositivo, sin backend ni conexión. Comparte la lógica de negocio con la web a
través del paquete [`@retobox/shared`](../shared) (fuente de verdad: [`CONTRACT.md`](../CONTRACT.md)).

## ✨ Funcionalidades

- **Sorteo** de retos (tragaperras animada) con modo aleatorio o por usuarios
  seleccionados; reparte "realizan" y muestra los "involucrados" anónimos.
- **Retos** por **colecciones** (crear/renombrar/borrar; la activa filtra sorteo,
  stats y reinicio), con campos `involucrados` y `repetible`.
- **Usuarios** con avatar de color.
- **Combos** (mezclador): grupos de palabras que combinan al azar (N rodillos).
- **Ajustes:** estadísticas, tema (oscuro/claro), sonido, **idioma (ES/EN)**,
  exportar/importar retos y combos a fichero (compartir nativo + selector).
- **i18n** español/inglés en toda la UI (`src/lib/i18n.ts` + hook `src/lib/useT.ts`).
- **Diseño responsive** para tablet (`src/lib/responsive.ts`).

## 🏗️ Arquitectura

- **UI:** React Native + Expo Router (pestañas Sorteo / Retos / Usuarios / Combos / Ajustes).
- **Datos:** `expo-sqlite` → `src/db/sqliteRepository.ts`, que implementa el contrato
  `RetoBoxRepository` de `@retobox/shared` y **delega toda la lógica** (validación,
  elegibilidad de sorteo, stats, colecciones, combos, import/export, colores) en las
  funciones puras del paquete compartido.
- **Estado:** zustand (`src/store.ts`), calco del store de la web pero apuntando al
  repositorio local. Preferencias (tema, revelado, sonido, idioma, colección activa)
  en `AsyncStorage`.
- **Lógica compartida:** se resuelve vía alias de Metro/TS a `../shared/src` (no se
  publica en npm). Ver `metro.config.js` y `tsconfig.json`.

> La lógica de `draw`/`reset`/`stats`/validación/colecciones/combos es **la misma**
> que la del backend Python.

## ✅ Tests

```bash
npm test            # móvil: i18n (traducción, errores, paridad ES/EN)
cd ../shared && npm test   # lógica de negocio compartida (64 tests de paridad)
```

- **`../shared/tests`** (64) cubre TODA la lógica de negocio que el móvil usa:
  validación, sorteo, colecciones, combos, import/export y parsers de fichero;
  reproduce los tests de `backend/tests/test_api.py` (paridad con el backend).
- **`src/lib/i18n.test.ts`** (8) cubre lo propio del móvil que es lógica pura:
  `translate`, `translateApiError` y **paridad de claves ES/EN** (garantiza que
  ninguna traducción falte en ningún idioma).
- El resto del código móvil (`sqliteRepository`, `store`, `retosShare`) es una capa
  fina sobre APIs nativas (SQLite, expo-sharing/file-system) que **delega la lógica**
  en `@retobox/shared`; por eso su comportamiento queda cubierto por los tests de
  `shared` y se valida manualmente en dispositivo/emulador.

## 🚀 Desarrollo

```bash
cd mobile
npm install
# Alinea versiones nativas con tu SDK de Expo (recomendado tras el primer install):
npx expo install
npx expo start            # abre con Expo Go o un emulador Android
```

La BD se crea y se siembra (29 retos en español) la primera vez que arranca.
Para probar el modo offline real: activa **modo avión** y usa la app con normalidad.

## 📦 Build para Play Store (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview      # APK de prueba (instalable)
eas build -p android --profile production    # AAB firmado para Play Store
eas submit -p android                        # (opcional) subida a la consola
```

El keystore lo gestiona EAS (guárdalo con cuidado: es crítico para futuras
actualizaciones). `applicationId` = `com.encorelab.retobox` (ver `app.json`).

## ⚠️ Notas de scope (ver plan)

- **Dos UIs en paralelo:** la web (React DOM) y esta app (React Native) tienen UIs
  separadas; cada cambio visual se hace en ambos sitios. La **lógica** sí se comparte.
- **Animación de revelado:** el dado 3D y la tragaperras de la web se han simplificado
  a un giro con la API `Animated` integrada. Margen para enriquecer con Reanimated.
- **Assets:** falta añadir `icon.png` / `splash` antes del build de producción.
