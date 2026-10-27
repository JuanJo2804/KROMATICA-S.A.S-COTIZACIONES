/** Convierte un Decimal de Prisma (o null) a número de JavaScript. */
export function aNumero<T extends { toString(): string } | null | undefined>(
  valor: T,
): T extends null | undefined ? null : number {
  return (valor == null ? null : Number(valor.toString())) as never;
}
