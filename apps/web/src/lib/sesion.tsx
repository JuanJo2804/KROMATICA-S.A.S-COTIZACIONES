"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type UsuarioSesion } from "./api";

interface Sesion {
  /** undefined = cargando; null = sin sesión. */
  usuario: UsuarioSesion | null | undefined;
  esAdmin: boolean;
  /** Vuelve a pedir quién tiene la sesión (después de iniciarla). */
  recargar: () => Promise<void>;
}

const ContextoSesion = createContext<Sesion>({ usuario: undefined, esAdmin: false, recargar: async () => {} });

/**
 * Quién tiene la sesión iniciada, para mostrar u ocultar lo que solo puede hacer un administrador.
 * Ocultar un botón es solo comodidad: la API es la que exige el rol.
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null | undefined>(undefined);

  const recargar = () =>
    api
      .yo()
      .then(setUsuario)
      .catch(() => setUsuario(null));

  // Una vez al cargar la página: iniciar y cerrar sesión hacen una recarga completa. En /login no se pide (no hay
  // sesión y el 401 no debe redirigir). Se lee window.location y no usePathname para no bloquear el prerender.
  useEffect(() => {
    if (window.location.pathname !== "/login") void recargar();
  }, []);

  return (
    <ContextoSesion.Provider value={{ usuario, esAdmin: usuario?.rol === "ADMIN", recargar }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export const useSesion = () => useContext(ContextoSesion);
