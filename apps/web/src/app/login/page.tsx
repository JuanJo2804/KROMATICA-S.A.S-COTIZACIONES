import type { Metadata } from "next";
import { Suspense } from "react";
import { IniciarSesion } from "./IniciarSesion";

export const metadata: Metadata = { title: "Iniciar sesión · Kromatica" };

export default function PaginaLogin() {
  return (
    // IniciarSesion lee ?siguiente= de la URL (useSearchParams): se renderiza en el navegador.
    <Suspense>
      <IniciarSesion />
    </Suspense>
  );
}
