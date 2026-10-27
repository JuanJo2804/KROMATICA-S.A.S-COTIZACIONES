import { describe, expect, it } from 'vitest';
import {
  calcularCotizacion,
  construirConceptos,
  costoClise,
  ErrorValidacion,
  gramosPorClise,
  porcentajesPorFila,
  tamanoClise,
  troqueladaPorUnidad,
  troqueladasPorHora,
} from '../src/index.js';

describe('Tamaño del clisé (recuadro "TAMAÑO CLISE" del Excel)', () => {
  it('llavero troquelado 5 × 4 cm, espacio 0,3, 5 × 3 → 28 × 15 cm, $201.743 a $490/cm²', () => {
    const t = tamanoClise({ anchoCm: 5, altoCm: 4, espacioCm: 0.3, horizontal: 5, vertical: 3 });
    expect(t.largoCm).toBeCloseTo(28.2, 10);
    expect(t.anchoCm).toBeCloseTo(14.6, 10);
    expect(t.cm2).toBeCloseTo(411.72, 10);
    expect(t.unidades).toBe(15);
    expect(t.cabe).toBe(true);
    expect(Math.round(costoClise({ cm2: t.cm2, cantidadClises: 1, precioCm2: 490 }))).toBe(201743);
  });

  it('aplique corte bisturí 2,7 × 8 cm, sin espacio, 6 × 3 → 18 × 26 cm, $231.868 a $490/cm²', () => {
    const t = tamanoClise({ anchoCm: 2.7, altoCm: 8, espacioCm: 0, horizontal: 6, vertical: 3 });
    expect(t.largoCm).toBeCloseTo(18.2, 10);
    expect(t.anchoCm).toBeCloseTo(26, 10);
    expect(t.cm2).toBeCloseTo(473.2, 10);
    // 18,2 × 26 no cabe en 25 × 30 así, pero sí girado (26 ≤ 30 y 18,2 ≤ 25).
    expect(t.cabe).toBe(true);
    expect(Math.round(costoClise({ cm2: t.cm2, cantidadClises: 1, precioCm2: 490 }))).toBe(231868);
  });

  it('avisa cuando no cabe en el área disponible de 25 × 30 cm', () => {
    expect(tamanoClise({ anchoCm: 5, altoCm: 4, espacioCm: 0.3, horizontal: 6, vertical: 6 }).cabe).toBe(false);
  });

  it('rechaza cantidades que no son enteras', () => {
    expect(() => tamanoClise({ anchoCm: 5, altoCm: 4, espacioCm: 0, horizontal: 2.5, vertical: 3 })).toThrow(
      ErrorValidacion,
    );
  });
});

describe('Gramos por clisé (tabla "GRAMOS POR CM²")', () => {
  // Columna "NUEVOS GRAMOS" para un clisé de 412 cm².
  it.each([
    ['0,8 mm', 30 / 373, 33],
    ['1 mm', 40 / 375, 44],
    ['5 mm', 253 / 532, 196],
    ['llavero 1 cm', 210 / 174, 497],
  ])('%s → %i g', (_espesor, relacion, esperado) => {
    expect(Math.round(gramosPorClise({ gramosPorCm2: relacion, cm2: 412 }))).toBe(esperado);
  });
});

describe('Troquelada', () => {
  it('convierte troqueladas por hora en $ por unidad y al revés (hoja del Excel: $130 → 150,9 por hora)', () => {
    expect(troqueladasPorHora({ valorMinuto: 327, troqueladaPorUnidad: 130 })).toBeCloseTo(150.923076923077, 9);
    expect(troqueladaPorUnidad({ valorMinuto: 327, troqueladasPorHora: 150.923076923077 })).toBeCloseTo(130, 9);
  });

  it('construirConceptos usa las troqueladas por hora si no hay $ por unidad', () => {
    const base = { moMin: 10, montaje: 12, valorMinuto: 450, gramosPorClise: 60, precioGramo: 30 };
    const porHora = construirConceptos({ ...base, troqueladasPorHora: 225 });
    expect(porHora.find((c) => c.codigo === 'troquelada')?.porUnidad).toBeCloseTo(120, 10);
    const ambos = construirConceptos({ ...base, troqueladasPorHora: 225, troqueladaPorUnidad: 100 });
    expect(ambos.find((c) => c.codigo === 'troquelada')?.porUnidad).toBe(100);
  });
});

describe('Aceptación: hoja de referencia del Excel (aplique bisturí 4,5 × 1,2 cm)', () => {
  // Datos tal como están en la hoja: valor minuto $435 (marzo 2026), 60 g por clisé, clisé de 224 cm² a $500,
  // 450 troqueladas por hora ($58), empaque final $2, CIF 15 % y 10 % (cada fila), administración 5 % (primera fila).
  const conceptos = construirConceptos({
    moMin: 10,
    montaje: 20,
    valorMinuto: 435,
    gramosPorClise: 60,
    precioGramo: 30,
    clise: { cm2: 224, cantidadClises: 1, precioCm2: 500 },
    troqueladasPorHora: 450,
    empaque: [{ nombre: 'Empaque final', valor: 2 }],
  });
  const resultado = calcularCotizacion({
    cantidades: [300, 500],
    conceptos,
    cif: [
      { porcentaje: 0.15, filaBase: 0 },
      { porcentaje: 0.1, filaBase: 1 },
    ],
    administracion: porcentajesPorFila([0.05], 'PRIMERA_FILA', 2),
    margenes: [0.43, 0.32, 0.3, 0.25].map((valor) => ({ valor, sobre: 'COSTO' as const })),
  });

  it('da el mismo costo total que el Excel: $889 y $687,69', () => {
    expect(resultado.filas[0]!.administracion).toBeCloseTo(37.0416666666667, 9);
    expect(resultado.filas[0]!.cif).toBeCloseTo(111.125, 9);
    expect(resultado.filas[0]!.costoTotal).toBeCloseTo(889, 9);
    expect(resultado.filas[1]!.cif).toBeCloseTo(59.15, 9);
    expect(resultado.filas[1]!.costoTotal).toBeCloseTo(687.691666666667, 9);
  });
});

describe('Troqueles por tipo', () => {
  it('hierro, madera y eléctrico se suman al costo fijo del troquel', () => {
    const conceptos = construirConceptos({
      moMin: 10,
      montaje: 12,
      valorMinuto: 450,
      gramosPorClise: 60,
      precioGramo: 30,
      troquel: 1000,
      troqueles: [
        { nombre: 'Hierro', valor: 40000 },
        { nombre: 'Madera', valor: 10000 },
      ],
    });
    expect(conceptos.find((c) => c.codigo === 'troquel')?.fijo).toBe(51000);
  });
});
