"use client";

import Link from "next/link";
import { api, NOMBRE_ROL } from "@/lib/api";
import { useSesion } from "@/lib/sesion";

const enlace = "text-slate-600 hover:text-slate-900";

/** Barra superior: navegación y, a la derecha, quién tiene la sesión. Sin sesión (en /login) solo el nombre. */
export function Encabezado() {
  const { usuario, esAdmin } = useSesion();

  const salir = async () => {
    await api.cerrarSesion().catch(() => undefined);
    // Recarga completa: descarta los datos de la sesión que quedaron en memoria y en la caché del router.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto whitespace-nowrap px-4 py-3 text-sm sm:gap-6">
        <Link href="/" className="font-semibold tracking-tight">
          Kromatica <span className="hidden font-normal text-slate-500 sm:inline">· Cotizaciones</span>
        </Link>
        {usuario && (
          <>
            <Link href="/cotizaciones" className={enlace}>
              Historial
            </Link>
            <Link href="/cotizaciones/nueva" className={enlace}>
              Nueva cotización
            </Link>
            <Link href="/parametros" className={enlace}>
              Parámetros
            </Link>
            {esAdmin && (
              <Link href="/usuarios" className={enlace}>
                Usuarios
              </Link>
            )}
            <div className="ml-auto flex items-center gap-3">
              <Link href="/cuenta" className="text-right leading-tight hover:text-violet-700" title="Mi cuenta">
                <span className="block font-medium">{usuario.nombre}</span>
                <span className="block text-xs text-slate-500">{NOMBRE_ROL[usuario.rol]}</span>
              </Link>
              <button type="button" onClick={salir} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">
                Salir
              </button>
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
