"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api, NOMBRE_CORTE, type CotizacionDetalle } from "@/lib/api";
import { COLOR_ESTADO, NOMBRE_ESTADO, type EstadoCotizacion } from "@/lib/estados";
import {
  formatoFecha,
  formatoNumero,
  formatoPesos,
  formatoPesosExacto,
  formatoPorcentaje,
  leerNumero,
} from "@/lib/formato";
import { Boton, Campo, claseEntrada, EntradaNumero, Seccion } from "@/componentes/campos";
import { DocumentoCliente } from "@/componentes/DocumentoCliente";
import { EliminarCotizacion } from "@/componentes/EliminarCotizacion";
import { useSesion } from "@/lib/sesion";
import { useRouter } from "next/navigation";

/** Texto del botón que lleva a cada estado. */
const ACCION_ESTADO: Record<EstadoCotizacion, string> = {
  BORRADOR: "Volver a borrador",
  ENVIADA: "Marcar como enviada",
  APROBADA: "Aprobada por el cliente",
  RECHAZADA: "Rechazada por el cliente",
  EN_PRUEBAS: "Pasar a pruebas (clisé y muestras)",
  EN_PRODUCCION: "Pasar a producción",
  TERMINADA: "Producción terminada",
  CANCELADA: "Cancelar",
  HISTORICA: "Histórica",
};

const NOMBRE_SECCION: Record<string, string> = {
  TROQUEL: "1. Troqueles",
  CLISE: "2. Clisé",
  TROQUELADA: "5. Troquelada",
  MATERIAL: "6. Material",
  ARMADA: "7. Armada",
  EMPAQUE: "8. Empaque",
  OTROS: "9. Otros materiales",
  ADICIONAL: "Adicionales",
};

const NOMBRE_FUENTE = {
  OPERARIA: "dato de la operaria",
  SUGERENCIA_ACEPTADA: "sugerencia aceptada",
  SUGERENCIA_CORREGIDA: "sugerencia corregida",
} as const;

const NOMBRE_BASE = { PRIMERA_FILA: "sobre la primera cantidad", PROPIA_FILA: "sobre cada cantidad" } as const;

const mensajeError = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto);

/**
 * Detalle de una cotización guardada: precios por cantidad (en borrador se elige o se quita el precio a enviar),
 * cambio de estado, tiempo real de producción, datos del producto, costos y valores con que se calculó.
 */
