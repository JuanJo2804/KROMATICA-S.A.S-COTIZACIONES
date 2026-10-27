import type { Metadata } from "next";
import { NuevaCotizacion } from "./NuevaCotizacion";

export const metadata: Metadata = { title: "Nueva cotización · Kromatica" };

export default function PaginaNuevaCotizacion() {
  return <NuevaCotizacion />;
}
