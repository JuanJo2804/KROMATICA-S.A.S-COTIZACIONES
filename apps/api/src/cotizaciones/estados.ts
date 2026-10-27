/**
 * Ciclo de vida de una cotización:
 *
 *   BORRADOR → ENVIADA → APROBADA → EN_PRUEBAS → EN_PRODUCCION → TERMINADA
 *                 ↓           ↘_____________________↗
 *             RECHAZADA
 *
 * EN_PRUEBAS: se manda a hacer el clisé y se hacen muestras para el cliente.
 * Desde cualquier estado activo se puede CANCELAR.
 */
import type { EstadoCotizacion } from '../generated/prisma/enums.js';

const TRANSICIONES: Record<EstadoCotizacion, EstadoCotizacion[]> = {
  BORRADOR: ['ENVIADA', 'CANCELADA'],
  ENVIADA: ['APROBADA', 'RECHAZADA', 'BORRADOR', 'CANCELADA'],
  APROBADA: ['EN_PRUEBAS', 'EN_PRODUCCION', 'CANCELADA'],
  EN_PRUEBAS: ['EN_PRODUCCION', 'CANCELADA'],
  EN_PRODUCCION: ['TERMINADA', 'CANCELADA'],
  TERMINADA: [],
  RECHAZADA: [],
  CANCELADA: [],
  HISTORICA: [],
};

export function transicionesPermitidas(desde: EstadoCotizacion): EstadoCotizacion[] {
  return TRANSICIONES[desde];
}

export function puedeCambiar(desde: EstadoCotizacion, hacia: EstadoCotizacion): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

/** Solo se pueden editar los datos y los precios mientras la cotización es un borrador. */
export const esEditable = (estado: EstadoCotizacion) => estado === 'BORRADOR';

/** El tiempo real se registra durante o después de la producción. */
export const aceptaTiempoReal = (estado: EstadoCotizacion) => estado === 'EN_PRODUCCION' || estado === 'TERMINADA';
