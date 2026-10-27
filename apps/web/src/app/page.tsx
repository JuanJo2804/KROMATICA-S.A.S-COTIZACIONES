import { redirect } from "next/navigation";

/** La portada es el historial de cotizaciones. */
export default function Inicio() {
  redirect("/cotizaciones");
}
