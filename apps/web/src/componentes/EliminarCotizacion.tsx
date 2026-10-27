"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Boton, claseEntrada } from "./campos";

/**
 * Eliminar con doble confirmación: primero un aviso de lo que se pierde, después escribir el número de la
 * cotización. La API también exige ese número (?confirmar=), así no se elimina una por error aunque falle la página.
 */
export function EliminarCotizacion({
  id,
  consecutivo,
  alEliminar,
}: {
  id: number;
  consecutivo: number;
  alEliminar: () => void;
}) {
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const [numero, setNumero] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (paso > 0) dialogo.current?.showModal();
    else dialogo.current?.close();
  }, [paso]);

  const cerrar = () => {
    setPaso(0);
    setNumero("");
    setError(null);
  };

  const eliminar = async () => {
    setEliminando(true);
    setError(null);
    try {
      await api.eliminarCotizacion(id, Number(numero));
      alEliminar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
      setEliminando(false);
    }
  };

  return (
    <>
      <Boton variante="secundario" className="w-full text-rose-700 hover:bg-rose-50" onClick={() => setPaso(1)}>
        Eliminar cotización
      </Boton>
      <dialog
        ref={dialogo}
        onClose={cerrar}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="space-y-4 p-5">
          <h2 className="text-base font-semibold">Eliminar la cotización n.º {consecutivo}</h2>
          {paso === 1 ? (
            <>
              <p className="text-sm text-slate-700">
                Se borra <strong>todo</strong>: datos del producto, costos, precios, historial de estados, imagen y
                texto del PDF. <strong>No se puede deshacer.</strong>
              </p>
              <p className="text-sm text-slate-600">
                Si solo quieres que no siga avanzando, es mejor cancelarla: queda en el historial.
              </p>
              <div className="flex justify-end gap-2">
                <Boton variante="fantasma" onClick={cerrar}>
                  No eliminar
                </Boton>
                <Boton variante="secundario" className="text-rose-700 hover:bg-rose-50" onClick={() => setPaso(2)}>
                  Sí, quiero eliminarla
                </Boton>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm text-slate-700">
                Para confirmar, escribe el número de la cotización: <strong className="tabular-nums">{consecutivo}</strong>
                <input
                  inputMode="numeric"
                  autoFocus
                  className={`${claseEntrada} mt-2 tabular-nums`}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.trim())}
                />
              </label>
              {error && <p className="text-sm text-rose-700">{error}</p>}
              <div className="flex justify-end gap-2">
                <Boton variante="fantasma" onClick={cerrar} disabled={eliminando}>
                  Cancelar
                </Boton>
                <Boton
                  variante="peligro"
                  disabled={numero !== String(consecutivo) || eliminando}
                  onClick={eliminar}
                >
                  {eliminando ? "Eliminando…" : "Eliminar definitivamente"}
                </Boton>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
