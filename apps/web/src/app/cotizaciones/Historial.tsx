"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type CotizacionResumen, type Pagina, type TipoProducto } from "@/lib/api";
import { COLOR_ESTADO, ESTADOS, esEstado, NOMBRE_ESTADO, type EstadoCotizacion } from "@/lib/estados";
import { formatoFecha, formatoNumero, formatoPesos } from "@/lib/formato";
import { Boton, claseEntrada } from "@/componentes/campos";

const POR_PAGINA = 20;

/**
 * Historial de cotizaciones con filtros por estado, tipo de producto y texto (cliente, referencia,
 * descripción). Los filtros viven en la URL para poder compartir o recargar la búsqueda.
 */
export function Historial() {
  const ruta = usePathname();
  const params = useSearchParams();

  const estadoUrl = params.get("estado");
  const estado = esEstado(estadoUrl) ? estadoUrl : undefined;
  const tipoProducto = params.get("tipo") ?? undefined;
  const buscar = params.get("buscar") ?? "";
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);

  const [tipos, setTipos] = useState<TipoProducto[]>([]);
  const [texto, setTexto] = useState(buscar);
  const [resultado, setResultado] = useState<Pagina<CotizacionResumen> | null>(null);
  /** Última consulta respondida (con éxito o con error): si no es la actual, se está cargando. */
  const [respondida, setRespondida] = useState<{ consulta: string; error: string | null } | null>(null);

  /** Cambia uno o varios filtros en la URL; cualquier filtro nuevo vuelve a la página 1. */
  const filtrar = (cambios: Record<string, string | undefined>) => {
    // history.replaceState cambia la URL al instante (Next.js sincroniza useSearchParams), así dos filtros
    // seguidos no se pisan, como pasaba con router.replace. Se parte de la URL real por la misma razón.
    const nuevos = new URLSearchParams(window.location.search);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    if (!("pagina" in cambios)) nuevos.delete("pagina");
    const consulta = nuevos.toString();
    window.history.replaceState(null, "", consulta ? `${ruta}?${consulta}` : ruta);
  };

  useEffect(() => {
    api.tiposProducto().then(setTipos).catch(() => setTipos([]));
  }, []);

  // La búsqueda por texto espera a que la persona deje de escribir.
  useEffect(() => {
    if (texto.trim() === buscar) return;
    const espera = setTimeout(() => filtrar({ buscar: texto.trim() || undefined }), 350);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar al texto escrito
  }, [texto]);

  const consulta = params.toString();
  useEffect(() => {
    const control = new AbortController();
    api
      .listarCotizaciones({ estado, tipoProducto, buscar: buscar || undefined, pagina, porPagina: POR_PAGINA }, control.signal)
      .then((datos) => {
        setResultado(datos);
        setRespondida({ consulta, error: null });
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setRespondida({ consulta, error: e instanceof Error ? e.message : "No se pudo cargar el historial" });
      });
    return () => control.abort();
  }, [consulta, estado, tipoProducto, buscar, pagina]);
  const cargando = respondida?.consulta !== consulta;
  const error = cargando ? null : respondida.error;

  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.porPagina)) : 1;
  const hayFiltros = Boolean(estado || tipoProducto || buscar);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Historial de cotizaciones</h1>
          <p className="text-sm text-slate-500">
            {resultado
              ? `${formatoNumero(resultado.total)} cotizaciones${hayFiltros ? " con estos filtros" : ""}`
              : "Cargando…"}
          </p>
        </div>
        <Link
          href="/cotizaciones/nueva"
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
        >
          + Nueva cotización
        </Link>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            className={`${claseEntrada} min-w-0 flex-1 basis-64`}
            placeholder="Buscar por cliente, referencia o descripción…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar"
          />
          <div className="w-48">
            <select
              className={claseEntrada}
              value={tipoProducto ?? ""}
              onChange={(e) => filtrar({ tipo: e.target.value || undefined })}
              aria-label="Tipo de producto"
            >
              <option value="">Todos los productos</option>
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          {hayFiltros && (
            <Boton
              variante="fantasma"
              onClick={() => {
                setTexto("");
                window.history.replaceState(null, "", ruta);
              }}
            >
              Quitar filtros
            </Boton>
          )}
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por estado">
          <FiltroEstado activo={!estado} onClick={() => filtrar({ estado: undefined })}>
            Todos
          </FiltroEstado>
          {ESTADOS.map((e) => (
            <FiltroEstado key={e} activo={estado === e} onClick={() => filtrar({ estado: e })}>
              {NOMBRE_ESTADO[e]}
            </FiltroEstado>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}. ¿Está corriendo la API? <code className="rounded bg-rose-100 px-1">pnpm dev:api</code>
        </div>
      )}

      <div className={`overflow-x-auto rounded-lg border border-slate-200 bg-white transition-opacity ${cargando ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-medium">N.º</th>
              <th className="px-3 font-medium">Fecha</th>
              <th className="px-3 font-medium">Cliente</th>
              <th className="px-3 font-medium">Producto</th>
              <th className="px-3 text-right font-medium" title="Tintas · montaje · minutos por plancha">
                Tintas · Mont. · MO
              </th>
              <th className="px-3 text-right font-medium">Cantidades y precio / ud</th>
              <th className="px-4 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {resultado?.items.map((c) => <Fila key={c.id} c={c} />)}
          </tbody>
        </table>
        {resultado && resultado.items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No hay cotizaciones {hayFiltros ? "con estos filtros" : "todavía"}.
          </p>
        )}
      </div>

      {resultado && resultado.total > resultado.porPagina && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span className="tabular-nums">
            {formatoNumero((pagina - 1) * resultado.porPagina + 1)}–
            {formatoNumero(Math.min(pagina * resultado.porPagina, resultado.total))} de {formatoNumero(resultado.total)}
          </span>
          <div className="flex items-center gap-2">
            <Boton disabled={pagina <= 1} onClick={() => filtrar({ pagina: pagina > 2 ? String(pagina - 1) : undefined })}>
              ← Anterior
            </Boton>
            <span className="tabular-nums text-xs text-slate-500">
              Página {pagina} de {totalPaginas}
            </span>
            <Boton disabled={pagina >= totalPaginas} onClick={() => filtrar({ pagina: String(pagina + 1) })}>
              Siguiente →
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

function FiltroEstado({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        activo ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function EtiquetaEstado({ estado }: { estado: EstadoCotizacion }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${COLOR_ESTADO[estado]}`}>
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

