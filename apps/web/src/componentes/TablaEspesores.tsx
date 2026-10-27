"use client";

import type { Espesor } from "@/lib/api";
import { formatoNumero } from "@/lib/formato";

/**
 * "TABLA DE GRAMOS POR CM²" del Excel: cada espesor con su muestra (gramos y cm²), la relación g/cm² y los gramos
 * que daría el clisé actual ("NUEVOS GRAMOS"). Se elige el espesor haciendo clic en la fila.
 */
export function TablaEspesores({
  espesores,
  elegido,
  alElegir,
  cm2,
}: {
  espesores: Espesor[];
  elegido: string;
  alElegir: (nombre: string) => void;
  /** cm² del clisé, para calcular los nuevos gramos de cada espesor. */
  cm2: number | undefined;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-xs tabular-nums" role="radiogroup" aria-label="Espesor">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Espesor</th>
            <th className="px-2 text-right font-medium">Gramos</th>
            <th className="px-2 text-right font-medium">cm²</th>
            <th className="px-2 text-right font-medium">g / cm²</th>
            <th className="px-2 text-right font-medium" title="Gramos por clisé con el área actual del clisé">
              Nuevos gramos{cm2 ? ` (${formatoNumero(cm2)} cm²)` : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {espesores.map((e) => {
            const activo = e.nombre === elegido;
            return (
              <tr
                key={e.id}
                role="radio"
                aria-checked={activo}
                tabIndex={0}
                onClick={() => alElegir(activo ? "" : e.nombre)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    alElegir(activo ? "" : e.nombre);
                  }
                }}
                className={`cursor-pointer border-t border-slate-100 ${
                  activo ? "bg-violet-600 text-white" : "hover:bg-violet-50"
                }`}
              >
                <td className="px-2 py-1 font-medium">{e.nombre}</td>
                <td className="px-2 text-right">{e.gramos != null ? formatoNumero(e.gramos) : "—"}</td>
                <td className="px-2 text-right">{e.cm2 != null ? formatoNumero(e.cm2) : "—"}</td>
                <td className="px-2 text-right">{formatoNumero(Math.round(e.gramosPorCm2 * 100) / 100)}</td>
                <td className="px-2 text-right font-semibold">
                  {cm2 ? formatoNumero(Math.round(e.gramosPorCm2 * cm2)) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
