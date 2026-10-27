"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, NOMBRE_ROL, type Rol, type Usuario } from "@/lib/api";
import { formatoFecha } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import { Boton, Campo, claseEntrada, Seccion } from "@/componentes/campos";

const LARGO_MINIMO = 8;
const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto);

/**
 * Usuarios del sistema (solo administradores). Los usuarios no se borran: se desactivan, así su nombre sigue
 * apareciendo en las cotizaciones que crearon.
 */
export function PantallaUsuarios() {
  const { usuario: yo, esAdmin } = useSesion();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    () =>
      api
        .usuarios()
        .then(setUsuarios)
        .catch((e: unknown) => setError(mensaje(e, "No se pudo cargar la lista"))),
    [],
  );
  useEffect(() => {
    if (esAdmin) void cargar();
  }, [esAdmin, cargar]);

  if (yo === undefined) return <p className="text-sm text-slate-500">Cargando…</p>;
  if (!esAdmin) {
    return <p className="text-sm text-slate-600">Solo un administrador puede ver y administrar los usuarios.</p>;
  }

  /** Aplica un cambio y actualiza la fila; devuelve false si falló. */
  const editar = async (u: Usuario, datos: Parameters<typeof api.editarUsuario>[1]) => {
    setError(null);
    try {
      const editado = await api.editarUsuario(u.id, datos);
      setUsuarios((lista) => lista?.map((x) => (x.id === u.id ? editado : x)) ?? null);
      return true;
    } catch (e) {
      setError(mensaje(e, "No se pudo guardar el cambio"));
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          El <strong>administrador</strong> además cambia los parámetros globales, elimina cotizaciones y administra
          usuarios. El <strong>operario</strong> hace todo lo demás: cotizar, editar borradores, cambiar estados y
          generar el PDF.
        </p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-3 font-medium">Usuario</th>
                <th className="px-3 font-medium">Rol</th>
                <th className="px-3 font-medium">Estado</th>
                <th className="px-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((u) => (
                <FilaUsuario key={u.id} u={u} esYo={u.id === yo?.id} editar={editar} />
              ))}
            </tbody>
          </table>
          {!usuarios && <p className="px-4 py-6 text-sm text-slate-500">Cargando…</p>}
        </div>
        <NuevoUsuario alCrear={(u) => setUsuarios((lista) => [...(lista ?? []), u])} />
      </div>
    </div>
  );
}

function FilaUsuario({
  u,
  esYo,
  editar,
}: {
  u: Usuario;
  esYo: boolean;
  editar: (u: Usuario, datos: Parameters<typeof api.editarUsuario>[1]) => Promise<boolean>;
}) {
  const [clave, setClave] = useState<string | null>(null);

  return (
    <tr className={`border-b border-slate-100 align-top last:border-0 ${u.activo ? "" : "text-slate-400"}`}>
      <td className="px-4 py-3">
        <span className="font-medium">{u.nombre}</span>
        {esYo && <span className="ml-1 text-xs text-slate-500">(tú)</span>}
        <span className="block text-xs text-slate-400">desde {formatoFecha(u.creadoEn)}</span>
      </td>
      <td className="px-3 py-3 font-mono text-xs">{u.usuario}</td>
      <td className="px-3 py-3">
        <select
          className={`${claseEntrada} w-36`}
          value={u.rol}
          disabled={esYo}
          title={esYo ? "No puedes cambiar tu propio rol" : undefined}
          onChange={(e) => void editar(u, { rol: e.target.value as Rol })}
        >
          <option value="OPERARIO">{NOMBRE_ROL.OPERARIO}</option>
          <option value="ADMIN">{NOMBRE_ROL.ADMIN}</option>
        </select>
      </td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
            u.activo ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-500 ring-slate-200"
          }`}
        >
          {u.activo ? "Activo" : "Desactivado"}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        {clave === null ? (
          <div className="flex justify-end gap-1">
            <Boton variante="fantasma" onClick={() => setClave("")}>
              Cambiar contraseña
            </Boton>
            {!esYo && (
              <Boton
                variante="fantasma"
                onClick={() => {
                  if (u.activo && !window.confirm(`¿Desactivar a ${u.nombre}? No podrá iniciar sesión.`)) return;
                  void editar(u, { activo: !u.activo });
                }}
                className={u.activo ? "hover:text-rose-700" : ""}
              >
                {u.activo ? "Desactivar" : "Activar"}
              </Boton>
            )}
          </div>
        ) : (
          <div className="ml-auto flex max-w-xs flex-col items-end gap-1">
            <input
              type="password"
              className={claseEntrada}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            <div className="flex gap-1">
              <Boton variante="fantasma" onClick={() => setClave(null)}>
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                disabled={clave.length < LARGO_MINIMO}
                title={`Mínimo ${LARGO_MINIMO} caracteres`}
                onClick={async () => {
                  if (await editar(u, { clave })) setClave(null);
                }}
              >
                Guardar
              </Boton>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function NuevoUsuario({ alCrear }: { alCrear: (u: Usuario) => void }) {
  const vacio = { nombre: "", usuario: "", clave: "", rol: "OPERARIO" as Rol };
  const [datos, setDatos] = useState(vacio);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo: keyof typeof vacio) => (valor: string) => setDatos((d) => ({ ...d, [campo]: valor }));

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      alCrear(await api.crearUsuario(datos));
      setDatos(vacio);
    } catch (e) {
      setError(mensaje(e, "No se pudo crear"));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Seccion titulo="Nuevo usuario">
      <form onSubmit={crear} className="space-y-3">
        <Campo etiqueta="Nombre" obligatorio>
          <input className={claseEntrada} value={datos.nombre} onChange={(e) => cambiar("nombre")(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Usuario" obligatorio ayuda="Para iniciar sesión: letras, números, punto o guion.">
          <input
            className={claseEntrada}
            value={datos.usuario}
            autoCapitalize="none"
            onChange={(e) => cambiar("usuario")(e.target.value)}
            required
          />
        </Campo>
        <Campo etiqueta="Contraseña" obligatorio ayuda={`Mínimo ${LARGO_MINIMO} caracteres. Compártela en persona.`}>
          <input
            type="password"
            className={claseEntrada}
            value={datos.clave}
            autoComplete="new-password"
            onChange={(e) => cambiar("clave")(e.target.value)}
            required
          />
        </Campo>
        <Campo etiqueta="Rol">
          <select className={claseEntrada} value={datos.rol} onChange={(e) => cambiar("rol")(e.target.value)}>
            <option value="OPERARIO">{NOMBRE_ROL.OPERARIO}</option>
            <option value="ADMIN">{NOMBRE_ROL.ADMIN}</option>
          </select>
        </Campo>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <Boton
          type="submit"
          variante="primario"
          className="w-full"
          disabled={guardando || !datos.nombre || !datos.usuario || datos.clave.length < LARGO_MINIMO}
        >
          {guardando ? "Creando…" : "Crear usuario"}
        </Boton>
      </form>
    </Seccion>
  );
}
