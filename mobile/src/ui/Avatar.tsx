// Avatar circular con las iniciales del usuario sobre su color. Equivale al
// Avatar de la web; el texto se aclara/oscurece según el contraste (theme).

import { Text, View } from 'react-native'
import type { User } from '@retobox/shared'
import { initials, readableText } from '../theme'

interface Props {
  user: User
  size?: 'sm' | 'md'
}

const SIZES = { sm: 20, md: 40 } as const

export function Avatar({ user, size = 'md' }: Props) {
  const dimension = SIZES[size]
  return (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        backgroundColor: user.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: readableText(user.color),
          fontSize: size === 'sm' ? 9 : 15,
          fontWeight: '800',
        }}
      >
        {initials(user.name)}
      </Text>
    </View>
  )
}
