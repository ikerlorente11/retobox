// Identidad anónima del navegador. El backend la usa como dueño de jugadores,
// grupos de Combos y estado de sorteo mientras no hay sesión iniciada; al
// iniciar sesión esos datos se fusionan en la cuenta.
const GUEST_KEY = 'retobox.guestKey'

function generateKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Navegadores antiguos (o contextos sin HTTPS) no tienen randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getGuestKey(): string {
  let key = localStorage.getItem(GUEST_KEY)
  if (!key) {
    key = generateKey()
    localStorage.setItem(GUEST_KEY, key)
  }
  return key
}

// Nueva identidad de invitado. Se llama tras fusionar la anterior en una cuenta
// y al cerrar sesión, para que quien use después este navegador no herede (ni
// acabe fusionando en otra cuenta) datos ajenos.
export function rotateGuestKey(): void {
  localStorage.setItem(GUEST_KEY, generateKey())
}
