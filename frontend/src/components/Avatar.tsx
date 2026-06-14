import { initials, readableText } from '../lib/colors'
import type { User } from '../types'

interface Props {
  user: User
  size?: 'sm' | 'md' | 'lg'
  ring?: boolean
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
}

export function Avatar({ user, size = 'md', ring = false }: Props) {
  return (
    <div
      className={`grid place-items-center rounded-full font-bold shadow-md ${sizes[size]} ${
        ring ? 'ring-2 ring-white/30' : ''
      }`}
      style={{
        background: `linear-gradient(135deg, ${user.color}, ${user.color}cc)`,
        color: readableText(user.color),
      }}
      title={user.name}
    >
      {initials(user.name)}
    </div>
  )
}
