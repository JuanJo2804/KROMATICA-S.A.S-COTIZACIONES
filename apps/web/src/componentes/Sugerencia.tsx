"use client";

import { useState, type ReactNode } from "react";
import { api, NOMBRE_CORTE, type Confianza, type ConsultaTroquelada, type Similar, type SimilarTroquelada } from "@/lib/api";
import { formatoNumero } from "@/lib/formato";
import { Boton } from "./campos";

const textoConfianza: Record<Confianza, string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja: revísalo con la operaria",
};

const colorConfianza: Record<Confianza, string> = {
  alta: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  media: "bg-amber-50 text-amber-700 ring-amber-200",
  baja: "bg-rose-50 text-rose-700 ring-rose-200",
};

interface Resultado<S> {
  valor: number | null;
  rango: [number, number] | null;
  confianza: Confianza;
  similares: S[];
}

interface Columna<S> {
  titulo: string;
  celda: (s: S) => ReactNode;
  derecha?: boolean;
}

const tamano = (s: { anchoCm: number | null; altoCm: number | null }) =>
  s.anchoCm && s.altoCm ? `${formatoNumero(s.anchoCm)}×${formatoNumero(s.altoCm)}` : "—";

const clienteYReferencia = (s: { cliente: string | null; referencia: string | null }) => (
  <>
    {s.cliente ?? "—"}
    {s.referencia && <span className="text-slate-500"> · {s.referencia}</span>}
  </>
);

/**
 * Botón "Sugerir": busca las cotizaciones más parecidas y propone un valor. La persona decide si lo usa.
 * Lo usan la sugerencia de MO min y la de troqueladas por hora.
 */
function SugerenciaVecinos<S extends { id: number }>({
  etiqueta,
  falta,
  pedir,
  unidad,
  columnas,
  alUsar,
  alObtener,
}: {
  etiqueta: string;
  /** Qué falta para poder sugerir, o null si ya se puede. */
  falta: string | null;
  pedir: () => Promise<Resultado<S>>;
  unidad: string;
  columnas: Columna<S>[];
  alUsar: (valor: number) => void;
  alObtener: (valor: number | null) => void;
}) {
  const [sugerencia, setSugerencia] = useState<Resultado<S> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verSimilares, setVerSimilares] = useState(false);

  const consultar = async () => {
    if (falta) return;
    setCargando(true);
    setError(null);
    try {
      const s = await pedir();
      setSugerencia(s);
      alObtener(s.valor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo obtener la sugerencia");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-2">
      <Boton onClick={consultar} disabled={Boolean(falta) || cargando} title={falta ?? undefined}>
        {cargando ? "Buscando…" : `✨ ${etiqueta}`}
      </Boton>
      {falta && <p className="text-xs text-slate-500">{falta}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {sugerencia && sugerencia.valor === null && (
        <p className="text-xs text-slate-500">No hay cotizaciones parecidas en el historial.</p>
      )}

      {sugerencia && sugerencia.valor !== null && (
        <div className="rounded-md border border-violet-200 bg-violet-50/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Sugerido:{" "}
              <strong className="tabular-nums">
                {formatoNumero(sugerencia.valor)} {unidad}
              </strong>
            </span>
            {sugerencia.rango && (
              <span className="text-xs text-slate-500 tabular-nums">
                (normalmente entre {formatoNumero(sugerencia.rango[0])} y {formatoNumero(sugerencia.rango[1])})
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${colorConfianza[sugerencia.confianza]}`}>
              {textoConfianza[sugerencia.confianza]}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Boton variante="primario" onClick={() => alUsar(sugerencia.valor!)}>
              Usar {formatoNumero(sugerencia.valor)} {unidad}
            </Boton>
            <Boton variante="fantasma" onClick={() => setVerSimilares((v) => !v)}>
              {verSimilares ? "Ocultar" : "Ver"} las {sugerencia.similares.length} más parecidas
            </Boton>
          </div>
          {verSimilares && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-slate-500">
                  <tr>
                    {columnas.map((c) => (
                      <th key={c.titulo} className={`py-1 pr-2 font-medium ${c.derecha ? "text-right" : ""}`}>
                        {c.titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {sugerencia.similares.map((s) => (
                    <tr key={s.id} className="border-t border-violet-100">
                      {columnas.map((c) => (
                        <td key={c.titulo} className={`py-1 pr-2 ${c.derecha ? "text-right" : ""}`}>
                          {c.celda(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Sugerencia de MO min (GET /api/sugerencias/tiempo). */
export function SugerenciaTiempo({
  consulta,
  alUsar,
  alObtener,
}: {
  /** null si faltan datos (tintas y montaje son obligatorios para sugerir). */
  consulta: Parameters<typeof api.sugerirTiempo>[0] | null;
  alUsar: (moMin: number) => void;
  alObtener: (moMin: number | null) => void;
}) {
  return (
    <SugerenciaVecinos<Similar>
      etiqueta="Sugerir tiempo"
      falta={consulta ? null : "Indica tintas y montaje para poder sugerir."}
      pedir={async () => {
        const s = await api.sugerirTiempo(consulta!);
        return { ...s, valor: s.moMin };
      }}
      unidad="min"
      alUsar={alUsar}
      alObtener={alObtener}
      columnas={[
        { titulo: "Cliente / referencia", celda: clienteYReferencia },
        { titulo: "Tipo", celda: (s) => s.tipoProducto ?? "—" },
        { titulo: "Tintas", celda: (s) => s.tintas ?? "—", derecha: true },
        { titulo: "Montaje", celda: (s) => s.montaje, derecha: true },
        { titulo: "Tamaño", celda: tamano, derecha: true },
        { titulo: "MO min", celda: (s) => <strong>{formatoNumero(s.moMin)}</strong>, derecha: true },
      ]}
    />
  );
}

/** Sugerencia de unidades troqueladas por hora (GET /api/sugerencias/troquelada). */
export function SugerenciaTroquelada({
  consulta,
  alUsar,
  alObtener,
}: {
  /** null si faltan datos (tipo de producto o medidas). */
  consulta: ConsultaTroquelada | null;
  alUsar: (porHora: number) => void;
  alObtener: (porHora: number | null) => void;
}) {
  return (
    <SugerenciaVecinos<SimilarTroquelada>
      etiqueta="Sugerir troqueladas por hora"
      falta={consulta ? null : "Indica el tipo de producto o las medidas para poder sugerir."}
      pedir={async () => {
        const s = await api.sugerirTroquelada(consulta!);
        return { ...s, valor: s.troqueladasPorHora };
      }}
      unidad="por hora"
      alUsar={alUsar}
      alObtener={alObtener}
      columnas={[
        { titulo: "Cliente / referencia", celda: clienteYReferencia },
        { titulo: "Tipo", celda: (s) => s.tipoProducto ?? "—" },
        { titulo: "Corte", celda: (s) => (s.tipoCorte ? NOMBRE_CORTE[s.tipoCorte] : "—") },
        { titulo: "Tamaño", celda: tamano, derecha: true },
        { titulo: "Por hora", celda: (s) => <strong>{formatoNumero(s.troqueladasPorHora)}</strong>, derecha: true },
      ]}
    />
  );
}
