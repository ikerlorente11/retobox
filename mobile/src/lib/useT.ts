// Hook reactivo de traducción: re-renderiza al cambiar el idioma del store.
// Vive aparte de i18n.ts (que es puro, sin importar el store) para evitar un
// ciclo de imports store <-> i18n que rompía la inicialización.

import { useStore } from '../store'
import { translate, type TFunc } from './i18n'

export function useT(): TFunc {
  const lang = useStore((state) => state.lang)
  return (key, params) => translate(lang, key, params)
}
