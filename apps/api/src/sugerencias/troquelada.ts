/**
 * Sugerencia de unidades troqueladas por hora a partir de cotizaciones parecidas.
 *
 * Hoy es un dato de la operaria: mira el tipo de producto, las dimensiones, si es corte con bisturí o troquelado
 * y el espesor. Igual que con el MO min, se usa una búsqueda de vecinos cercanos.
 *
 * Pesos ajustados con las 835 cotizaciones del Excel que tienen troquelada, prediciendo cada una sin usar
 * cotizaciones del mismo cliente: error mediano 14 % (usar siempre el valor típico: 52 %; la mediana por tipo
 * de producto: 23 %), 62 % de las sugerencias dentro de ±25 %. Ver ml/README.md.
 */
import { distanciaCategoria, distanciaLog, resumirVecinos } from './vecinos.js';

export interface MuestraTroquelada {
  id: number;
  tipoProducto: string | null;
  tipoCorte: string | null;
  anchoCm: number | null;
  altoCm: number | null;
  montaje: number | null;
  gramosPorCm2: number | null;
  tintas: number | null;
  troqueladasPorHora: number;
  cliente?: string | null;
  referencia?: string | null;
}

export interface ConsultaTroquelada {
  tipoProducto?: string | null;
  tipoCorte?: string | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  montaje?: number | null;
  gramosPorCm2?: number | null;
  tintas?: number | null;
}

export const PESOS_TROQUELADA = { tipoProducto: 1, tipoCorte: 1, area: 0.6, montaje: 0.3, espesor: 0.3, tintas: 0.1 } as const;
export const VECINOS_TROQUELADA = 10;

const area = (x: { anchoCm?: number | null; altoCm?: number | null }) =>
  x.anchoCm && x.altoCm ? x.anchoCm * x.altoCm : null;

/** Distancia entre la consulta y una cotización histórica (0 = idénticas). */
export function distanciaTroquelada(c: ConsultaTroquelada, m: MuestraTroquelada): number {
  const p = PESOS_TROQUELADA;
  return (
    p.tipoProducto * distanciaCategoria(c.tipoProducto, m.tipoProducto) +
    p.tipoCorte * distanciaCategoria(c.tipoCorte, m.tipoCorte) +
    p.area * distanciaLog(area(c), area(m)) +
    p.montaje * distanciaLog(c.montaje, m.montaje) +
    p.espesor * distanciaLog(c.gramosPorCm2, m.gramosPorCm2) +
    p.tintas * (c.tintas != null && m.tintas != null ? Math.abs(c.tintas - m.tintas) : 1.5)
  );
}

export interface SugerenciaTroquelada {
  /** Troqueladas por hora sugeridas (mediana ponderada de los vecinos), o null si no hay historial. */
  troqueladasPorHora: number | null;
  rango: [number, number] | null;
  confianza: 'alta' | 'media' | 'baja';
  similares: (MuestraTroquelada & { distancia: number })[];
}

export function sugerirTroquelada(
  consulta: ConsultaTroquelada,
  muestras: MuestraTroquelada[],
  k = VECINOS_TROQUELADA,
): SugerenciaTroquelada {
  const similares = muestras
    .filter((m) => m.troqueladasPorHora > 0)
    .map((m) => ({ ...m, distancia: distanciaTroquelada(consulta, m) }))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, k);
  if (similares.length === 0) return { troqueladasPorHora: null, rango: null, confianza: 'baja', similares };

  const { valor, rango, distanciaMedia } = resumirVecinos(
    similares.map((s) => ({ valor: s.troqueladasPorHora, distancia: s.distancia })),
  );
  // La dispersión se mide como proporción: entre 100 y 130 por hora es tan coherente como entre 1.000 y 1.300.
  const dispersion = rango[1] / rango[0];
  const confianza =
    distanciaMedia < 0.6 && dispersion <= 1.35 ? 'alta' : distanciaMedia < 1.5 && dispersion <= 2 ? 'media' : 'baja';
  return { troqueladasPorHora: Math.round(valor * 100) / 100, rango, confianza, similares };
}
