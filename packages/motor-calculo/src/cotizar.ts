/**
 * Cálculo de costos y precios de una cotización para cada cantidad.
 *
 * Reproduce la tabla inferior de la plantilla de Excel:
 *
 *   cantidad | troquel | clisé | … | empaque | administra | cif | costo total | margen 1 | margen 2 | …
 */
import { ErrorValidacion, exigirNoNegativo, exigirPositivo } from './errores.js';
import type {
  BaseCalculo,
  EntradaCotizacion,
  FilaCotizacion,
  Margen,
  PorcentajeFila,
  PrecioCalculado,
  ResultadoCotizacion,
} from './tipos.js';

/**
 * Arma los porcentajes por fila a partir de una lista corta de porcentajes y una base.
 * Si hay menos porcentajes que filas, se repite el último.
 *
 * Ej.: porcentajesPorFila([0.16, 0.10, 0.05], 'PRIMERA_FILA', 3)
 *   → [{0.16, base 0}, {0.10, base 0}, {0.05, base 0}]
 */
export function porcentajesPorFila(porcentajes: number[], base: BaseCalculo, filas: number): PorcentajeFila[] {
  if (porcentajes.length === 0) {
    throw new ErrorValidacion('Se necesita al menos un porcentaje', 'porcentajes');
  }
  return Array.from({ length: filas }, (_, i) => ({
    porcentaje: porcentajes[Math.min(i, porcentajes.length - 1)]!,
    filaBase: base === 'PRIMERA_FILA' ? 0 : i,
  }));
}

/** Redondea al múltiplo más cercano (ej. a decenas: 1.488,7 → 1.490). */
export function redondearPrecio(valor: number, multiplo = 10): number {
  if (multiplo <= 0) return valor;
  return Math.round(valor / multiplo) * multiplo;
}

function validar(e: EntradaCotizacion): void {
  if (e.cantidades.length === 0) {
    throw new ErrorValidacion('Debe haber al menos una cantidad', 'cantidades');
  }
  e.cantidades.forEach((q, i) => exigirPositivo(q, `cantidades[${i}]`));
  e.conceptos.forEach((c, i) => {
    if (!Number.isFinite(c.porUnidad)) throw new ErrorValidacion('porUnidad inválido', `conceptos[${i}].porUnidad`);
    if (!Number.isFinite(c.fijo)) throw new ErrorValidacion('fijo inválido', `conceptos[${i}].fijo`);
  });
  for (const [campo, lista] of [
    ['cif', e.cif],
    ['administracion', e.administracion],
  ] as const) {
    if (lista.length !== e.cantidades.length) {
      throw new ErrorValidacion(
        `${campo} debe tener un porcentaje por cada cantidad (${e.cantidades.length})`,
        campo,
      );
    }
    lista.forEach((p, i) => {
      exigirNoNegativo(p.porcentaje, `${campo}[${i}].porcentaje`);
      if (!Number.isInteger(p.filaBase) || p.filaBase < 0 || p.filaBase >= e.cantidades.length) {
        throw new ErrorValidacion(`filaBase fuera de rango`, `${campo}[${i}].filaBase`);
      }
    });
  }
  if (e.margenes.length === 0) {
    throw new ErrorValidacion('Debe haber al menos un margen', 'margenes');
  }
  e.margenes.forEach((m, i) => {
    if (!(m.valor >= 0 && m.valor < 1)) {
      throw new ErrorValidacion('El margen debe estar entre 0 y 1 (ej. 0.30 = 30 %)', `margenes[${i}].valor`);
    }
    if (m.sobre !== 'COSTO' && (!Number.isInteger(m.sobre) || m.sobre < 0 || m.sobre >= e.margenes.length || m.sobre === i)) {
      throw new ErrorValidacion('El margen hace referencia a otro margen inexistente', `margenes[${i}].sobre`);
    }
  });
}

/**
 * Precios de cada opción de margen para un costo total dado.
 * Se exporta para recalcular el precio elegido a partir del costo guardado en una cotización.
 */
export function calcularPrecios(
  costoTotal: number,
  cantidad: number,
  margenes: Margen[],
  redondeo = 10,
): PrecioCalculado[] {
  const exactos: (number | undefined)[] = new Array(margenes.length);
  const enCurso = new Set<number>();

  const precio = (i: number): number => {
    const ya = exactos[i];
    if (ya !== undefined) return ya;
    if (enCurso.has(i)) throw new ErrorValidacion('Los márgenes se referencian en círculo', `margenes[${i}].sobre`);
    enCurso.add(i);
    const m = margenes[i]!;
    const base = m.sobre === 'COSTO' ? costoTotal : precio(m.sobre);
    const valor = base / (1 - m.valor);
    exactos[i] = valor;
    enCurso.delete(i);
    return valor;
  };

  return margenes.map((m, i) => {
    const precioUnitario = precio(i);
    const precioRedondeado = redondearPrecio(precioUnitario, redondeo);
    const gananciaUnitaria = precioRedondeado - costoTotal;
    return {
      margen: m.valor,
      sobre: m.sobre,
      precioUnitario,
      precioRedondeado,
      gananciaUnitaria,
      gananciaTotal: gananciaUnitaria * cantidad,
    };
  });
}

export function calcularCotizacion(entrada: EntradaCotizacion): ResultadoCotizacion {
  validar(entrada);
  const redondeo = entrada.redondeo ?? 10;

  // 1. Costo unitario de cada concepto y subtotal por fila
  const parciales = entrada.cantidades.map((cantidad) => {
    const conceptos = entrada.conceptos.map((c) => ({
      codigo: c.codigo,
      nombre: c.nombre,
      costoUnitario: c.porUnidad + c.fijo / cantidad,
    }));
    const subtotal = conceptos.reduce((s, c) => s + c.costoUnitario, 0);
    return { cantidad, conceptos, subtotal };
  });

  // 2. Administración y CIF (cada una sobre el subtotal de su fila base), costo total y precios
  const filas: FilaCotizacion[] = parciales.map((p, i) => {
    const adm = entrada.administracion[i]!;
    const cif = entrada.cif[i]!;
    const administracion = parciales[adm.filaBase]!.subtotal * adm.porcentaje;
    const valorCif = parciales[cif.filaBase]!.subtotal * cif.porcentaje;
    const costoTotal = p.subtotal + administracion + valorCif;
    return {
      ...p,
      administracion,
      cif: valorCif,
      costoTotal,
      precios: calcularPrecios(costoTotal, p.cantidad, entrada.margenes, redondeo),
    };
  });

  return { filas };
}
