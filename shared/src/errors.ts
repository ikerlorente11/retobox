// Error de dominio con código HTTP asociado. Espeja los status del backend
// (422 validación, 400 petición inválida, 404 no encontrado, 409 sin retos)
// para que la capa local y la HTTP fallen de forma indistinguible.

export class DomainError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DomainError'
    this.status = status
  }
}
