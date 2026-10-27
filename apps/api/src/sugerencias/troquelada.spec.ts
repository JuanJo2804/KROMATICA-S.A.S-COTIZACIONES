import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sugerirTroquelada, type MuestraTroquelada } from './troquelada.js';

const muestra = (id: number, troqueladasPorHora: number, extra: Partial<MuestraTroquelada> = {}): MuestraTroquelada => ({
  id,
  tipoProducto: 'llavero',
  tipoCorte: 'TROQUELADO',
  anchoCm: 5,
  altoCm: 4,
  montaje: 15,
  gramosPorCm2: 0.27,
  tintas: 2,
  troqueladasPorHora,
  ...extra,
});

describe('sugerirTroquelada', () => {
  it('prefiere cotizaciones con el mismo tipo de corte y producto', () => {
    const historial = [
      muestra(1, 150),
      muestra(2, 160),
      muestra(3, 600, { tipoCorte: 'BISTURI' }),
      muestra(4, 900, { tipoProducto: 'marquilla', tipoCorte: 'BISTURI' }),
    ];
    const s = sugerirTroquelada({ tipoProducto: 'llavero', tipoCorte: 'TROQUELADO', anchoCm: 5, altoCm: 4 }, historial, 2);
    expect(s.troqueladasPorHora).toBe(150);
    expect(s.similares.every((x) => x.tipoCorte === 'TROQUELADO')).toBe(true);
  });

  it('devuelve null sin historial', () => {
    expect(sugerirTroquelada({ tipoProducto: 'llavero' }, []).troqueladasPorHora).toBeNull();
  });

  it('reporta confianza alta cuando hay vecinos idénticos y coherentes', () => {
    const historial = Array.from({ length: 10 }, (_, i) => muestra(i, 200 + i));
    const consulta = { tipoProducto: 'llavero', tipoCorte: 'TROQUELADO', anchoCm: 5, altoCm: 4, montaje: 15, gramosPorCm2: 0.27, tintas: 2 };
    expect(sugerirTroquelada(consulta, historial).confianza).toBe('alta');
  });
});

// El historial real vive en `datos-privados/` (repositorio privado aparte); sin él esta prueba se salta.
const HISTORIAL = new URL('../../../../datos-privados/historial-excel.json', import.meta.url);
const hayHistorial = existsSync(HISTORIAL);

describe.skipIf(!hayHistorial)('precisión con el historial real del Excel', () => {
  interface Historico extends Omit<MuestraTroquelada, 'id' | 'troqueladasPorHora'> {
    troqueladasPorHora: number | null;
  }
  const historial = (
    (hayHistorial ? JSON.parse(readFileSync(HISTORIAL, 'utf-8')) : []) as Historico[]
  )
    .filter((h): h is Historico & { troqueladasPorHora: number } => h.troqueladasPorHora !== null)
    .map((h, id) => ({ ...h, id }));

  it('se equivoca bastante menos que usar siempre el valor típico', () => {
    const relativo = (estimado: number, real: number) => Math.abs(estimado - real) / real;
    const errores = historial.map((h) => {
      // Se excluyen las cotizaciones del mismo cliente para no "hacer trampa".
      const otros = historial.filter((m) => m.id !== h.id && (m.cliente ?? '').toUpperCase() !== (h.cliente ?? '#').toUpperCase());
      return relativo(sugerirTroquelada(h, otros).troqueladasPorHora!, h.troqueladasPorHora);
    });
    const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const tipico = mediana(historial.map((h) => h.troqueladasPorHora));
    const errorMediano = mediana(errores);
    const errorBase = mediana(historial.map((h) => relativo(tipico, h.troqueladasPorHora)));
    const dentroDe25 = errores.filter((e) => e <= 0.25).length / errores.length;

    console.info(
      `Troquelada: error mediano ${(errorMediano * 100).toFixed(1)} % | ±25 %: ${(dentroDe25 * 100).toFixed(0)} % | ` +
        `valor típico: ${(errorBase * 100).toFixed(1)} % (${historial.length} cotizaciones)`,
    );
    expect(errorMediano).toBeLessThan(0.2);
    expect(errorMediano).toBeLessThan(errorBase * 0.5);
    expect(dentroDe25).toBeGreaterThan(0.55);
  });
});
