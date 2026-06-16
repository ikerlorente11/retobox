// Efectos de sonido del móvil. Equivale a frontend/src/lib/sound.ts de la web,
// pero React Native no tiene WebAudio: usamos expo-audio reproduciendo dos WAV
// pregenerados (assets/sfx) con las mismas frecuencias que la web.
// Todo es tolerante a fallos: el sonido es opcional y nunca debe romper el sorteo.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

let tickPlayer: AudioPlayer | null = null
let revealPlayer: AudioPlayer | null = null
let initStarted = false

// Inicializa los reproductores una sola vez (idempotente). Conviene llamarlo al
// arrancar la app para que el primer tic no llegue tarde.
export async function initSound(): Promise<void> {
  if (initStarted) return
  initStarted = true
  try {
    // playsInSilentMode: reproduce aunque el móvil esté en modo silencio (iOS).
    await setAudioModeAsync({ playsInSilentMode: true })
    tickPlayer = createAudioPlayer(require('../../assets/sfx/tick.wav'))
    revealPlayer = createAudioPlayer(require('../../assets/sfx/reveal.wav'))
    tickPlayer.volume = 0.6
    revealPlayer.volume = 0.8
  } catch {
    /* silencioso: sin sonido si algo falla */
  }
}

// Rebobina y reproduce desde el principio (permite repetir el tic rápido).
function restart(player: AudioPlayer | null): void {
  if (!player) return
  try {
    void player.seekTo(0)
    player.play()
  } catch {
    /* silencioso */
  }
}

// Tic-tic durante el giro de la tragaperras.
export function playTick(): void {
  restart(tickPlayer)
}

// Fanfarria corta al revelar el reto.
export function playReveal(): void {
  restart(revealPlayer)
}
