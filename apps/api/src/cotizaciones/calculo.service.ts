import { Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularCotizacion,
  construirConceptos,
  diasRequeridos,
  porcentajesPorFila,
  unidadesPorDia,
  type EntradaCotizacion,
  type Margen,
  type ResultadoCotizacion,
} from '@kromatica/motor-calculo';
import { aNumero } from '../comun/numeros.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CalcularCotizacionDto } from './dto/cotizacion.dto.js';

export interface CalculoCompleto {
  entrada: EntradaCotizacion;
  resultado: ResultadoCotizacion;
  produccion: { cantidad: number; unidadesPorDia: number; diasRequeridos: number }[];
  /** Valores efectivamente usados (los enviados o los vigentes por defecto). */
  usados: {
    valorMinuto: number;
    precioGramo: number;
    horasPorDia: number;
    cifBase: 'PRIMERA_FILA' | 'PROPIA_FILA';
    administracionPorcentaje: number;
    administracionBase: 'PRIMERA_FILA' | 'PROPIA_FILA';
    redondeo: number;
    politica: string;
  };
}

/**
 * Completa los datos de la solicitud con los parámetros vigentes y la política de precios,
 * y llama al motor de cálculo. No guarda nada.
 */
@Injectable()
export class CalculoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
  ) {}

  async calcular(dto: CalcularCotizacionDto, fecha = new Date()): Promise<CalculoCompleto> {
    const politica = dto.politicaId
      ? await this.prisma.politicaPrecios.findUnique({ where: { id: dto.politicaId } })
      : await this.prisma.politicaPrecios.findFirst({ where: { predeterminada: true, activa: true } });
    if (!politica) throw new NotFoundException('No hay una política de precios configurada');

    const p = dto.producto;
    const valorMinuto = p.valorMinuto ?? (await this.parametros.vigente('VALOR_MINUTO', fecha));
    const precioGramo = p.precioGramo ?? (await this.parametros.vigente('PRECIO_GRAMO', fecha));
    const horasPorDia = dto.horasPorDia ?? (await this.parametros.vigente('HORAS_POR_DIA', fecha));
    const clise = p.clise && {
      ...p.clise,
      precioCm2: p.clise.precioCm2 ?? (await this.parametros.vigente('PRECIO_CM2_CLISE', fecha)),
    };

    const conceptos = construirConceptos({ ...p, valorMinuto, precioGramo, clise });
    const n = dto.cantidades.length;
    const cifBase = dto.cif?.base ?? politica.cifBase;
    const administracionBase = dto.administracion?.base ?? politica.administracionBase;
    const administracionPorcentaje = dto.administracion?.porcentajes[0] ?? aNumero(politica.administracionPorcentaje);
    const redondeo = dto.redondeo ?? politica.redondeo;
    const margenes: Margen[] = dto.margenes
      ? dto.margenes.map((m) => ({ valor: m.valor, sobre: m.sobre ?? 'COSTO' }))
      : politica.margenesSugeridos.map((v) => ({ valor: Number(v), sobre: 'COSTO' as const }));

    const entrada: EntradaCotizacion = {
      cantidades: dto.cantidades,
      conceptos,
      cif: porcentajesPorFila(dto.cif?.porcentajes ?? politica.cifPorcentajes.map(Number), cifBase, n),
      administracion: porcentajesPorFila(
        dto.administracion?.porcentajes ?? [administracionPorcentaje],
        administracionBase,
        n,
      ),
      margenes,
      redondeo,
    };

    return {
      entrada,
      resultado: calcularCotizacion(entrada),
      produccion: dto.cantidades.map((cantidad) => ({
        cantidad,
        unidadesPorDia: unidadesPorDia({ moMin: p.moMin, montaje: p.montaje, horasPorDia }),
        diasRequeridos: diasRequeridos({ cantidad, moMin: p.moMin, montaje: p.montaje, horasPorDia }),
      })),
      usados: {
        valorMinuto,
        precioGramo,
        horasPorDia,
        cifBase,
        administracionPorcentaje,
        administracionBase,
        redondeo,
        politica: politica.nombre,
      },
    };
  }
}
