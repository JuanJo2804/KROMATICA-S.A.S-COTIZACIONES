import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Rol } from '../generated/prisma/enums.js';

/** Persona con sesión iniciada; la pone `SesionGuard` en `request.usuario`. */
export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
}

export const RUTA_PUBLICA = 'rutaPublica';
export const ROLES = 'roles';

/** La ruta no exige sesión (salud, iniciar sesión). Todas las demás sí. */
export const Publica = () => SetMetadata(RUTA_PUBLICA, true);

/** Solo administradores: parámetros globales, eliminar cotizaciones, usuarios. */
export const SoloAdmin = () => SetMetadata(ROLES, ['ADMIN'] satisfies Rol[]);

export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion => ctx.switchToHttp().getRequest<{ usuario: UsuarioSesion }>().usuario,
);
