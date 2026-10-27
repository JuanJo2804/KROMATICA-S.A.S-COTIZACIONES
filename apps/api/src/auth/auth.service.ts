import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { cifrarClave, hashToken, LARGO_MINIMO_CLAVE, nuevoToken, verificarClave } from './claves.js';
import type { UsuarioSesion } from './decoradores.js';

export const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FALLOS = 5;
const BLOQUEO_MS = 10 * 60 * 1000;

const aSesion = (u: UsuarioSesion): UsuarioSesion => ({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol });

/** Normaliza el nombre de usuario: sin espacios a los lados y en minúsculas. */
export const normalizarUsuario = (usuario: string) => usuario.trim().toLowerCase();

export function exigirClaveValida(clave: string) {
  if (clave.length < LARGO_MINIMO_CLAVE) {
    throw new BadRequestException(`La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`);
  }
}

@Injectable()
export class AuthService {
  /** Intentos fallidos por usuario (en memoria: basta para un solo servidor). */
  private readonly fallos = new Map<string, { cantidad: number; desde: number }>();
  // Hash de una clave cualquiera, para tardar lo mismo cuando el usuario no existe.
  private readonly hashFalso = cifrarClave('clave-que-no-existe');

  constructor(private readonly prisma: PrismaService) {}

  /** Verifica usuario y contraseña y crea una sesión. Devuelve el token para la cookie. */
  async iniciarSesion(usuarioTexto: string, clave: string) {
    const usuario = normalizarUsuario(usuarioTexto);
    const intentos = this.fallos.get(usuario);
    if (intentos && intentos.cantidad >= MAX_FALLOS && Date.now() - intentos.desde < BLOQUEO_MS) {
      throw new HttpException('Demasiados intentos fallidos. Espera 10 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const encontrado = await this.prisma.usuario.findUnique({ where: { usuario } });
    const correcta = await verificarClave(clave, encontrado?.claveHash ?? (await this.hashFalso));
    if (!encontrado || !correcta || !encontrado.activo) {
      const previo = intentos && Date.now() - intentos.desde < BLOQUEO_MS ? intentos : { cantidad: 0, desde: Date.now() };
      this.fallos.set(usuario, { cantidad: previo.cantidad + 1, desde: previo.desde });
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    this.fallos.delete(usuario);

    const token = nuevoToken();
    await this.prisma.$transaction([
      this.prisma.sesion.deleteMany({ where: { expiraEn: { lt: new Date() } } }),
      this.prisma.sesion.create({
        data: { tokenHash: hashToken(token), usuarioId: encontrado.id, expiraEn: new Date(Date.now() + DURACION_SESION_MS) },
      }),
    ]);
    return { token, usuario: aSesion(encontrado) };
  }

  /** Usuario de la sesión, o null si el token no existe, venció o el usuario fue desactivado. */
  async validar(token: string): Promise<UsuarioSesion | null> {
    const sesion = await this.prisma.sesion.findUnique({ where: { tokenHash: hashToken(token) }, include: { usuario: true } });
    if (!sesion || sesion.expiraEn < new Date() || !sesion.usuario.activo) return null;
    return aSesion(sesion.usuario);
  }

  async cerrarSesion(token: string) {
    await this.prisma.sesion.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  /** Cambia la contraseña propia y cierra las demás sesiones de esa persona. */
  async cambiarClave(usuario: UsuarioSesion, actual: string, nueva: string, tokenActual: string) {
    const encontrado = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    if (!(await verificarClave(actual, encontrado.claveHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    exigirClaveValida(nueva);
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: usuario.id }, data: { claveHash: await cifrarClave(nueva) } }),
      this.prisma.sesion.deleteMany({ where: { usuarioId: usuario.id, tokenHash: { not: hashToken(tokenActual) } } }),
    ]);
  }
}
