import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { aNumero } from '../comun/numeros.js';
import { TipoCorte } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { sugerirMoMin } from './similitud.js';
import { sugerirTroquelada } from './troquelada.js';

export class ConsultaTiempoDto {
  @ApiPropertyOptional({ example: 'llavero' })
  @IsOptional()
  @IsString()
  tipoProducto?: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tintas: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  montaje: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  anchoCm?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  altoCm?: number;
}

export class ConsultaTroqueladaDto {
  @ApiPropertyOptional({ example: 'llavero' })
  @IsOptional()
  @IsString()
  tipoProducto?: string;

  @ApiPropertyOptional({ enum: TipoCorte, example: 'TROQUELADO' })
  @IsOptional()
  @IsEnum(TipoCorte)
  tipoCorte?: TipoCorte;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  anchoCm?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  altoCm?: number;

  @ApiPropertyOptional({ example: 15, description: 'Unidades por plancha' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  montaje?: number;

  @ApiPropertyOptional({ example: '3 mm', description: 'Nombre del espesor (catálogo de espesores)' })
  @IsOptional()
  @IsString()
  espesor?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tintas?: number;
}

@ApiTags('sugerencias')
@Controller('sugerencias')
export class SugerenciasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tiempo')
  @ApiOperation({ summary: 'Sugiere el MO min a partir de las cotizaciones más parecidas' })
  async tiempo(@Query() consulta: ConsultaTiempoDto) {
    const historial = await this.prisma.cotizacion.findMany({
      where: { estado: { notIn: ['BORRADOR', 'CANCELADA'] } },
      select: {
        id: true,
        tintas: true,
        montaje: true,
        anchoCm: true,
        altoCm: true,
        moMin: true,
        moMinReal: true,
        referencia: true,
        tipoProducto: { select: { codigo: true } },
        cliente: { select: { nombre: true } },
      },
    });
    const muestras = historial.map((c) => ({
      id: c.id,
      tipoProducto: c.tipoProducto?.codigo ?? null,
      tintas: c.tintas,
      montaje: c.montaje,
      anchoCm: aNumero(c.anchoCm),
      altoCm: aNumero(c.altoCm),
      // Cuando exista el tiempo real medido, es más confiable que el estimado.
      moMin: aNumero(c.moMinReal) ?? aNumero(c.moMin),
      cliente: c.cliente?.nombre ?? null,
      referencia: c.referencia,
    }));
    return sugerirMoMin(consulta, muestras);
  }

  @Get('troquelada')
  @ApiOperation({ summary: 'Sugiere las unidades troqueladas por hora a partir de las cotizaciones más parecidas' })
  async troquelada(@Query() consulta: ConsultaTroqueladaDto) {
    const espesor = consulta.espesor
      ? await this.prisma.espesorMaterial.findUnique({ where: { nombre: consulta.espesor } })
      : null;
    const historial = await this.prisma.cotizacion.findMany({
      where: { estado: { notIn: ['BORRADOR', 'CANCELADA'] }, troqueladasPorHora: { gt: 0 } },
      select: {
        id: true,
        tipoCorte: true,
        anchoCm: true,
        altoCm: true,
        montaje: true,
        gramosPorCm2: true,
        tintas: true,
        troqueladasPorHora: true,
        referencia: true,
        tipoProducto: { select: { codigo: true } },
        cliente: { select: { nombre: true } },
      },
    });
    const muestras = historial.map((c) => ({
      id: c.id,
      tipoProducto: c.tipoProducto?.codigo ?? null,
      tipoCorte: c.tipoCorte,
      anchoCm: aNumero(c.anchoCm),
      altoCm: aNumero(c.altoCm),
      montaje: c.montaje,
      gramosPorCm2: aNumero(c.gramosPorCm2),
      tintas: c.tintas,
      troqueladasPorHora: aNumero(c.troqueladasPorHora)!,
      cliente: c.cliente?.nombre ?? null,
      referencia: c.referencia,
    }));
    return sugerirTroquelada({ ...consulta, gramosPorCm2: aNumero(espesor?.gramosPorCm2) }, muestras);
  }
}
