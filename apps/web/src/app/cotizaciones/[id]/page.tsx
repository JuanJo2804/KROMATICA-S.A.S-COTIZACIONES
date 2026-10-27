import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DetalleCotizacion } from "./DetalleCotizacion";

export const metadata: Metadata = { title: "Cotización · Kromatica" };

export default function PaginaDetalle({ params }: PageProps<"/cotizaciones/[id]">) {
  return (
    // params se lee dentro de Suspense para que el resto de la página se pueda prerenderizar.
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando cotización…</p>}>
      <Detalle params={params} />
    </Suspense>
  );
}

async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <DetalleCotizacion id={id} />;
}
