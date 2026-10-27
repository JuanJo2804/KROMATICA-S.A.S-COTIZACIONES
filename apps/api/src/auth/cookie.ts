import type { CookieOptions } from 'express';
import { DURACION_SESION_MS } from './auth.service.js';

export const COOKIE_SESION = 'kromatica_sesion';

/** HttpOnly: el JavaScript de la página no la puede leer. SameSite=Lax: no viaja en peticiones de otros sitios. */
export const opcionesCookie = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DURACION_SESION_MS,
});

/** Lee la cookie de sesión del encabezado Cookie (sin cookie-parser). */
export function leerCookieSesion(encabezado: string | undefined): string | null {
  for (const parte of encabezado?.split(';') ?? []) {
    const [nombre, ...valor] = parte.trim().split('=');
    if (nombre === COOKIE_SESION) return decodeURIComponent(valor.join('=')) || null;
  }
  return null;
}