export function DetalleCotizacion({ id }: { id: number }) {
  const { esAdmin } = useSesion();
  const router = useRouter();
  const [c, setC] = useState<CotizacionDetalle | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api
      .obtenerCotizacion(id)
      .then(setC)
      .catch((e: unknown) => setErrorCarga(mensajeError(e, "No se pudo cargar la cotización")));
  }, [id]);

  /** Ejecuta una acción contra la API y muestra la cotización que devuelve. */
  const ejecutar = async (accion: () => Promise<CotizacionDetalle>) => {
    setOcupado(true);
    setError(null);
    try {
      setC(await accion());
      return true;
    } catch (e) {
      setError(mensajeError(e, "No se pudo guardar el cambio"));
      return false;
    } finally {
      setOcupado(false);
    }
  };

  if (errorCarga) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        <p>{errorCarga}</p>
        <Link href="/cotizaciones" className="text-violet-700 hover:underline">
          ← Volver al historial
        </Link>
      </div>
    );
  }
  if (!c) return <p className="text-sm text-slate-500">Cargando cotización…</p>;

  const editable = c.estado === "BORRADOR";
  const aceptaTiempoReal = c.estado === "EN_PRODUCCION" || c.estado === "TERMINADA";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Encabezado c={c} />
        {editable && (
          <Link
            href={`/cotizaciones/${c.id}/editar`}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            Editar borrador
          </Link>
        )}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Seccion
            titulo="Precios"
            ayuda={
              editable
                ? "Haz clic en el precio que vas a enviar para cada cantidad; otro clic lo quita. Se guarda al instante."
                : "Precio por unidad sin IVA. El precio elegido está resaltado."
            }
          >
            <Precios
              c={c}
              editable={editable}
              ocupado={ocupado}
              alElegir={(cantidadOrden, margenOrden) =>
                ejecutar(() => api.elegirMargenes(c.id, [{ cantidadOrden, margenOrden }]))
              }
            />
          </Seccion>

          <Seccion
            titulo="PDF para el cliente"
            ayuda="Imagen del producto, texto y los precios elegidos. Se puede cambiar en cualquier estado."
          >
            <DocumentoCliente c={c} ocupado={ocupado} ejecutar={ejecutar} />
          </Seccion>

          <Seccion titulo="Producto">
            <Producto c={c} />
          </Seccion>

          <Seccion titulo="Costos por unidad" ayuda="Los costos fijos (troquel, clisé…) se reparten entre las unidades de cada cantidad.">
            <Conceptos c={c} />
          </Seccion>
        </div>

        <div className="space-y-4">
          <Seccion titulo="Estado">
            <CambioEstado
              c={c}
              ocupado={ocupado}
              alCambiar={(estado, nota) => ejecutar(() => api.cambiarEstado(c.id, estado, nota))}
            />
          </Seccion>

          {(aceptaTiempoReal || c.moMinReal != null) && (
            <Seccion
              titulo="Tiempo real de producción"
              ayuda="Lo que realmente tomó. Sirve para mejorar la sugerencia del MO min."
            >
              <TiempoReal
                c={c}
                editable={aceptaTiempoReal}
                ocupado={ocupado}
                alGuardar={(datos) => ejecutar(() => api.registrarTiempoReal(c.id, datos))}
              />
            </Seccion>
          )}

          <Seccion titulo="Valores usados" ayuda="Copia de los valores vigentes cuando se calculó. No cambian si sube un precio.">
            <ValoresUsados c={c} />
          </Seccion>

          <Seccion titulo="Historial de estados">
            <HistorialEstados c={c} />
          </Seccion>

          {esAdmin && (
            <Seccion titulo="Eliminar" ayuda="Solo administradores. Pide confirmar dos veces y no se puede deshacer.">
              <EliminarCotizacion
                id={c.id}
                consecutivo={c.consecutivo}
                alEliminar={() => router.replace("/cotizaciones")}
              />
            </Seccion>
          )}
        </div>
      </div>
    </div>
  );
}

