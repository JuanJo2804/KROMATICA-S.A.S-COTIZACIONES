/**
 * Sugerencia de MO min (minutos por plancha) a partir de cotizaciones parecidas.
 *
 * Fase 1 de la "IA": no es un modelo entrenado, sino una búsqueda de vecinos cercanos.
 * Es fácil de explicar ("se parece a estas 10 cotizaciones") y funciona con pocos datos.
 *
 * Pesos ajustados con las 842 cotizaciones del Excel, prediciendo cada una sin usar
 * cotizaciones del mismo cliente: error promedio 5,0 min (usar siempre la mediana: 8,5 min),
 * 76 % de las sugerencias dentro de ±5 min.
 */
import { resumirVecinos } from './vecinos.js';

export interface Muestra {
  id: number;
  tipoProducto: string | null;
  tintas: number | null;
  montaje: number;
  anchoCm: number | null;
  altoCm: number | null;
  moMin: number;
  cliente?: string | null;
  referencia?: string | null;
}

export interface Consulta {
  tipoProducto?: string | null;
  tintas?: number | null;
  montaje: number;
  anchoCm?: number | null;
  altoCm?: number | null;
}

export const PESOS = { tintas: 1, tipoProducto: 0.5, montaje: 0.3, area: 0.2 } as const;
export const VECINOS = 10;

const area = (x: { anchoCm?: number | null; altoCm?: number | null }) =>
  x.anchoCm && x.altoCm ? x.anchoCm * x.altoCm : null;

/** Distancia entre la consulta y una cotización histórica (0 = idénticas). */
export function distancia(c: Consulta, m: Muestra): number {
  let d = 0;
  d += c.tintas != null && m.tintas != null ? PESOS.tintas * Math.abs(c.tintas - m.tintas) : PESOS.tintas * 1.5;
  d += c.tipoProducto && m.tipoProducto
    ? c.tipoProducto === m.tipoProducto ? 0 : PESOS.tipoProducto
    : PESOS.tipoProducto * 0.5;
  d += PESOS.montaje * Math.abs(Math.log(c.montaje / m.montaje));
  const a = area(c);
  const b = area(m);
  d += a && b ? PESOS.area * Math.abs(Math.log(a / b)) : PESOS.area * 0.5;
  return d;
}

export interface Sugerencia {
  /** MO min sugerido (mediana ponderada de los vecinos), o null si no hay historial. */
  moMin: number | null;
  /** Rango típico entre los vecinos (percentiles 25 y 75). */
  rango: [number, number] | null;
  confianza: 'alta' | 'media' | 'baja';
  similares: (Muestra & { distancia: number })[];
}

export function sugerirMoMin(consulta: Consulta, muestras: Muestra[], k = VECINOS): Sugerencia {
  if (consulta.montaje <= 0) throw new Error('El montaje debe ser mayor que 0');
  const similares = muestras
    .filter((m) => m.montaje > 0 && m.moMin > 0)
    .map((m) => ({ ...m, distancia: distancia(consulta, m) }))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, k);
  if (similares.length === 0) return { moMin: null, rango: null, confianza: 'baja', similares };

  const { valor: moMin, rango, distanciaMedia } = resumirVecinos(
    similares.map((s) => ({ valor: s.moMin, distancia: s.distancia })),
  );
  const dispersion = rango[1] - rango[0];
  const confianza = distanciaMedia < 0.5 && dispersion <= 5 ? 'alta' : distanciaMedia < 1.5 && dispersion <= 10 ? 'media' : 'baja';

  return { moMin, rango, confianza, similares };
}
