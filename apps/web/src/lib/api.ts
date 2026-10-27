/**
 * Cliente de la API de cotizaciones (apps/api).
 * Las rutas son relativas: next.config.ts reenvía /api/* al servidor de NestJS.
 */
import type { EstadoCotizacion } from "./estados";

export type BaseCalculo = "PRIMERA_FILA" | "PROPIA_FILA";
export type Rol = "ADMIN" | "OPERARIO";

export const NOMBRE_ROL: Record<Rol, string> = { ADMIN: "Administrador", OPERARIO: "Operario" };

/** Persona con la sesión iniciada (GET /api/auth/yo). */
export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
}

export interface Usuario extends UsuarioSesion {
  activo: boolean;
  creadoEn: string;
}
export type FuenteTiempo = "OPERARIA" | "SUGERENCIA_ACEPTADA" | "SUGERENCIA_CORREGIDA";
export type TipoCorte = "BISTURI" | "TROQUELADO";

export const NOMBRE_CORTE: Record<TipoCorte, string> = { BISTURI: "Corte bisturí", TROQUELADO: "Troquelado" };

export interface Parametro {
  valor: number;
  vigenteDesde: string;
  nota: string | null;
}

export type Parametros = Record<"VALOR_MINUTO" | "HORAS_POR_DIA" | "PRECIO_CM2_CLISE" | "PRECIO_GRAMO", Parametro>;

export interface TipoProducto {
  id: number;
  codigo: string;
  nombre: string;
}

export type SeccionConcepto = "TROQUEL" | "CLISE" | "MATERIAL" | "ARMADA" | "EMPAQUE" | "OTROS" | "ADICIONAL";

export interface ConceptoCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  seccion: SeccionConcepto;
  tipoCosto: "POR_UNIDAD" | "FIJO";
  valorSugerido: number | null;
}

/** Fila de la "TABLA DE GRAMOS POR CM²": una muestra de `cm2` cm² pesa `gramos`. */
export interface Espesor {
  id: number;
  nombre: string;
  gramos: number | null;
  cm2: number | null;
  gramosPorCm2: number;
}

export interface PoliticaPrecios {
  id: number;
  nombre: string;
  cifPorcentajes: number[];
  cifBase: BaseCalculo;
  administracionPorcentaje: number;
  administracionBase: BaseCalculo;
  margenesSugeridos: number[];
  redondeo: number;
  predeterminada: boolean;
}

export interface Similar {
  id: number;
  tipoProducto: string | null;
  tintas: number | null;
  montaje: number;
  anchoCm: number | null;
  altoCm: number | null;
  moMin: number;
  cliente: string | null;
  referencia: string | null;
  distancia: number;
}

export type Confianza = "alta" | "media" | "baja";

export interface SugerenciaTiempo {
  moMin: number | null;
  rango: [number, number] | null;
  confianza: Confianza;
  similares: Similar[];
}

export interface SimilarTroquelada {
  id: number;
  tipoProducto: string | null;
  tipoCorte: TipoCorte | null;
  anchoCm: number | null;
  altoCm: number | null;
  montaje: number | null;
  troqueladasPorHora: number;
  cliente: string | null;
  referencia: string | null;
  distancia: number;
}

export interface SugerenciaTroquelada {
  troqueladasPorHora: number | null;
  rango: [number, number] | null;
  confianza: Confianza;
  similares: SimilarTroquelada[];
}

export interface ConsultaTroquelada {
  tipoProducto?: string;
  tipoCorte?: TipoCorte;
  anchoCm?: number;
  altoCm?: number;
  montaje?: number;
  espesor?: string;
  tintas?: number;
}

export interface Item {
  nombre: string;
  valor: number;
}

export interface ConceptoAdicional {
  codigo: string;
  nombre: string;
  porUnidad?: number;
  fijo?: number;
}

