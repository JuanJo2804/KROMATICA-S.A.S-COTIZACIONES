import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NuevaCotizacion } from "../../nueva/NuevaCotizacion";

export const metadata: Metadata = { title: "Editar cotización · Kromatica" };

export default function PaginaEditar({ params }: PageProps<"/cotizaciones/[id]/editar">) {
  return (
    // params se lee dentro de Suspense para que el resto de la página se pueda prerenderizar.
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
      <Editar params={params} />
    </Suspense>
  );
}

async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <NuevaCotizacion id={id} />;
}
