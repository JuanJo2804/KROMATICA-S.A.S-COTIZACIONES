"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Boton, Campo, claseEntrada } from "@/componentes/campos";

/** Solo rutas internas ("/cotizaciones/12"), para que ?siguiente= no pueda llevar a otro sitio. */
const destinoSeguro = (siguiente: string | null) =>
  siguiente && siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/cotizaciones";

export function IniciarSesion() {
  const params = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.iniciarSesion(usuario, clave);
      // Carga completa (no router.push) para que el encabezado y la sesión empiecen de cero.
      window.location.href = destinoSeguro(params.get("siguiente"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <form onSubmit={entrar} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-slate-500">Cotizaciones de Kromatica</p>
        </div>
        <Campo etiqueta="Usuario">
          <input
            className={claseEntrada}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
          />
        </Campo>
        <Campo etiqueta="Contraseña">
          <input
            type="password"
            className={claseEntrada}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Campo>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <Boton type="submit" variante="primario" className="w-full" disabled={enviando || !usuario || !clave}>
          {enviando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>
      <p className="mt-3 text-center text-xs text-slate-500">¿Olvidaste la contraseña? Pídele a un administrador que la cambie.</p>
    </div>
  );
}