/** Cuerpo de POST /api/cotizaciones (GuardarCotizacionDto). */
export interface GuardarCotizacion {
  producto: {
    moMin: number;
    montaje: number;
    valorMinuto?: number;
    gramosPorClise: number;
    precioGramo?: number;
    troquel?: number;
    troqueles?: Item[];
    clise?: { cm2: number; cantidadClises: number; precioCm2?: number; espacioCm?: number; horizontal?: number; vertical?: number };
    troqueladaPorUnidad?: number;
    troqueladasPorHora?: number;
    materialesAdicionales?: Item[];
    armada?: Item[];
    empaque?: Item[];
    otros?: Item[];
    adicionales?: ConceptoAdicional[];
  };
  cantidades: number[];
  cif?: { porcentajes: number[]; base?: BaseCalculo };
  administracion?: { porcentajes: number[]; base?: BaseCalculo };
  margenes?: { valor: number; sobre?: number }[];
  horasPorDia?: number;
  politicaId?: number;
  clienteNombre?: string;
  tipoProducto: string;
  referencia?: string;
  descripcion?: string;
  tipoCorte?: TipoCorte;
  anchoCm?: number;
  altoCm?: number;
  tintas: number;
  espesor?: string;
  moMinFuente?: FuenteTiempo;
  moMinSugerido?: number;
  troqueladasPorHoraSugerida?: number;
  observaciones?: string;
}

export interface CotizacionGuardada {
  id: number;
  consecutivo: number;
  estado: string;
}

export type ClaveParametro = keyof Parametros;

export interface ParametroRegistrado extends Parametro {
  id: number;
  clave: ClaveParametro;
  creadoEn: string;
  /** Nombre de quien lo registró (null en los cargados por el seed). */
  creadoPor: string | null;
}

export interface OpcionPrecio {
  margen: number;
  precioUnitario: number;
  precioRedondeado: number;
  gananciaUnitaria: number;
  gananciaTotal: number;
}

/** GET /api/cotizaciones/:id */
export interface CotizacionDetalle {
  id: number;
  consecutivo: number;
  estado: EstadoCotizacion;
  transicionesPermitidas: EstadoCotizacion[];
  origen: "SISTEMA" | "EXCEL";
  hojaExcel: string | null;
  cliente: { id: number; nombre: string } | null;
  tipoProducto: TipoProducto | null;
  referencia: string | null;
  descripcion: string | null;
  tipoCorte: TipoCorte | null;
  anchoCm: number | null;
  altoCm: number | null;
  tintas: number | null;
  montaje: number;
  espesor: string | null;
  gramosPorCm2: number | null;
  troqueladasPorHora: number | null;
  troqueladasPorHoraSugerida: number | null;
  moMin: number;
  moMinFuente: FuenteTiempo;
  moMinSugerido: number | null;
  moMinReal: number | null;
  parametros: {
    valorMinuto: number;
    horasPorDia: number;
    gramosPorClise: number;
    precioGramo: number;
    cifBase: BaseCalculo;
    administracionPorcentaje: number;
    administracionBase: BaseCalculo;
    redondeo: number;
  };
  conceptos: { seccion: SeccionConcepto | "TROQUELADA"; codigo: string; nombre: string; porUnidad: number; fijo: number }[];
  margenes: { valor: number; sobre: number | "COSTO" }[];
  cantidades: {
    orden: number;
    cantidad: number;
    cifPorcentaje: number;
    subtotal: number;
    administracion: number;
    cif: number;
    costoTotal: number;
    diasRequeridos: number;
    opciones: OpcionPrecio[];
    margenElegidoOrden: number | null;
    precioUnitario: number | null;
  }[];
  entrada: (GuardarCotizacion & Record<string, unknown>) | null;
  observaciones: string | null;
  /** Imagen del producto para el PDF (los bytes se piden en /cotizaciones/:id/imagen). */
  imagen: { tipo: string; nombre: string | null; subidaEn: string } | null;
  /** Texto del PDF guardado por la persona; null = se usan las líneas por defecto. */
  textoCliente: string | null;
  /** Líneas que lleva el PDF. */
  lineasCliente: string[];
  historial: {
    id: number;
    desde: EstadoCotizacion | null;
    hacia: EstadoCotizacion;
    nota: string | null;
    fecha: string;
    usuario: string | null;
  }[];
  creadaPor: { id: number; nombre: string } | null;
  fecha: string | null;
  creadaEn: string;
  actualizadaEn: string;
}

