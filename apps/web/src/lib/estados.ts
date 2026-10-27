/** Estados de una cotización (enum EstadoCotizacion de la API), con su nombre y color. */

export const ESTADOS = [
  "BORRADOR",
  "ENVIADA",
  "APROBADA",
  "EN_PRUEBAS",
  "EN_PRODUCCION",
  "TERMINADA",
  "RECHAZADA",
  "CANCELADA",
  "HISTORICA",
] as const;

export type EstadoCotizacion = (typeof ESTADOS)[number];

export const NOMBRE_ESTADO: Record<EstadoCotizacion, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  APROBADA: "Aprobada",
  EN_PRUEBAS: "En pruebas",
  EN_PRODUCCION: "En producción",
  TERMINADA: "Terminada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
  HISTORICA: "Histórica",
};

export const COLOR_ESTADO: Record<EstadoCotizacion, string> = {
  BORRADOR: "bg-slate-100 text-slate-700 ring-slate-200",
  ENVIADA: "bg-sky-50 text-sky-700 ring-sky-200",
  APROBADA: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EN_PRUEBAS: "bg-amber-50 text-amber-700 ring-amber-200",
  EN_PRODUCCION: "bg-violet-50 text-violet-700 ring-violet-200",
  TERMINADA: "bg-emerald-600 text-white ring-emerald-600",
  RECHAZADA: "bg-rose-50 text-rose-700 ring-rose-200",
  CANCELADA: "bg-slate-50 text-slate-400 ring-slate-200 line-through",
  HISTORICA: "bg-white text-slate-500 ring-slate-200",
};

export const esEstado = (valor: string | null): valor is EstadoCotizacion =>
  ESTADOS.includes(valor as EstadoCotizacion);
