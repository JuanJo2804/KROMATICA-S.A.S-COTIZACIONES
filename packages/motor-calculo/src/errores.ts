/** Error lanzado cuando los datos de entrada no permiten calcular la cotización. */
export class ErrorValidacion extends Error {
  constructor(
    message: string,
    /** Ruta del campo inválido, ej. "cantidades[2]". */
    public readonly campo?: string,
  ) {
    super(message);
    this.name = 'ErrorValidacion';
  }
}

export function exigirPositivo(valor: number, campo: string): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErrorValidacion(`${campo} debe ser un número mayor que 0 (se recibió ${valor})`, campo);
  }
}

export function exigirNoNegativo(valor: number, campo: string): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new ErrorValidacion(`${campo} no puede ser negativo (se recibió ${valor})`, campo);
  }
}