/** Fila de GET /api/cotizaciones. */
export interface CotizacionResumen {
  id: number;
  consecutivo: number;
  estado: EstadoCotizacion;
  origen: "SISTEMA" | "EXCEL";
  cliente: string | null;
  tipoProducto: string | null;
  referencia: string | null;
  descripcion: string | null;
  tintas: number | null;
  montaje: number;
  moMin: number;
  cantidades: { cantidad: number; costoTotal: number; precioUnitario: number | null }[];
  /** Fecha de la cotización ("AAAA-MM-DD"). En las importadas es la más reciente de la hoja; null si no tenía. */
  fecha: string | null;
  creadaEn: string;
}

export interface Pagina<T> {
  total: number;
  pagina: number;
  porPagina: number;
  items: T[];
}

export interface FiltroCotizaciones {
  estado?: EstadoCotizacion;
  tipoProducto?: string;
  buscar?: string;
  pagina?: number;
  porPagina?: number;
}

export class ErrorApi extends Error {
  constructor(
    message: string,
    public readonly estado: number,
  ) {
    super(message);
  }
}

/** Arma el query string omitiendo los valores vacíos. */
function consultaUrl(valores: object): URLSearchParams {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(clave, String(valor));
  }
  return params;
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  // Con FormData el navegador pone el Content-Type (multipart con su separador).
  const esFormulario = opciones?.body instanceof FormData;
  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: { ...(esFormulario ? {} : { "Content-Type": "application/json" }), ...opciones?.headers },
  });
  // Sesión vencida o cerrada: a la pantalla de inicio de sesión, volviendo luego a donde estaba.
  if (respuesta.status === 401 && !ruta.startsWith("/auth/") && typeof window !== "undefined") {
    // Recarga completa a propósito: aquí no hay router y conviene descartar el estado de la sesión vencida.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?siguiente=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    const mensaje = Array.isArray(cuerpo?.message) ? cuerpo.message.join(" · ") : cuerpo?.message;
    throw new ErrorApi(mensaje ?? `Error ${respuesta.status} al llamar a ${ruta}`, respuesta.status);
  }
  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

