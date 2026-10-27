/**
 * Calculadora del tamaño del clisé y de los gramos de material, como el recuadro "TAMAÑO CLISE" y la
 * "TABLA DE GRAMOS POR CM²" del Excel.
 */
import { exigirNoNegativo, exigirPositivo, ErrorValidacion } from './errores.js';

/** Margen que se suma a cada lado del clisé (1 cm por borde). */
export const MARGEN_CLISE_CM = 2;

/** Espacio entre unidades que usa el Excel según el tipo de corte. */
export const ESPACIO_SUGERIDO_CM = { TROQUELADO: 0.3, BISTURI: 0 } as const;

/** Área disponible de la plancha: el clisé debe caber en 25 × 30 cm. */
export const AREA_DISPONIBLE_CM = { ancho: 25, largo: 30 } as const;

/** Cómo se acomodan las unidades en el clisé. */
export interface DisposicionClise {
  /** Ancho de una unidad. */
  anchoCm: number;
  /** Alto de una unidad. */
  altoCm: number;
  /** Espacio entre unidades (en el Excel: 0,3 cm troquelado, 0 cm corte bisturí). */
  espacioCm: number;
  /** Unidades a lo largo. */
  horizontal: number;
  /** Unidades a lo ancho. */
  vertical: number;
}

export interface TamanoClise {
  largoCm: number;
  anchoCm: number;
  /** largo × ancho sin redondear (el Excel muestra 412 pero calcula con 411,72). */
  cm2: number;
  /** Unidades por clisé = horizontal × vertical. */
  unidades: number;
  /** Si cabe en el área disponible de la plancha, en cualquier orientación. */
  cabe: boolean;
}

/**
 * largo = ancho × horizontal + espacio × (horizontal − 1) + margen
 * ancho = alto × vertical + espacio × (vertical − 1) + margen
 *
 * Ej. llavero troquelado 5 × 4 cm, espacio 0,3, 5 × 3 → 28,2 × 14,6 cm = 411,72 cm².
 */
export function tamanoClise(d: DisposicionClise): TamanoClise {
  exigirPositivo(d.anchoCm, 'anchoCm');
  exigirPositivo(d.altoCm, 'altoCm');
  exigirNoNegativo(d.espacioCm, 'espacioCm');
  for (const campo of ['horizontal', 'vertical'] as const) {
    if (!Number.isInteger(d[campo]) || d[campo] < 1) {
      throw new ErrorValidacion(`${campo} debe ser un entero mayor o igual a 1 (se recibió ${d[campo]})`, campo);
    }
  }
  const largoCm = d.anchoCm * d.horizontal + d.espacioCm * (d.horizontal - 1) + MARGEN_CLISE_CM;
  const anchoCm = d.altoCm * d.vertical + d.espacioCm * (d.vertical - 1) + MARGEN_CLISE_CM;
  const { ancho, largo } = AREA_DISPONIBLE_CM;
  return {
    largoCm,
    anchoCm,
    cm2: largoCm * anchoCm,
    unidades: d.horizontal * d.vertical,
    cabe: (largoCm <= largo && anchoCm <= ancho) || (largoCm <= ancho && anchoCm <= largo),
  };
}

/** Gramos de material por clisé = gramos por cm² del espesor × cm² del clisé   (Excel: "NUEVOS GRAMOS") */
export function gramosPorClise(p: { gramosPorCm2: number; cm2: number }): number {
  exigirNoNegativo(p.gramosPorCm2, 'gramosPorCm2');
  exigirNoNegativo(p.cm2, 'cm2');
  return p.gramosPorCm2 * p.cm2;
}
