/** Formatos de números para Colombia: 1.760, $1.488,74, 30 %. */

const pesos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const pesosDecimales = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export const formatoPesos = (valor: number) => `$${pesos.format(valor)}`;
export const formatoPesosExacto = (valor: number) => `$${pesosDecimales.format(valor)}`;
export const formatoNumero = (valor: number) => decimal.format(valor);
export const formatoPorcentaje = (fraccion: number) => `${decimal.format(fraccion * 100)} %`;

// Las fechas sin hora ("2026-03-18") se leen como medianoche UTC: se formatean en UTC para no correrlas un día.
const fecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatoFecha = (dia: string) => fecha.format(new Date(dia));

/** Convierte lo que escribe la persona ("1.5", "1,5", "") en número; vacío o inválido → undefined. */
export function leerNumero(texto: string): number | undefined {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : undefined;
}