export const api = {
  iniciarSesion: (usuario: string, clave: string) =>
    pedir<UsuarioSesion>("/auth/login", { method: "POST", body: JSON.stringify({ usuario, clave }) }),
  cerrarSesion: () => pedir<void>("/auth/salir", { method: "POST" }),
  yo: () => pedir<UsuarioSesion>("/auth/yo"),
  cambiarClave: (actual: string, nueva: string) =>
    pedir<void>("/auth/clave", { method: "PATCH", body: JSON.stringify({ actual, nueva }) }),

  usuarios: () => pedir<Usuario[]>("/usuarios"),
  crearUsuario: (datos: { usuario: string; nombre: string; clave: string; rol: Rol }) =>
    pedir<Usuario>("/usuarios", { method: "POST", body: JSON.stringify(datos) }),
  editarUsuario: (id: number, datos: { nombre?: string; rol?: Rol; activo?: boolean; clave?: string }) =>
    pedir<Usuario>(`/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(datos) }),

  parametros: () => pedir<Parametros>("/parametros"),
  tiposProducto: () => pedir<TipoProducto[]>("/catalogos/tipos-producto"),
  conceptos: () => pedir<ConceptoCatalogo[]>("/catalogos/conceptos"),
  espesores: () => pedir<Espesor[]>("/catalogos/espesores"),
  politicas: () => pedir<PoliticaPrecios[]>("/catalogos/politicas-precios"),

  sugerirTiempo: (consulta: { tipoProducto?: string; tintas: number; montaje: number; anchoCm?: number; altoCm?: number }) =>
    pedir<SugerenciaTiempo>(`/sugerencias/tiempo?${consultaUrl(consulta)}`),

  sugerirTroquelada: (consulta: ConsultaTroquelada) =>
    pedir<SugerenciaTroquelada>(`/sugerencias/troquelada?${consultaUrl(consulta)}`),

  listarCotizaciones: (filtro: FiltroCotizaciones, senal?: AbortSignal) =>
    pedir<Pagina<CotizacionResumen>>(`/cotizaciones?${consultaUrl(filtro)}`, { signal: senal }),

  crearCotizacion: (cuerpo: GuardarCotizacion) =>
    pedir<CotizacionGuardada>("/cotizaciones", { method: "POST", body: JSON.stringify(cuerpo) }),

  obtenerCotizacion: (id: number) => pedir<CotizacionDetalle>(`/cotizaciones/${id}`),

  /** Solo administradores. `confirmacion` es el número de la cotización (segunda confirmación). */
  eliminarCotizacion: (id: number, confirmacion: number) =>
    pedir<void>(`/cotizaciones/${id}?confirmar=${confirmacion}`, { method: "DELETE" }),

  /** Recalcula y reemplaza un borrador (quita los precios elegidos: hay que volver a enviarlos). */
  actualizarCotizacion: (id: number, cuerpo: GuardarCotizacion) =>
    pedir<CotizacionDetalle>(`/cotizaciones/${id}`, { method: "PUT", body: JSON.stringify(cuerpo) }),

  /** margenOrden = null quita el precio elegido de esa cantidad. */
  elegirMargenes: (id: number, elecciones: { cantidadOrden: number; margenOrden: number | null }[]) =>
    pedir<CotizacionDetalle>(`/cotizaciones/${id}/margenes`, {
      method: "PATCH",
      body: JSON.stringify({ elecciones }),
    }),

  cambiarEstado: (id: number, estado: EstadoCotizacion, nota?: string) =>
    pedir<CotizacionDetalle>(`/cotizaciones/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado, nota: nota || undefined }),
    }),

  registrarTiempoReal: (id: number, datos: { moMinReal: number }) =>
    pedir<CotizacionDetalle>(`/cotizaciones/${id}/tiempo-real`, { method: "PATCH", body: JSON.stringify(datos) }),

  subirImagen: (id: number, archivo: File) => {
    const datos = new FormData();
    datos.append("imagen", archivo);
    return pedir<CotizacionDetalle>(`/cotizaciones/${id}/imagen`, { method: "PUT", body: datos });
  },

  borrarImagen: (id: number) => pedir<CotizacionDetalle>(`/cotizaciones/${id}/imagen`, { method: "DELETE" }),

  /** texto = null vuelve a las líneas por defecto. */
  guardarTextoCliente: (id: number, texto: string | null) =>
    pedir<CotizacionDetalle>(`/cotizaciones/${id}/texto-cliente`, { method: "PATCH", body: JSON.stringify({ texto }) }),

  /** Rutas que el navegador abre directamente (img, enlace al PDF). */
  urlImagen: (id: number, version: string) => `/api/cotizaciones/${id}/imagen?v=${encodeURIComponent(version)}`,
  urlPdf: (id: number) => `/api/cotizaciones/${id}/pdf`,

  historialParametro: (clave: ClaveParametro) => pedir<ParametroRegistrado[]>(`/parametros/${clave}/historial`),

  registrarParametro: (datos: { clave: ClaveParametro; valor: number; vigenteDesde: string; nota?: string }) =>
    pedir<ParametroRegistrado>("/parametros", { method: "POST", body: JSON.stringify(datos) }),
};
