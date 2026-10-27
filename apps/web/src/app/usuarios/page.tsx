import type { Metadata } from "next";
import { PantallaUsuarios } from "./PantallaUsuarios";

export const metadata: Metadata = { title: "Usuarios · Kromatica" };

export default function PaginaUsuarios() {
  return <PantallaUsuarios />;
}
