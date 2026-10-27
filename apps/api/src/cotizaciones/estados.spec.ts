import { describe, expect, it } from 'vitest';
import { aceptaTiempoReal, esEditable, puedeCambiar } from './estados.js';

describe('ciclo de vida de la cotización', () => {
  it.each([
    ['BORRADOR', 'ENVIADA'],
    ['ENVIADA', 'APROBADA'],
    ['ENVIADA', 'RECHAZADA'],
    ['ENVIADA', 'BORRADOR'],
    ['APROBADA', 'EN_PRUEBAS'],
    ['APROBADA', 'EN_PRODUCCION'],
    ['EN_PRUEBAS', 'EN_PRODUCCION'],
    ['EN_PRODUCCION', 'TERMINADA'],
    ['EN_PRUEBAS', 'CANCELADA'],
  ] as const)('permite %s → %s', (desde, hacia) => {
    expect(puedeCambiar(desde, hacia)).toBe(true);
  });

  it.each([
    ['BORRADOR', 'APROBADA'],
    ['BORRADOR', 'TERMINADA'],
    ['APROBADA', 'ENVIADA'],
    ['TERMINADA', 'EN_PRODUCCION'],
    ['RECHAZADA', 'APROBADA'],
    ['HISTORICA', 'ENVIADA'],
  ] as const)('no permite %s → %s', (desde, hacia) => {
    expect(puedeCambiar(desde, hacia)).toBe(false);
  });

  it('solo se edita en borrador', () => {
    expect(esEditable('BORRADOR')).toBe(true);
    expect(esEditable('ENVIADA')).toBe(false);
  });

  it('el tiempo real solo se registra en producción o terminada', () => {
    expect(aceptaTiempoReal('EN_PRODUCCION')).toBe(true);
    expect(aceptaTiempoReal('TERMINADA')).toBe(true);
    expect(aceptaTiempoReal('APROBADA')).toBe(false);
  });
});