function Fila({ c }: { c: CotizacionResumen }) {
  const router = useRouter();
  return (
    // Toda la fila abre el detalle; el enlace del número es para teclado y para abrir en otra pestaña.
    <tr
      className="cursor-pointer border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/70"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a")) router.push(`/cotizaciones/${c.id}`);
      }}
    >
      <td className="px-4 py-3 font-medium tabular-nums">
        <Link href={`/cotizaciones/${c.id}`} className="text-violet-700 hover:underline">
          {c.consecutivo}
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
        {c.fecha ? formatoFecha(c.fecha) : <span className="text-slate-400">Sin fecha</span>}
        {c.origen === "EXCEL" && <span className="block text-xs text-slate-400">Excel</span>}
      </td>
      <td className="px-3 py-3">{c.cliente ?? <span className="text-slate-400">—</span>}</td>
      <td className="max-w-64 px-3 py-3">
        <span className="font-medium">{c.tipoProducto ?? <span className="text-slate-400">Sin tipo</span>}</span>
        {c.referencia && <span className="text-slate-500"> · {c.referencia}</span>}
        {c.descripcion && <p className="truncate text-xs text-slate-500" title={c.descripcion}>{c.descripcion}</p>}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
        {c.tintas ?? "—"} · {c.montaje} · {formatoNumero(c.moMin)}′
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {c.cantidades.length === 0 && <span className="text-slate-400">Sin cantidades</span>}
        <ul className="space-y-0.5">
          {c.cantidades.map((q) => (
            <li key={q.cantidad} className="whitespace-nowrap">
              <span className="text-slate-500">{formatoNumero(q.cantidad)} →</span>{" "}
              {q.precioUnitario !== null ? (
                <span className="font-medium">{formatoPesos(q.precioUnitario)}</span>
              ) : (
                <span className="text-slate-400" title="Sin precio elegido: se muestra el costo por unidad">
                  costo {formatoPesos(q.costoTotal)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-4 py-3">
        <EtiquetaEstado estado={c.estado} />
      </td>
    </tr>
  );
}
