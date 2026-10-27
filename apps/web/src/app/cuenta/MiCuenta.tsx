"use client";

import { useState, type FormEvent } from "react";
import { api, NOMBRE_ROL } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { Boton, Campo, claseEntrada, Seccion } from "@/componentes/campos";

const LARGO_MINIMO = 8;

export function MiCuenta() {
  const { usuario } = useSesion();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const problema =
    nueva && nueva.length < LARGO_MINIMO
      ? `Mínimo ${LARGO_MINIMO} caracteres.`
      : repetida && nueva !== repetida
        ? "Las contraseñas no coinciden."
        : null;

  const cambiar = async (e: FormEvent) => {
    e.preventDefault();
    if (problema) return;
    setGuardando(true);
    setEstado(null);
    try {
      await api.cambiarClave(actual, nueva);
      setActual("");
      setNueva("");
      setRepetida("");
      setEstado({ tipo: "ok", texto: "Contraseña cambiada. Se cerraron tus sesiones en otros equipos." });
    } catch (e) {
      setEstado({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo cambiar" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mi cuenta</h1>
        {usuario && (
          <p className="text-sm text-slate-500">
            {usuario.nombre} · usuario «{usuario.usuario}» · {NOMBRE_ROL[usuario.rol]}
          </p>
        )}
      </div>
      <Seccion titulo="Cambiar contraseña">
        <form onSubmit={cambiar} className="space-y-3">
          <Campo etiqueta="Contraseña actual">
            <input
              type="password"
              className={claseEntrada}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Campo>
          <Campo etiqueta="Nueva contraseña" ayuda={`Mínimo ${LARGO_MINIMO} caracteres.`}>
            <input
              type="password"
              className={claseEntrada}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Campo>
          <Campo etiqueta="Repite la nueva contraseña">
            <input
              type="password"
              className={claseEntrada}
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Campo>
          {problema && <p className="text-sm text-rose-700">{problema}</p>}
          {estado && (
            <p className={`text-sm ${estado.tipo === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{estado.texto}</p>
          )}
          <Boton type="submit" variante="primario" disabled={guardando || !actual || !nueva || nueva !== repetida || !!problema}>
            {guardando ? "Guardando…" : "Cambiar contraseña"}
          </Boton>
        </form>
      </Seccion>
    </div>
  );
}
