import type { Metadata } from "next";
import { MiCuenta } from "./MiCuenta";

export const metadata: Metadata = { title: "Mi cuenta · Kromatica" };

export default function PaginaCuenta() {
  return <MiCuenta />;
}
