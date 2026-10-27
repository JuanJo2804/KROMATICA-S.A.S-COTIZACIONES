import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { aNumero } from '../comun/numeros.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('catálogos')
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tipos-producto')
  tiposProducto() {
    return this.prisma.tipoProducto.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  }

  @Get('conceptos')
  async conceptos() {
    const lista = await this.prisma.conceptoCatalogo.findMany({
      where: { activo: true },
      orderBy: [{ seccion: 'asc' }, { orden: 'asc' }],
    });
    return lista.map((c) => ({ ...c, valorSugerido: aNumero(c.valorSugerido) }));
  }

  @Get('espesores')
  async espesores() {
    const lista = await this.prisma.espesorMaterial.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } });
    return lista.map((e) => ({ ...e, gramos: aNumero(e.gramos), cm2: aNumero(e.cm2), gramosPorCm2: aNumero(e.gramosPorCm2) }));
  }

  @Get('politicas-precios')
  async politicas() {
    const lista = await this.prisma.politicaPrecios.findMany({ where: { activa: true } });
    return lista.map((p) => ({
      ...p,
      cifPorcentajes: p.cifPorcentajes.map(Number),
      administracionPorcentaje: aNumero(p.administracionPorcentaje),
      margenesSugeridos: p.margenesSugeridos.map(Number),
    }));
  }
}
