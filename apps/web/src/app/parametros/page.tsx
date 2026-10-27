import type { Metadata } from "next";
import { PantallaParametros } from "./PantallaParametros";

export const metadata: Metadata = { title: "Parámetros · Kromatica" };

export default function PaginaParametros() {
  return <PantallaParametros />;
}
