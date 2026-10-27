"use client";

import { useState } from "react";
import type { CalculoEnVivo } from "@/lib/calculo";
import { formatoNumero, formatoPesos, formatoPesosExacto, formatoPorcentaje } from "@/lib/formato";

/**
 * Tabla de cantidades × opciones de margen. Los márgenes se editan en el encabezado y
 * la persona hace clic en el precio que va a enviar para cada cantidad.
 */
export function TablaPrecios({
  calculo,
  margenes,
  alCambiarMargenes,
  elecciones,
  alElegir,
}: {
  calculo: CalculoEnVivo | null;
  /** Márgenes en porcentaje, como texto ("30"). */
  margenes: string[];
  alCambiarMargenes: (margenes: string[]) => void;
  /** Índice de fila → índice de margen elegido. */
  elecciones: Record<number, number>;
  /** margen = null quita la elección de esa fila (clic sobre el precio ya elegido). */
  alElegir: (fila: number, margen: number | null) => void;
}) {
  const [verDesglose, setVerDesglose] = useState(false);
  const filas = calculo?.resultado.filas ?? [];

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Cantidad</th>
              <th className="px-3 text-right font-medium">Costo / ud</th>
              <th className="px-3 text-right font-medium">Días</th>
              {margenes.map((m, i) => (
                <th key={i} className="px-1 text-right font-medium">
                  <div className="flex items-center justify-end gap-0.5">
                    <input
                      inputMode="decimal"
                      aria-label={`Margen ${i + 1} en porcentaje`}
                      className="w-12 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs font-semibold text-slate-700 tabular-nums hover:border-slate-300 focus:border-violet-500 focus:outline-none"
                      value={m}
                      onChange={(e) => alCambiarMargenes(margenes.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    <span>%</span>
                    {margenes.length > 1 && (
                      <button
                        type="button"
                        className="ml-1 text-slate-300 hover:text-rose-600"
                        aria-label={`Quitar margen ${m} %`}
                        onClick={() => alCambiarMargenes(margenes.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="pl-1">
                <button
                  type="button"
                  className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-violet-700 hover:bg-violet-50"
                  onClick={() => alCambiarMargenes([...margenes, ""])}
                >
                  + margen
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {filas.map((fila, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-medium">{formatoNumero(fila.cantidad)}</td>
                <td className="px-3 text-right" title={`Subtotal ${formatoPesosExacto(fila.subtotal)} + admón. ${formatoPesosExacto(fila.administracion)} + CIF ${formatoPesosExacto(fila.cif)}`}>
                  {formatoPesosExacto(fila.costoTotal)}
                </td>
                <td className="px-3 text-right text-slate-600">
                  {formatoNumero(calculo!.produccion[i]!.diasRequeridos)}
                </td>
                {fila.precios.map((p, j) => {
                  const elegido = elecciones[i] === j;
                  return (
                    <td key={j} className="px-1 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => alElegir(i, elegido ? null : j)}
                        aria-pressed={elegido}
                        className={`w-full rounded-md px-2 py-1 text-right transition-colors ${
                          elegido
                            ? "bg-violet-600 text-white shadow-sm"
                            : "hover:bg-violet-50"
                        }`}
                        title={`Precio exacto ${formatoPesosExacto(p.precioUnitario)}${elegido ? " · clic para quitarlo" : ""}`}
                      >
                        <span className="block font-semibold">{formatoPesos(p.precioRedondeado)}</span>
                        <span className={`block whitespace-nowrap text-[11px] ${elegido ? "text-violet-100" : "text-slate-500"}`}>
                          gana {formatoPesos(p.gananciaTotal)}
                        </span>
                      </button>
                    </td>
                  );
                })}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        {filas.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            Completa los datos del producto para ver los precios.
          </p>
        )}
      </div>

      {calculo && filas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Precios por unidad, sin IVA, redondeados a {formatoNumero(calculo.entrada.redondeo ?? 10)}. Haz clic en el
            precio que vas a enviar; otro clic lo quita.
          </span>
          <button type="button" className="text-violet-700 hover:underline" onClick={() => setVerDesglose((v) => !v)}>
            {verDesglose ? "Ocultar" : "Ver"} desglose de costos
          </button>
        </div>
      )}

      {calculo && verDesglose && (
        <div className="mt-3 overflow-x-auto rounded-md bg-slate-50 p-3">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 text-left font-medium">Concepto (por unidad)</th>
                {filas.map((f, i) => (
                  <th key={i} className="text-right font-medium">
                    {formatoNumero(f.cantidad)} uds
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calculo.entrada.conceptos.map((c, k) => (
                <tr key={c.codigo} className="border-t border-slate-200">
                  <td className="py-1">
                    {c.nombre}
                    {c.fijo > 0 && <span className="text-slate-400"> (fijo {formatoPesos(c.fijo)})</span>}
                  </td>
                  {filas.map((f, i) => (
                    <td key={i} className="text-right">
                      {formatoPesosExacto(f.conceptos[k]!.costoUnitario)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-medium">
                <td className="py-1">Subtotal</td>
                {filas.map((f, i) => (
                  <td key={i} className="text-right">{formatoPesosExacto(f.subtotal)}</td>
                ))}
              </tr>
              <tr className="border-t border-slate-200">
                <td className="py-1">Administración</td>
                {filas.map((f, i) => (
                  <td key={i} className="text-right">
                    {formatoPesosExacto(f.administracion)}{" "}
                    <span className="text-slate-400">({formatoPorcentaje(calculo.entrada.administracion[i]!.porcentaje)})</span>
                  </td>
                ))}
              </tr>
              <tr className="border-t border-slate-200">
                <td className="py-1">CIF</td>
                {filas.map((f, i) => (
                  <td key={i} className="text-right">
                    {formatoPesosExacto(f.cif)}{" "}
                    <span className="text-slate-400">({formatoPorcentaje(calculo.entrada.cif[i]!.porcentaje)})</span>
                  </td>
                ))}
              </tr>
              <tr className="border-t border-slate-300 font-semibold">
                <td className="py-1">Costo total</td>
                {filas.map((f, i) => (
                  <td key={i} className="text-right">{formatoPesosExacto(f.costoTotal)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
