import type { Metadata } from "next";
import { Suspense } from "react";
import { Historial } from "./Historial";

export const metadata: Metadata = { title: "Historial · Kromatica" };

export default function PaginaHistorial() {
  return (
    // Historial lee los filtros de la URL (useSearchParams): se renderiza en el navegador.
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando historial…</p>}>
      <Historial />
    </Suspense>
  );
}
