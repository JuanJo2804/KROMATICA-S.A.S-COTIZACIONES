"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ClaveParametro, type ParametroRegistrado } from "@/lib/api";
import { formatoFecha, formatoNumero, formatoPesos, leerNumero } from "@/lib/formato";
import { Boton, Campo, claseEntrada, EntradaNumero } from "@/componentes/campos";
import { useSesion } from "@/lib/sesion";

const PARAMETROS: { clave: ClaveParametro; nombre: string; ayuda: string; unidad: "pesos" | "horas" }[] = [
  { clave: "VALOR_MINUTO", nombre: "Valor del minuto", ayuda: "Mano de obra rubber y troquelada.", unidad: "pesos" },
  { clave: "PRECIO_GRAMO", nombre: "Precio por gramo", ayuda: "Material rubber (gramos por clisé × $/gramo).", unidad: "pesos" },
  { clave: "PRECIO_CM2_CLISE", nombre: "Clisé por cm²", ayuda: "Costo del clisé = cm² × n.º de clisés × $/cm².", unidad: "pesos" },
  { clave: "HORAS_POR_DIA", nombre: "Horas por día", ayuda: "Jornada para calcular los días requeridos.", unidad: "horas" },
];

/** Fecha de hoy en la zona horaria del navegador, como "AAAA-MM-DD". */
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Parámetros globales con fecha de vigencia. Un valor nuevo no modifica el anterior: aplica a las cotizaciones
 * que se calculen desde su fecha, y las ya guardadas conservan los valores con que se calcularon.
 */
export function PantallaParametros() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Parámetros</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Valores que casi nunca cambian. Al registrar uno nuevo se indica desde qué fecha aplica; las cotizaciones ya
          guardadas no cambian porque guardan una copia de los valores con que se calcularon.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PARAMETROS.map((p) => (
          <TarjetaParametro key={p.clave} {...p} />
        ))}
      </div>
    </div>
  );
}

function TarjetaParametro({ clave, nombre, ayuda, unidad }: (typeof PARAMETROS)[number]) {
  const { esAdmin } = useSesion();
  const [historial, setHistorial] = useState<ParametroRegistrado[] | null>(null);
  // La fecha de hoy se toma en el navegador al cargar, no al renderizar (la página se prerenderiza).
  const [fechaHoy, setFechaHoy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(
    () =>
      api
        .historialParametro(clave)
        .then((lista) => {
          setHistorial(lista);
          setFechaHoy(hoy());
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar")),
    [clave],
  );
  useEffect(() => {
    cargar();
  }, [cargar]);

  const formato = (v: number) => (unidad === "pesos" ? formatoPesos(v) : `${formatoNumero(v)} h`);
  // El historial viene ordenado de la fecha más nueva a la más antigua.
  const vigente = historial?.find((p) => p.vigenteDesde.slice(0, 10) <= fechaHoy);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{nombre}</h2>
          <p className="text-xs text-slate-500">{ayuda}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{vigente ? formato(vigente.valor) : "—"}</p>
          {vigente && <p className="text-[11px] text-slate-400">vigente desde {formatoFecha(vigente.vigenteDesde)}</p>}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      {historial && historial.length > 0 && (
        <table className="mt-3 w-full text-xs tabular-nums">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-1.5 font-medium">Desde</th>
              <th className="px-2 text-right font-medium">Valor</th>
              <th className="pl-2 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((p) => {
              const futuro = p.vigenteDesde.slice(0, 10) > fechaHoy;
              return (
                <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${p.id === vigente?.id ? "font-semibold" : ""}`}>
                  <td className="whitespace-nowrap py-1.5">
                    {formatoFecha(p.vigenteDesde)}
                    {futuro && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800">programado</span>}
                    {p.id === vigente?.id && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-800">vigente</span>
                    )}
                  </td>
                  <td className="px-2 text-right">{formato(p.valor)}</td>
                  <td className="pl-2 font-normal text-slate-500">
                    {p.nota}
                    {p.creadoPor && <span className="block text-[11px] text-slate-400">por {p.creadoPor}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="mt-3">
        {!esAdmin ? (
          <p className="text-xs text-slate-500">Solo un administrador puede registrar valores nuevos.</p>
        ) : abierto ? (
          <FormularioValor
            clave={clave}
            unidad={unidad}
            fechaHoy={fechaHoy}
            alCancelar={() => setAbierto(false)}
            alGuardar={async () => {
              setAbierto(false);
              await cargar();
            }}
          />
        ) : (
          <Boton variante="secundario" onClick={() => setAbierto(true)}>
            Registrar nuevo valor
          </Boton>
        )}
      </div>
    </section>
  );
}

function FormularioValor({
  clave,
  unidad,
  fechaHoy,
  alCancelar,
  alGuardar,
}: {
  clave: ClaveParametro;
  unidad: "pesos" | "horas";
  fechaHoy: string;
  alCancelar: () => void;
  alGuardar: () => Promise<void>;
}) {
  const [valor, setValor] = useState("");
  const [desde, setDesde] = useState(fechaHoy);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numero = leerNumero(valor);
  const valido = numero !== undefined && numero > 0 && /^\d{4}-\d{2}-\d{2}$/.test(desde);

  const guardar = async () => {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      await api.registrarParametro({ clave, valor: numero, vigenteDesde: desde, nota: nota.trim() || undefined });
      await alGuardar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nuevo valor" obligatorio>
          <EntradaNumero
            valor={valor}
            alCambiar={setValor}
            prefijo={unidad === "pesos" ? "$" : undefined}
            sufijo={unidad === "horas" ? "h" : undefined}
          />
        </Campo>
        <Campo etiqueta="Vigente desde" obligatorio>
          <input type="date" className={claseEntrada} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Nota">
        <input
          className={claseEntrada}
          value={nota}
          placeholder="Ej.: aumento del salario mínimo"
          onChange={(e) => setNota(e.target.value)}
        />
      </Campo>
      {desde < fechaHoy && (
        <p className="text-xs text-amber-700">
          La fecha es anterior a hoy: las cotizaciones ya guardadas no cambian, pero las que se recalculen sí lo usarán.
        </p>
      )}
      <p className="text-xs text-slate-500">Si ya hay un valor con esa misma fecha, se reemplaza.</p>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton variante="primario" onClick={guardar} disabled={!valido || guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
    </div>
  );
}
