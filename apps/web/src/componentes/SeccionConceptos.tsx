"use client";

import type { ConceptoCatalogo } from "@/lib/api";
import { formatoPesos, formatoPesosExacto, leerNumero } from "@/lib/formato";
import { claseEntrada, EntradaNumero } from "./campos";

/** Renglón escrito a mano ("Otro"). */
export interface ItemLibre {
  nombre: string;
  valor: string;
  tipoCosto: "POR_UNIDAD" | "FIJO";
}

/** Renglón que se calcula solo (material rubber, mano de obra rubber, clisé). */
export interface FilaCalculada {
  nombre: string;
  valor: number | null;
  detalle: string;
  fijo?: boolean;
}

/**
 * Una sección de costos como en el Excel: todos los renglones del catálogo como campos (vacío = no se usa),
 * los calculados arriba y "+ Otro" para lo que no esté en la lista.
 */
export function SeccionConceptos({
  catalogo,
  valores,
  alCambiarValor,
  libres,
  alCambiarLibres,
  calculadas = [],
  tipoLibres = "POR_UNIDAD",
}: {
  catalogo: ConceptoCatalogo[];
  /** Código del catálogo → texto escrito. */
  valores: Record<string, string>;
  alCambiarValor: (codigo: string, valor: string) => void;
  libres: ItemLibre[];
  alCambiarLibres: (items: ItemLibre[]) => void;
  calculadas?: FilaCalculada[];
  /** Tipo de costo de los renglones libres: fijo (se reparte), por unidad, o que la persona elija. */
  tipoLibres?: "POR_UNIDAD" | "FIJO" | "ELEGIR";
}) {
  const actualizarLibre = (i: number, cambios: Partial<ItemLibre>) =>
    alCambiarLibres(libres.map((item, j) => (j === i ? { ...item, ...cambios } : item)));

  const porUnidad = [
    ...calculadas.filter((c) => !c.fijo).map((c) => c.valor ?? 0),
    ...catalogo.filter((c) => c.tipoCosto === "POR_UNIDAD").map((c) => leerNumero(valores[c.codigo] ?? "") ?? 0),
    ...libres.filter((l) => l.tipoCosto === "POR_UNIDAD").map((l) => leerNumero(l.valor) ?? 0),
  ].reduce((a, b) => a + b, 0);
  const fijo = [
    ...calculadas.filter((c) => c.fijo).map((c) => c.valor ?? 0),
    ...catalogo.filter((c) => c.tipoCosto === "FIJO").map((c) => leerNumero(valores[c.codigo] ?? "") ?? 0),
    ...libres.filter((l) => l.tipoCosto === "FIJO").map((l) => leerNumero(l.valor) ?? 0),
  ].reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="divide-y divide-slate-100">
        {calculadas.map((c) => (
          <div key={c.nombre} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1">
              {c.nombre}
              <span className="block text-xs text-slate-500">{c.detalle}</span>
            </span>
            <span className="w-32 shrink-0 rounded-md bg-slate-50 px-2.5 py-1.5 text-right font-medium tabular-nums">
              {c.valor === null ? "—" : formatoPesosExacto(c.valor)}
            </span>
          </div>
        ))}
        {catalogo.map((c) => {
          const valor = valores[c.codigo] ?? "";
          return (
            <div key={c.codigo} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1 text-sm">
                {c.nombre}
                {c.tipoCosto === "FIJO" && <span className="text-xs text-slate-400"> (fijo)</span>}
              </span>
              {c.valorSugerido != null && valor === "" && (
                <button
                  type="button"
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-violet-700 hover:bg-violet-50"
                  onClick={() => alCambiarValor(c.codigo, String(c.valorSugerido))}
                  title="Usar el valor sugerido"
                >
                  {formatoPesos(c.valorSugerido)}
                </button>
              )}
              <div className="w-32 shrink-0">
                <EntradaNumero valor={valor} alCambiar={(v) => alCambiarValor(c.codigo, v)} prefijo="$" />
              </div>
            </div>
          );
        })}
        {libres.map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <input
              className={`${claseEntrada} min-w-0 flex-1`}
              value={item.nombre}
              placeholder="Otro: nombre"
              onChange={(e) => actualizarLibre(i, { nombre: e.target.value })}
            />
            {tipoLibres === "ELEGIR" && (
              <select
                className={`${claseEntrada} w-28 shrink-0`}
                value={item.tipoCosto}
                onChange={(e) => actualizarLibre(i, { tipoCosto: e.target.value as ItemLibre["tipoCosto"] })}
                title="Fijo: se reparte entre todas las unidades"
              >
                <option value="POR_UNIDAD">Por unidad</option>
                <option value="FIJO">Fijo</option>
              </select>
            )}
            <div className="w-32 shrink-0">
              <EntradaNumero valor={item.valor} alCambiar={(valor) => actualizarLibre(i, { valor })} prefijo="$" />
            </div>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
              onClick={() => alCambiarLibres(libres.filter((_, j) => j !== i))}
              aria-label={`Quitar ${item.nombre || "renglón"}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-violet-700 hover:bg-violet-50"
          onClick={() =>
            alCambiarLibres([...libres, { nombre: "", valor: "", tipoCosto: tipoLibres === "FIJO" ? "FIJO" : "POR_UNIDAD" }])
          }
        >
          + Otro
        </button>
        <span className="font-medium text-slate-600 tabular-nums">
          Total:{" "}
          {[porUnidad > 0 ? `${formatoPesosExacto(porUnidad)} / ud` : null, fijo > 0 ? `${formatoPesos(fijo)} fijo` : null]
            .filter(Boolean)
            .join(" + ") || "$0"}
        </span>
      </div>
    </div>
  );
}
