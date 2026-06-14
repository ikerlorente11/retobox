// Sonido opcional generado con WebAudio (sin assets). Tolerante a bloqueo de autoplay.
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.06) {
  const c = getCtx()
  if (!c) return
  try {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, c.currentTime + start)
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
    osc.connect(g)
    g.connect(c.destination)
    osc.start(c.currentTime + start)
    osc.stop(c.currentTime + start + dur + 0.02)
  } catch {
    /* silencioso */
  }
}

// Tic-tic durante el giro de la tragaperras
export function playTick() {
  tone(880, 0, 0.04, 0.03)
}

// Fanfarria corta al revelar
export function playReveal() {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((n, i) => tone(n, i * 0.09, 0.22, 0.05))
}
