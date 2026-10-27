import { Body, Controller, Get, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ClaveParametro } from '../generated/prisma/enums.js';
import { SoloAdmin, UsuarioActual, type UsuarioSesion } from '../auth/decoradores.js';
import { ParametrosService } from './parametros.service.js';

export class RegistrarParametroDto {
  @ApiProperty({ enum: ClaveParametro })
  @IsEnum(ClaveParametro)
  clave: ClaveParametro;

  @ApiProperty({ example: 460 })
  @IsNumber()
  @Min(0)
  valor: number;

  @ApiProperty({ example: '2027-01-01', description: 'Fecha desde la que aplica el nuevo valor' })
  @Type(() => Date)
  @IsDate()
  vigenteDesde: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}

@ApiTags('parámetros')
@Controller('parametros')
export class ParametrosController {
  constructor(private readonly parametros: ParametrosService) {}

  @Get()
  vigentes() {
    return this.parametros.vigentes();
  }

  @Get(':clave/historial')
  historial(@Param('clave', new ParseEnumPipe(ClaveParametro)) clave: ClaveParametro) {
    return this.parametros.historial(clave);
  }

  /** Registra un nuevo valor con fecha de vigencia. Las cotizaciones anteriores no cambian. Solo administradores. */
  @SoloAdmin()
  @Post()
  registrar(@Body() dto: RegistrarParametroDto, @UsuarioActual() usuario: UsuarioSesion) {
    return this.parametros.registrar(dto.clave, dto.valor, dto.vigenteDesde, dto.nota, usuario.id);
  }
}
