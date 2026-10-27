/**
 * Pruebas "golden": el motor debe reproducir los resultados de las hojas reales del Excel histórico.
 * Los casos se generan con herramientas/importar-excel/02_generar_casos_prueba.py y viven en `datos-privados/`
 * (repositorio privado aparte: tienen clientes y precios reales). Sin esa carpeta estas pruebas se saltan.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calcularCotizacion,
  diasRequeridos,
  manoDeObraPorUnidad,
  materialPorUnidad,
  planchasPorHora,
  type EntradaCotizacion,
} from '../src/index.js';

interface CasoCotizacion {
  hoja: string;
  entrada: EntradaCotizacion;
  esperado: { subtotal: number; administracion: number; cif: number; costoTotal: number; precios: number[] }[];
}

const DATOS = new URL('../../../datos-privados/', import.meta.url);
const hayDatos = existsSync(new URL('hojas-excel-cotizacion.json', DATOS));
const leer = <T>(archivo: string, vacio: T): T =>
  hayDatos ? (JSON.parse(readFileSync(new URL(archivo, DATOS), 'utf-8')) as T) : vacio;

const casos = leer<CasoCotizacion[]>('hojas-excel-cotizacion.json', []);
const insumos = leer<Record<string, any>[]>('hojas-excel-insumos.json', []);

/** Igualdad con tolerancia relativa: el Excel guarda ~15 dígitos significativos. */
function cerca(real: number, esperado: number, tolerancia = 1e-9): boolean {
  return Math.abs(real - esperado) <= tolerancia * Math.max(1, Math.abs(esperado));
}

describe.skipIf(!hayDatos)('Reproduce las cotizaciones del Excel histórico', () => {
  it(`hay suficientes hojas para validar (${casos.length})`, () => {
    expect(casos.length).toBeGreaterThan(500);
  });

  it.each(casos.map((c) => [c.hoja, c] as const))('hoja "%s"', (_hoja, caso) => {
    const { filas } = calcularCotizacion(caso.entrada);
    filas.forEach((fila, i) => {
      const e = caso.esperado[i]!;
      const contexto = `cantidad ${fila.cantidad}`;
      expect(cerca(fila.subtotal, e.subtotal), `${contexto}: subtotal ${fila.subtotal} ≠ ${e.subtotal}`).toBe(true);
      expect(cerca(fila.administracion, e.administracion), `${contexto}: administración`).toBe(true);
      expect(cerca(fila.cif, e.cif), `${contexto}: CIF ${fila.cif} ≠ ${e.cif}`).toBe(true);
      expect(cerca(fila.costoTotal, e.costoTotal), `${contexto}: costo total`).toBe(true);
      fila.precios.forEach((p, j) => {
        expect(cerca(p.precioUnitario, e.precios[j]!), `${contexto}: precio con margen ${p.margen}`).toBe(true);
      });
    });
  });
});

describe.skipIf(!hayDatos)('Reproduce las fórmulas de insumos del Excel histórico', () => {
  const de = (clave: string) => insumos.filter((c) => c[clave]).map((c) => [c.hoja, c[clave]] as const);

  it.each(de('manoDeObra'))('mano de obra — hoja "%s"', (_h, c) => {
    expect(cerca(manoDeObraPorUnidad(c), c.esperado)).toBe(true);
  });
  it.each(de('material'))('material — hoja "%s"', (_h, c) => {
    expect(cerca(materialPorUnidad(c), c.esperado)).toBe(true);
  });
  it.each(de('planchasPorHora'))('planchas por hora — hoja "%s"', (_h, c) => {
    expect(cerca(planchasPorHora(c.moMin), c.esperado)).toBe(true);
  });
  it.each(de('diasRequeridos'))('días requeridos — hoja "%s"', (_h, c) => {
    expect(cerca(diasRequeridos(c), c.esperado)).toBe(true);
  });
});