function Etiqueta({ estado }: { estado: EstadoCotizacion }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${COLOR_ESTADO[estado]}`}>
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

function Encabezado({ c }: { c: CotizacionDetalle }) {
  return (
    <div>
      <Link href="/cotizaciones" className="text-sm text-violet-700 hover:underline">
        ← Historial
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Cotización n.º {c.consecutivo}</h1>
        <Etiqueta estado={c.estado} />
      </div>
      <p className="mt-0.5 text-sm text-slate-500">
        {c.cliente?.nombre ?? "Sin cliente"}
        {" · "}
        {c.tipoProducto?.nombre ?? "Sin tipo de producto"}
        {c.referencia && ` · ${c.referencia}`}
        {" · "}
        {c.fecha ? formatoFecha(c.fecha) : "sin fecha"}
        {c.creadaPor && ` · creada por ${c.creadaPor.nombre}`}
        {c.origen === "EXCEL" && ` · importada del Excel${c.hojaExcel ? ` (hoja ${c.hojaExcel})` : ""}`}
      </p>
      {c.descripcion && <p className="mt-1 text-sm">{c.descripcion}</p>}
    </div>
  );
}

function Precios({
  c,
  editable,
  ocupado,
  alElegir,
}: {
  c: CotizacionDetalle;
  editable: boolean;
  ocupado: boolean;
  alElegir: (cantidadOrden: number, margenOrden: number | null) => void;
}) {
  if (c.cantidades.length === 0) return <p className="text-sm text-slate-500">Esta cotización no tiene cantidades.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-2 pr-3 font-medium">Cantidad</th>
            <th className="px-3 text-right font-medium">Costo / ud</th>
            <th className="px-3 text-right font-medium">Días</th>
            {c.margenes.map((m, i) => (
              <th key={i} className="px-1 text-right font-medium">
                {formatoPorcentaje(m.valor)}
                {m.sobre !== "COSTO" && (
                  <span className="block text-[10px] font-normal">sobre {formatoPorcentaje(c.margenes[m.sobre]!.valor)}</span>
                )}
              </th>
            ))}
            <th className="pl-3 text-right font-medium">Precio enviado</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {c.cantidades.map((q) => (
            <tr key={q.orden} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 font-medium">{formatoNumero(q.cantidad)}</td>
              <td
                className="px-3 text-right"
                title={`Subtotal ${formatoPesosExacto(q.subtotal)} + admón. ${formatoPesosExacto(q.administracion)} + CIF ${formatoPesosExacto(q.cif)} (${formatoPorcentaje(q.cifPorcentaje)})`}
              >
                {formatoPesosExacto(q.costoTotal)}
              </td>
              <td className="px-3 text-right text-slate-600">{formatoNumero(q.diasRequeridos)}</td>
              {q.opciones.map((p, j) => {
                const elegido = q.margenElegidoOrden === j;
                const contenido = (
                  <>
                    <span className="block font-semibold">{formatoPesos(p.precioRedondeado)}</span>
                    <span className={`block whitespace-nowrap text-[11px] ${elegido ? "text-violet-100" : "text-slate-500"}`}>
                      gana {formatoPesos(p.gananciaTotal)}
                    </span>
                  </>
                );
                const clase = `w-full rounded-md px-2 py-1 text-right ${elegido ? "bg-violet-600 text-white shadow-sm" : ""}`;
                return (
                  <td key={j} className="px-1 py-1 text-right">
                    {editable ? (
                      <button
                        type="button"
                        aria-pressed={elegido}
                        disabled={ocupado}
                        onClick={() => alElegir(q.orden, elegido ? null : j)}
                        className={`${clase} transition-colors ${elegido ? "" : "hover:bg-violet-50"} disabled:cursor-wait`}
                        title={elegido ? "Clic para quitarlo" : "Elegir este precio"}
                      >
                        {contenido}
                      </button>
                    ) : (
                      <div className={clase}>{contenido}</div>
                    )}
                  </td>
                );
              })}
              <td className="pl-3 text-right font-semibold">
                {q.precioUnitario != null ? formatoPesos(q.precioUnitario) : <span className="font-normal text-slate-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.margenes.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">Sin opciones de margen guardadas (cotización importada del Excel).</p>
      )}
    </div>
  );
}

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{nombre}</dt>
      <dd className="text-sm font-medium tabular-nums">{children ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function Producto({ c }: { c: CotizacionDetalle }) {
  const medidas = c.anchoCm && c.altoCm ? `${formatoNumero(c.anchoCm)} × ${formatoNumero(c.altoCm)} cm` : null;
  const clise = c.entrada?.producto?.clise;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      <Dato nombre="Tipo de corte">{c.tipoCorte ? NOMBRE_CORTE[c.tipoCorte] : null}</Dato>
      <Dato nombre="Medidas">{medidas}</Dato>
      <Dato nombre="Tintas">{c.tintas}</Dato>
      <Dato nombre="Montaje">{`${c.montaje} uds / plancha`}</Dato>
      <Dato nombre="Espesor">{c.espesor}</Dato>
      <Dato nombre="Gramos por clisé">
        {`${formatoNumero(c.parametros.gramosPorClise)} g`}
        {c.gramosPorCm2 != null && (
          <span className="block text-xs font-normal text-slate-500">{formatoNumero(Math.round(c.gramosPorCm2 * 1000) / 1000)} g/cm²</span>
        )}
      </Dato>
      <Dato nombre="Clisé">
        {clise ? (
          <>
            {formatoNumero(clise.cm2)} cm² × {clise.cantidadClises}
            {clise.horizontal && clise.vertical && (
              <span className="block text-xs font-normal text-slate-500">
                {clise.horizontal} × {clise.vertical} unidades
              </span>
            )}
          </>
        ) : null}
      </Dato>
      <Dato nombre="MO min">
        {`${formatoNumero(c.moMin)} min / plancha`}
        <span className="block text-xs font-normal text-slate-500">
          {NOMBRE_FUENTE[c.moMinFuente]}
          {c.moMinSugerido != null && ` · sugerido ${formatoNumero(c.moMinSugerido)}`}
        </span>
      </Dato>
      <Dato nombre="Troqueladas por hora">
        {c.troqueladasPorHora != null ? formatoNumero(Math.round(c.troqueladasPorHora)) : null}
        {c.troqueladasPorHoraSugerida != null && (
          <span className="block text-xs font-normal text-slate-500">
            sugerido {formatoNumero(Math.round(c.troqueladasPorHoraSugerida))}
          </span>
        )}
      </Dato>
      {c.observaciones && (
        <div className="col-span-full">
          <dt className="text-xs text-slate-500">Observaciones</dt>
          <dd className="whitespace-pre-line text-sm">{c.observaciones}</dd>
        </div>
      )}
    </dl>
  );
}

function Conceptos({ c }: { c: CotizacionDetalle }) {
  if (c.conceptos.length === 0) return <p className="text-sm text-slate-500">Sin conceptos guardados.</p>;
  const porUnidad = c.conceptos.reduce((t, k) => t + k.porUnidad, 0);
  const fijo = c.conceptos.reduce((t, k) => t + k.fijo, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-2 pr-3 font-medium">Concepto</th>
            <th className="px-3 font-medium">Sección</th>
            <th className="px-3 text-right font-medium">Por unidad</th>
            <th className="pl-3 text-right font-medium">Fijo</th>
          </tr>
        </thead>
        <tbody>
          {c.conceptos.map((k, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-1.5 pr-3">{k.nombre}</td>
              <td className="px-3 text-xs text-slate-500">{NOMBRE_SECCION[k.seccion] ?? k.seccion}</td>
              <td className="px-3 text-right">{k.porUnidad ? formatoPesosExacto(k.porUnidad) : "—"}</td>
              <td className="pl-3 text-right">{k.fijo ? formatoPesos(k.fijo) : "—"}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2 pr-3">Total</td>
            <td />
            <td className="px-3 text-right">{formatoPesosExacto(porUnidad)}</td>
            <td className="pl-3 text-right">{fijo ? formatoPesos(fijo) : "—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ValoresUsados({ c }: { c: CotizacionDetalle }) {
  const p = c.parametros;
  const cif = c.cantidades.map((q) => formatoPorcentaje(q.cifPorcentaje)).join(" / ");
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Dato nombre="Valor del minuto">{formatoPesos(p.valorMinuto)}</Dato>
      <Dato nombre="Precio por gramo">{formatoPesos(p.precioGramo)}</Dato>
      <Dato nombre="Horas por día">{`${formatoNumero(p.horasPorDia)} h`}</Dato>
      <Dato nombre="Redondeo">{`a ${formatoNumero(p.redondeo)}`}</Dato>
      <Dato nombre="CIF">
        {cif || null}
        <span className="block text-xs font-normal text-slate-500">{NOMBRE_BASE[p.cifBase]}</span>
      </Dato>
      <Dato nombre="Administración">
        {formatoPorcentaje(p.administracionPorcentaje)}
        <span className="block text-xs font-normal text-slate-500">{NOMBRE_BASE[p.administracionBase]}</span>
      </Dato>
    </dl>
  );
}

function CambioEstado({
  c,
  ocupado,
  alCambiar,
}: {
  c: CotizacionDetalle;
  ocupado: boolean;
  alCambiar: (estado: EstadoCotizacion, nota: string) => Promise<boolean>;
}) {
  const [nota, setNota] = useState("");
  const faltanPrecios = c.cantidades.some((q) => q.precioUnitario == null);

  if (c.transicionesPermitidas.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {c.estado === "HISTORICA"
          ? "Cotización importada del Excel: solo de consulta."
          : `La cotización está ${NOMBRE_ESTADO[c.estado].toLowerCase()}; no tiene más cambios de estado.`}
      </p>
    );
  }

  const cambiar = async (estado: EstadoCotizacion) => {
    if (estado === "CANCELADA" && !window.confirm("¿Cancelar la cotización? No se puede deshacer.")) return;
    if (await alCambiar(estado, nota.trim())) setNota("");
  };

  return (
    <div className="space-y-3">
      <Campo etiqueta="Nota (opcional)">
        <input
          className={claseEntrada}
          value={nota}
          placeholder="Ej.: enviada por WhatsApp"
          onChange={(e) => setNota(e.target.value)}
        />
      </Campo>
      <div className="flex flex-col gap-2">
        {c.transicionesPermitidas.map((estado) => {
          const bloqueado = estado === "ENVIADA" && faltanPrecios;
          const peligro = estado === "CANCELADA" || estado === "RECHAZADA";
          return (
            <Boton
              key={estado}
              variante={peligro || estado === "BORRADOR" ? "secundario" : "primario"}
              disabled={ocupado || bloqueado}
              onClick={() => cambiar(estado)}
              className={peligro ? "text-rose-700 hover:bg-rose-50" : ""}
              title={bloqueado ? "Primero elige el precio de cada cantidad" : undefined}
            >
              {ACCION_ESTADO[estado]}
            </Boton>
          );
        })}
      </div>
      {c.transicionesPermitidas.includes("ENVIADA") && faltanPrecios && (
        <p className="text-xs text-slate-500">Para marcarla como enviada, elige el precio de cada cantidad.</p>
      )}
    </div>
  );
}

function TiempoReal({
  c,
  editable,
  ocupado,
  alGuardar,
}: {
  c: CotizacionDetalle;
  editable: boolean;
  ocupado: boolean;
  alGuardar: (datos: { moMinReal: number }) => Promise<boolean>;
}) {
  const [moMin, setMoMin] = useState(c.moMinReal != null ? String(c.moMinReal) : "");
  const moMinReal = leerNumero(moMin);
  const valido = moMinReal !== undefined && moMinReal > 0;
  const sinCambios = moMinReal === (c.moMinReal ?? undefined);
  const diferencia = c.moMinReal != null ? (c.moMinReal - c.moMin) / c.moMin : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="MO min real" ayuda={`Estimado: ${formatoNumero(c.moMin)} min`}>
          {editable ? (
            <EntradaNumero valor={moMin} alCambiar={setMoMin} sufijo="min" />
          ) : (
            <p className="text-sm font-medium">{c.moMinReal != null ? `${formatoNumero(c.moMinReal)} min` : "—"}</p>
          )}
        </Campo>
      </div>
      {diferencia !== null && (
        <p className="text-xs text-slate-600">
          El tiempo real fue {formatoPorcentaje(Math.abs(diferencia))} {diferencia >= 0 ? "mayor" : "menor"} que el estimado.
        </p>
      )}
      {editable && (
        <Boton
          variante="primario"
          className="w-full"
          disabled={ocupado || !valido || sinCambios}
          onClick={() => valido && alGuardar({ moMinReal })}
        >
          Guardar tiempo real
        </Boton>
      )}
    </div>
  );
}

const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

function HistorialEstados({ c }: { c: CotizacionDetalle }) {
  const creada = c.origen === "EXCEL" ? "Importada del Excel" : "Creada como borrador";
  return (
    <ol className="space-y-3 border-l border-slate-200 pl-4 text-sm">
      {/* La API registra la creación como un cambio sin estado anterior; si no está, se muestra con creadaEn. */}
      {!c.historial.some((h) => h.desde === null) && (
        <li className="relative">
          <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-slate-300" />
          <p className="font-medium">{creada}</p>
          <p className="text-xs text-slate-500">{fechaHora.format(new Date(c.creadaEn))}</p>
        </li>
      )}
      {c.historial.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-violet-500" />
          <p className="font-medium">{h.desde ? `${NOMBRE_ESTADO[h.desde]} → ${NOMBRE_ESTADO[h.hacia]}` : creada}</p>
          <p className="text-xs text-slate-500">
            {fechaHora.format(new Date(h.fecha))}
            {h.usuario && ` · ${h.usuario}`}
          </p>
          {h.nota && <p className="mt-0.5 text-xs text-slate-700">{h.nota}</p>}
        </li>
      ))}
    </ol>
  );
}
