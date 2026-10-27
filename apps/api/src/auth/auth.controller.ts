import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { COOKIE_SESION, leerCookieSesion, opcionesCookie } from './cookie.js';
import { Publica, UsuarioActual, type UsuarioSesion } from './decoradores.js';

export class IniciarSesionDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  usuario: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  clave: string;
}

export class CambiarClaveDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  actual: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MaxLength(200)
  nueva: string;
}

@ApiTags('sesión')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Inicia sesión: deja una cookie HttpOnly con el token. */
  @Publica()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: IniciarSesionDto, @Res({ passthrough: true }) res: Response) {
    const { token, usuario } = await this.auth.iniciarSesion(dto.usuario, dto.clave);
    res.cookie(COOKIE_SESION, token, opcionesCookie());
    return usuario;
  }

  @Publica()
  @Post('salir')
  @HttpCode(204)
  async salir(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = leerCookieSesion(req.headers.cookie);
    if (token) await this.auth.cerrarSesion(token);
    const { maxAge: _, ...opciones } = opcionesCookie();
    res.clearCookie(COOKIE_SESION, opciones);
  }

  /** Quién tiene la sesión abierta (nombre y rol). */
  @Get('yo')
  yo(@UsuarioActual() usuario: UsuarioSesion) {
    return usuario;
  }

  @Patch('clave')
  @HttpCode(204)
  async cambiarClave(@UsuarioActual() usuario: UsuarioSesion, @Body() dto: CambiarClaveDto, @Req() req: Request) {
    await this.auth.cambiarClave(usuario, dto.actual, dto.nueva, leerCookieSesion(req.headers.cookie)!);
  }
}
