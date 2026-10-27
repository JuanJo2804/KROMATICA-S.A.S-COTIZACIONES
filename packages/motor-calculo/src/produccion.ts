/**
 * Tiempos de producción.
 *
 * El único dato que da la operaria es `moMin`: los minutos que tarda en hacer UNA plancha.
 * Todo lo demás se deriva de él.
 */
import { exigirPositivo } from './errores.js';

/** planchas/hora = 60 / MO min   (Excel: =60/K11) */
export function planchasPorHora(moMin: number): number {
  exigirPositivo(moMin, 'moMin');
  return 60 / moMin;
}

/** Horas de trabajo por día a partir de la jornada semanal (ej. 42 h / 5 días = 8,4 h). */
export function horasPorDia(p: { horasSemanales: number; diasLaborales: number }): number {
  exigirPositivo(p.horasSemanales, 'horasSemanales');
  exigirPositivo(p.diasLaborales, 'diasLaborales');
  return p.horasSemanales / p.diasLaborales;
}

/** unidades/día = horas/día × planchas/hora × montaje   (Excel: =9.5*O12*B14) */
export function unidadesPorDia(p: { moMin: number; montaje: number; horasPorDia: number }): number {
  exigirPositivo(p.montaje, 'montaje');
  exigirPositivo(p.horasPorDia, 'horasPorDia');
  return p.horasPorDia * planchasPorHora(p.moMin) * p.montaje;
}

/** días requeridos = cantidad / (horas/día × planchas/hora × montaje)   (Excel: =O66/(10*$O$12*$B$14)) */
export function diasRequeridos(p: {
  cantidad: number;
  moMin: number;
  montaje: number;
  horasPorDia: number;
}): number {
  exigirPositivo(p.cantidad, 'cantidad');
  return p.cantidad / unidadesPorDia(p);
}
