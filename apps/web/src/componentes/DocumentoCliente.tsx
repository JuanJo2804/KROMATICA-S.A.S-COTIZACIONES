"use client";

import { useRef, useState } from "react";
import { api, type CotizacionDetalle } from "@/lib/api";
import { Boton, claseEntrada } from "./campos";

const TIPOS = ["image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Lo que recibe el cliente: imagen del producto, líneas de texto y el PDF con los precios elegidos.
 * `ejecutar` llama a la API y actualiza la cotización (devuelve false si falló; el error lo muestra el detalle).
 */
export function DocumentoCliente({
  c,
  ocupado,
  ejecutar,
}: {
  c: CotizacionDetalle;
  ocupado: boolean;
  ejecutar: (accion: () => Promise<CotizacionDetalle>) => Promise<boolean>;
}) {
  const sinPrecios = c.cantidades.every((q) => q.precioUnitario == null);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Imagen c={c} ocupado={ocupado} ejecutar={ejecutar} />
      <div className="flex flex-col gap-3">
        {/* key: si cambia lo guardado, el texto en edición se reinicia con lo nuevo. */}
        <Texto key={c.lineasCliente.join("\n")} c={c} ocupado={ocupado} ejecutar={ejecutar} />
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {sinPrecios ? (
            <>
              <Boton variante="primario" disabled>
                Ver PDF
              </Boton>
              <span className="text-xs text-slate-500">Elige el precio de al menos una cantidad.</span>
            </>
          ) : (
            <a
              href={api.urlPdf(c.id)}
              target="_blank"
              rel="noopener"
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              Ver PDF
            </a>
          )}
          {!sinPrecios && c.cantidades.some((q) => q.precioUnitario == null) && (
            <span className="text-xs text-slate-500">Solo van las cantidades con precio elegido.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Imagen({
  c,
  ocupado,
  ejecutar,
}: {
  c: CotizacionDetalle;
  ocupado: boolean;
  ejecutar: (accion: () => Promise<CotizacionDetalle>) => Promise<boolean>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);

  const subir = (archivo: File | undefined) => {
    setAviso(null);
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) return setAviso("La imagen debe ser JPG o PNG.");
    if (archivo.size > MAX_BYTES) return setAviso("La imagen pesa más de 5 MB.");
    void ejecutar(() => api.subirImagen(c.id, archivo));
  };

  return (
    <div>
      <div
        className={`flex h-40 items-center justify-center overflow-hidden rounded-md border-2 border-dashed transition-colors ${
          encima ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-slate-50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          subir(e.dataTransfer.files[0]);
        }}
      >
        {c.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element -- la sirve la API; next/image no aporta aquí
          <img
            src={api.urlImagen(c.id, c.imagen.subidaEn)}
            alt={c.imagen.nombre ?? "Imagen del producto"}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="px-4 text-center text-xs text-slate-500">
            Arrastra aquí la imagen del producto
            <br />o usa el botón. JPG o PNG, hasta 5 MB.
          </p>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS.join(",")}
        className="hidden"
        onChange={(e) => {
          subir(e.target.files?.[0]);
          e.target.value = ""; // permite volver a elegir el mismo archivo
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Boton disabled={ocupado} onClick={() => entrada.current?.click()}>
          {c.imagen ? "Cambiar imagen" : "Subir imagen"}
        </Boton>
        {c.imagen && (
          <Boton variante="fantasma" disabled={ocupado} onClick={() => ejecutar(() => api.borrarImagen(c.id))}>
            Quitar
          </Boton>
        )}
      </div>
      {aviso && <p className="mt-1 text-xs text-rose-700">{aviso}</p>}
    </div>
  );
}

function Texto({
  c,
  ocupado,
  ejecutar,
}: {
  c: CotizacionDetalle;
  ocupado: boolean;
  ejecutar: (accion: () => Promise<CotizacionDetalle>) => Promise<boolean>;
}) {
  const guardado = c.lineasCliente.join("\n");
  const [texto, setTexto] = useState(guardado);
  const cambiado = texto.trim() !== guardado;

  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Texto (una línea por renglón)</span>
        <textarea
          className={`${claseEntrada} min-h-28`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Aplique en PVC\nBase más un color\nTamaño 5 x 2 cms\nCorte recto"}
        />
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {cambiado && (
          <Boton variante="primario" disabled={ocupado} onClick={() => ejecutar(() => api.guardarTextoCliente(c.id, texto))}>
            Guardar texto
          </Boton>
        )}
        {c.textoCliente !== null && !cambiado && (
          <Boton
            variante="fantasma"
            disabled={ocupado}
            onClick={() => ejecutar(() => api.guardarTextoCliente(c.id, null))}
            title="Vuelve a armar el texto con la descripción y el tamaño"
          >
            Usar el texto automático
          </Boton>
        )}
        {c.textoCliente === null && !cambiado && (
          <span className="text-xs text-slate-500">Sale de la descripción y el tamaño. Puedes cambiarlo.</span>
        )}
      </div>
    </div>
  );
}
