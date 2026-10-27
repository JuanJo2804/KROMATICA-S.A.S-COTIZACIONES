import type { Parametro, Parametros } from "@/lib/api";
import { formatoFecha, formatoNumero, formatoPesos } from "@/lib/formato";

const FILAS: { clave: keyof Parametros; nombre: string; formato: (v: number) => string }[] = [
  { clave: "VALOR_MINUTO", nombre: "Valor del minuto", formato: formatoPesos },
  { clave: "PRECIO_GRAMO", nombre: "Precio por gramo", formato: formatoPesos },
  { clave: "PRECIO_CM2_CLISE", nombre: "Clisé por cm²", formato: formatoPesos },
  { clave: "HORAS_POR_DIA", nombre: "Horas por día", formato: (v) => `${formatoNumero(v)} h` },
];

/**
 * Valores que casi nunca cambian (tabla Parametro, con fecha de vigencia). Se muestran para saber con qué se
 * calcula, pero no se editan en la cotización.
 */
export function ValoresFijos({ parametros }: { parametros: Parametros }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-semibold">Valores fijos</h2>
      <p className="mt-0.5 text-xs text-slate-500">Se usan en todas las cotizaciones. No se editan aquí.</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {FILAS.map(({ clave, nombre, formato }) => (
          <Valor key={clave} nombre={nombre} parametro={parametros[clave]} formato={formato} />
        ))}
      </dl>
    </section>
  );
}

function Valor({ nombre, parametro, formato }: { nombre: string; parametro: Parametro; formato: (v: number) => string }) {
  return (
    <div title={parametro.nota ?? undefined}>
      <dt className="text-xs text-slate-500">{nombre}</dt>
      <dd className="text-sm font-semibold tabular-nums">
        {formato(parametro.valor)}
        {parametro.nota?.startsWith("PROVISIONAL") && (
          <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">provisional</span>
        )}
      </dd>
      <dd className="text-[11px] text-slate-400">desde {formatoFecha(parametro.vigenteDesde)}</dd>
    </div>
  );
}
