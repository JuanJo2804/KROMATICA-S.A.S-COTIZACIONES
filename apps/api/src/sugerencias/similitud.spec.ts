import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sugerirMoMin, type Muestra } from './similitud.js';

const muestra = (id: number, tintas: number, moMin: number, extra: Partial<Muestra> = {}): Muestra => ({
  id,
  tipoProducto: 'llavero',
  tintas,
  montaje: 12,
  anchoCm: 5,
  altoCm: 4,
  moMin,
  ...extra,
});

describe('sugerirMoMin', () => {
  it('prefiere cotizaciones con el mismo número de tintas', () => {
    const historial = [muestra(1, 2, 15), muestra(2, 2, 15), muestra(3, 5, 40), muestra(4, 6, 45)];
    const s = sugerirMoMin({ tipoProducto: 'llavero', tintas: 2, montaje: 12, anchoCm: 5, altoCm: 4 }, historial, 4);
    expect(s.moMin).toBe(15);
    expect(s.similares[0]!.tintas).toBe(2);
  });

  it('devuelve null sin historial', () => {
    expect(sugerirMoMin({ tintas: 2, montaje: 12 }, []).moMin).toBeNull();
  });

  it('reporta confianza alta cuando hay vecinos idénticos y coherentes', () => {
    const historial = Array.from({ length: 10 }, (_, i) => muestra(i, 3, 20));
    expect(sugerirMoMin({ tipoProducto: 'llavero', tintas: 3, montaje: 12, anchoCm: 5, altoCm: 4 }, historial).confianza).toBe('alta');
  });
});

// El historial real vive en `datos-privados/` (repositorio privado aparte); sin él esta prueba se salta.
const HISTORIAL = new URL('../../../../datos-privados/historial-excel.json', import.meta.url);
const hayHistorial = existsSync(HISTORIAL);

describe.skipIf(!hayHistorial)('precisión con el historial real del Excel', () => {
  interface Historico extends Omit<Muestra, 'id'> {
    hoja: string;
    cliente: string | null;
  }
  const historial = (
    (hayHistorial ? JSON.parse(readFileSync(HISTORIAL, 'utf-8')) : []) as Historico[]
  ).map((h, id) => ({ ...h, id }));

  it('se equivoca bastante menos que usar siempre el valor típico', () => {
    const errores = historial.map((h) => {
      // Se excluyen las cotizaciones del mismo cliente para no "hacer trampa".
      const otros = historial.filter((m) => m.id !== h.id && (m.cliente ?? '').toUpperCase() !== (h.cliente ?? '#').toUpperCase());
      return Math.abs(sugerirMoMin(h, otros).moMin! - h.moMin);
    });
    const mae = errores.reduce((a, b) => a + b, 0) / errores.length;
    const dentroDe5 = errores.filter((e) => e <= 5).length / errores.length;

    const valores = historial.map((h) => h.moMin).sort((a, b) => a - b);
    const mediana = valores[Math.floor(valores.length / 2)]!;
    const maeBase = historial.reduce((t, h) => t + Math.abs(h.moMin - mediana), 0) / historial.length;

    console.info(`MAE sugerencia: ${mae.toFixed(2)} min | ±5 min: ${(dentroDe5 * 100).toFixed(0)} % | MAE base: ${maeBase.toFixed(2)} min`);
    expect(mae).toBeLessThan(5.5);
    expect(mae).toBeLessThan(maeBase * 0.7);
    expect(dentroDe5).toBeGreaterThan(0.7);
  });
});
