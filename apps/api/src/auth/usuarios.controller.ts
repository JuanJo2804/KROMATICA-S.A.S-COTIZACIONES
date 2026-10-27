import { Body, ConflictException, Controller, Get, Injectable, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Rol } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { exigirClaveValida, normalizarUsuario } from './auth.service.js';
import { cifrarClave } from './claves.js';
import { SoloAdmin, UsuarioActual, type UsuarioSesion } from './decoradores.js';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'maria', description: 'Para iniciar sesión: letras, números, punto, guion' })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,40}$/, { message: 'El usuario debe tener de 3 a 40 letras, números, punto o guion' })
  usuario: string;

  @ApiProperty({ example: 'María Gómez' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MaxLength(200)
  clave: string;

  @ApiProperty({ enum: Rol })
  @IsEnum(Rol)
  rol: Rol;
}

export class EditarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ enum: Rol })
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;

  @ApiPropertyOptional({ description: 'false = no puede iniciar sesión (y se cierran sus sesiones)' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'Nueva contraseña (cierra sus sesiones)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clave?: string;
}

const CAMPOS = { id: true, usuario: true, nombre: true, rol: true, activo: true, creadoEn: true } as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.usuario.findMany({ select: CAMPOS, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] });
  }

  async crear(dto: CrearUsuarioDto) {
    exigirClaveValida(dto.clave);
    const usuario = normalizarUsuario(dto.usuario);
    if (await this.prisma.usuario.findUnique({ where: { usuario } })) {
      throw new ConflictException(`Ya existe el usuario "${usuario}"`);
    }
    return this.prisma.usuario.create({
      data: { usuario, nombre: dto.nombre.trim(), rol: dto.rol, claveHash: await cifrarClave(dto.clave) },
      select: CAMPOS,
    });
  }

  async editar(id: number, dto: EditarUsuarioDto, quien: UsuarioSesion) {
    const actual = await this.prisma.usuario.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException(`No existe el usuario ${id}`);
    // Que nunca se quede el sistema sin un administrador activo (ni se bloquee uno a sí mismo).
    const dejaDeSerAdmin = actual.rol === 'ADMIN' && actual.activo && (dto.rol === 'OPERARIO' || dto.activo === false);
    if (dejaDeSerAdmin) {
      if (id === quien.id) throw new ConflictException('No puedes quitarte el rol de administrador ni desactivarte');
      const admins = await this.prisma.usuario.count({ where: { rol: 'ADMIN', activo: true } });
      if (admins <= 1) throw new ConflictException('Debe quedar al menos un administrador activo');
    }
    if (dto.clave !== undefined) exigirClaveValida(dto.clave);

    const cierraSesiones = dto.activo === false || dto.clave !== undefined;
    const [editado] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id },
        data: {
          nombre: dto.nombre?.trim(),
          rol: dto.rol,
          activo: dto.activo,
          claveHash: dto.clave !== undefined ? await cifrarClave(dto.clave) : undefined,
        },
        select: CAMPOS,
      }),
      this.prisma.sesion.deleteMany({ where: { usuarioId: cierraSesiones ? id : -1 } }),
    ]);
    return editado;
  }
}

/** Administración de usuarios: solo administradores. */
@ApiTags('usuarios')
@SoloAdmin()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuarios.crear(dto);
  }

  @Patch(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarUsuarioDto, @UsuarioActual() quien: UsuarioSesion) {
    return this.usuarios.editar(id, dto, quien);
  }
}
