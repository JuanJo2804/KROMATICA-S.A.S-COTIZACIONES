/**
 * Fechas sin hora (columnas @db.Date). Prisma las maneja como Date a medianoche UTC,
 * así que se convierten a "AAAA-MM-DD" para que el cliente no las corra un día por la zona horaria.
 */

const ZONA_HORARIA = 'America/Bogota';

/** Día de hoy en Colombia, como Date a medianoche UTC (lo que espera una columna DATE). */
export function hoyEnColombia(ahora = new Date()): Date {
  // en-CA da el formato AAAA-MM-DD.
  return new Date(ahora.toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA }));
}

export const aTextoFecha = (fecha: Date | null): string | null => (fecha ? fecha.toISOString().slice(0, 10) : null);
