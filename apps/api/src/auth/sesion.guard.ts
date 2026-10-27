import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Rol } from '../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';
import { leerCookieSesion } from './cookie.js';
import { ROLES, RUTA_PUBLICA, type UsuarioSesion } from './decoradores.js';

/**
 * Guard global: toda ruta exige sesión salvo las marcadas con @Publica(); las marcadas con @SoloAdmin() exigen
 * rol ADMIN. Deja el usuario en `request.usuario`.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(RUTA_PUBLICA, destinos)) return true;

    const request = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioSesion }>();
    const token = leerCookieSesion(request.headers.cookie);
    const usuario = token ? await this.auth.validar(token) : null;
    if (!usuario) throw new UnauthorizedException('Inicia sesión para continuar');
    request.usuario = usuario;

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, destinos);
    if (roles && !roles.includes(usuario.rol)) {
      throw new ForbiddenException('Solo un administrador puede hacer esto');
    }
    return true;
  }
}
