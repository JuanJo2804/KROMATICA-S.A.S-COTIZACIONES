import { describe, expect, it } from 'vitest';
import {
  calcularCotizacion,
  construirConceptos,
  ErrorValidacion,
  horasPorDia,
  porcentajesPorFila,
  redondearPrecio,
  type EntradaCotizacion,
} from '../src/index.js';

describe('Aceptación: cotización de referencia enviada a un cliente', () => {
  // Aplique en PVC, base más un color, 5 x 2 cm, corte recto.
  // Enviado al cliente: 300 uds $1.760 + IVA, 500 uds $1.490 + IVA (margen 30 %).
  const conceptos = construirConceptos({
    moMin: 10,
    montaje: 12,
    valorMinuto: 450,
    gramosPorClise: 60,
    precioGramo: 30,
    clise: { cm2: 224, cantidadClises: 1, precioCm2: 500 },
    troqueladaPorUnidad: 120,
  });
  const resultado = calcularCotizacion({
    cantidades: [300, 500],
    conceptos,
    cif: [
      { porcentaje: 0.16, filaBase: 0 },
      { porcentaje: 0.12, filaBase: 0 },
    ],
    administracion: porcentajesPorFila([0.05], 'PRIMERA_FILA', 2),
    margenes: [0.35, 0.3, 0.25].map((valor) => ({ valor, sobre: 'COSTO' as const })),
  });

  it('calcula el mismo costo total que el Excel', () => {
    expect(resultado.filas[0]!.costoTotal).toBeCloseTo(1232.1833, 3);
    expect(resultado.filas[1]!.costoTotal).toBeCloseTo(1042.1167, 3);
  });

  it('da los precios que se le enviaron al cliente con margen 30 %', () => {
    const precio30 = (fila: number) => resultado.filas[fila]!.precios.find((p) => p.margen === 0.3)!;
    expect(precio30(0).precioRedondeado).toBe(1760);
    expect(precio30(1).precioRedondeado).toBe(1490);
  });
});

describe('calcularCotizacion', () => {
  const base: EntradaCotizacion = {
    cantidades: [100, 200],
    conceptos: [
      { codigo: 'troquel', nombre: 'Troquel', porUnidad: 0, fijo: 10000 },
      { codigo: 'material', nombre: 'Material', porUnidad: 50, fijo: 0 },
    ],
    cif: porcentajesPorFila([0.1], 'PROPIA_FILA', 2),
    administracion: porcentajesPorFila([0], 'PRIMERA_FILA', 2),
    margenes: [{ valor: 0.5, sobre: 'COSTO' }],
    redondeo: 0,
  };

  it('reparte los costos fijos entre la cantidad', () => {
    const { filas } = calcularCotizacion(base);
    expect(filas[0]!.subtotal).toBe(150); // 50 + 10000/100
    expect(filas[1]!.subtotal).toBe(100); // 50 + 10000/200
  });

  it('calcula el CIF sobre la fila base indicada', () => {
    const propia = calcularCotizacion(base).filas[1]!;
    expect(propia.cif).toBeCloseTo(10); // 10 % de 100
    const primera = calcularCotizacion({ ...base, cif: porcentajesPorFila([0.1], 'PRIMERA_FILA', 2) }).filas[1]!;
    expect(primera.cif).toBeCloseTo(15); // 10 % de 150
  });

  it('calcula un margen sobre el precio de otro margen (precio intermediario)', () => {
    const { filas } = calcularCotizacion({
      ...base,
      margenes: [
        { valor: 0.5, sobre: 'COSTO' },
        { valor: 0.2, sobre: 0 },
      ],
    });
    const [p1, p2] = filas[0]!.precios;
    expect(p1!.precioUnitario).toBeCloseTo(330); // 165 / 0.5
    expect(p2!.precioUnitario).toBeCloseTo(412.5); // 330 / 0.8
  });

  it('calcula la ganancia del pedido con el precio redondeado', () => {
    const fila = calcularCotizacion({ ...base, redondeo: 10 }).filas[0]!;
    // costo 165 → precio 330 → ganancia 165 × 100 uds
    expect(fila.precios[0]!.gananciaTotal).toBeCloseTo(16500);
  });

  it.each([
    ['sin cantidades', { cantidades: [], cif: [], administracion: [] }],
    ['cantidad cero', { cantidades: [0, 200] }],
    ['margen del 100 %', { margenes: [{ valor: 1, sobre: 'COSTO' }] }],
    ['CIF incompleto', { cif: [{ porcentaje: 0.1, filaBase: 0 }] }],
    ['fila base inexistente', { cif: [{ porcentaje: 0.1, filaBase: 5 }, { porcentaje: 0.1, filaBase: 0 }] }],
    ['margen sobre sí mismo', { margenes: [{ valor: 0.2, sobre: 0 }] }],
  ] as const)('rechaza datos inválidos: %s', (_caso, cambio) => {
    expect(() => calcularCotizacion({ ...base, ...(cambio as unknown as Partial<EntradaCotizacion>) })).toThrow(ErrorValidacion);
  });

  it('rechaza márgenes que se referencian en círculo', () => {
    expect(() =>
      calcularCotizacion({
        ...base,
        margenes: [
          { valor: 0.2, sobre: 1 },
          { valor: 0.2, sobre: 0 },
        ],
      }),
    ).toThrow(/círculo/);
  });
});

describe('utilidades', () => {
  it('redondea el precio a decenas', () => {
    expect(redondearPrecio(1488.74)).toBe(1490);
    expect(redondearPrecio(1760.26)).toBe(1760);
    expect(redondearPrecio(2987.44)).toBe(2990);
  });

  it('repite el último porcentaje si hay más cantidades que porcentajes', () => {
    expect(porcentajesPorFila([0.16, 0.1], 'PRIMERA_FILA', 3).map((p) => p.porcentaje)).toEqual([0.16, 0.1, 0.1]);
  });

  it('calcula horas por día desde la jornada semanal', () => {
    expect(horasPorDia({ horasSemanales: 42, diasLaborales: 5 })).toBeCloseTo(8.4);
  });
});
