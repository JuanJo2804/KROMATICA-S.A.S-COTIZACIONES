import type { ReactNode } from "react";

export const claseEntrada =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-xs outline-none " +
  "placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";

export function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {ayuda && <p className="mt-0.5 text-xs text-slate-500">{ayuda}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  obligatorio,
  className,
  children,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  obligatorio?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-700">
        {etiqueta}
        {obligatorio && <span className="text-rose-600"> *</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

/** Campo numérico que guarda el texto tal cual (permite vacío y coma decimal). */
export function EntradaNumero({
  valor,
  alCambiar,
  placeholder,
  prefijo,
  sufijo,
}: {
  valor: string;
  alCambiar: (valor: string) => void;
  placeholder?: string;
  prefijo?: string;
  sufijo?: string;
}) {
  return (
    <div className="relative">
      {prefijo && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
          {prefijo}
        </span>
      )}
      <input
        inputMode="decimal"
        className={`${claseEntrada} tabular-nums ${prefijo ? "pl-6" : ""} ${sufijo ? "pr-10" : ""}`}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => alCambiar(e.target.value)}
      />
      {sufijo && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400">
          {sufijo}
        </span>
      )}
    </div>
  );
}

export function Boton({
  children,
  variante = "secundario",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "fantasma" | "peligro" }) {
  const estilos = {
    primario: "bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300",
    secundario: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
    fantasma: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
    peligro: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
  }[variante];
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${estilos} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
