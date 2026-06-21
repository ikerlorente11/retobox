import { motion } from 'framer-motion'
import type { ComponentType, SVGProps } from 'react'
import { DiceIcon, ListIcon, SettingsIcon, ShuffleIcon, UsersIcon } from './icons'
import { useT } from '../lib/useT'

export type Tab = 'sorteo' | 'retos' | 'usuarios' | 'combos' | 'ajustes'

const TABS: {
  id: Tab
  labelKey: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { id: 'sorteo', labelKey: 'tab.sorteo', Icon: DiceIcon },
  { id: 'retos', labelKey: 'tab.retos', Icon: ListIcon },
  { id: 'usuarios', labelKey: 'tab.usuarios', Icon: UsersIcon },
  { id: 'combos', labelKey: 'tab.combos', Icon: ShuffleIcon },
  { id: 'ajustes', labelKey: 'tab.ajustes', Icon: SettingsIcon },
]

interface Props {
  active: Tab
  onChange: (t: Tab) => void
}

export function TabBar({ active, onChange }: Props) {
  const t = useT()
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === active))
  return (
    <nav
      aria-label={t('aria.nav')}
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="glass-strong relative mx-auto flex max-w-md items-center justify-around rounded-3xl p-1.5 shadow-glow">
        {/* Pastilla ÚNICA, siempre montada: se desliza al índice activo. Antes se
            usaba layoutId (una pastilla por botón, montándose/desmontándose), lo
            que en la Pi provocaba un parpadeo: la nueva se pintaba un frame antes
            de que framer aplicara la transformación para animar. Con un solo
            elemento que anima su posición no hay swap ni medición, y va fluido.
            width = ancho de contenido / nº de pestañas; x = índice × 100%. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-2xl bg-neon-gradient opacity-90 shadow-glow"
          style={{ width: `calc((100% - 0.75rem) / ${TABS.length})` }}
          initial={false}
          animate={{ x: `${activeIndex * 100}%` }}
          transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
        />
        {TABS.map(({ id, labelKey, Icon }) => {
          const label = t(labelKey)
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative z-10 flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2"
            >
              <Icon
                className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400'}`}
              />
              <span
                className={`text-[11px] font-semibold ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
