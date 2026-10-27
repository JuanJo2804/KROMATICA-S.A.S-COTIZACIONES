import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { aNumero } from '../comun/numeros.js';
import type { ClaveParametro } from '../generated/prisma/client.js';

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Valor vigente de un parámetro en una fecha (por defecto, hoy). */
  async vigente(clave: ClaveParametro, fecha = new Date()): Promise<number> {
    const p = await this.prisma.parametro.findFirst({
      where: { clave, vigenteDesde: { lte: fecha } },
      orderBy: { vigenteDesde: 'desc' },
    });
    if (!p) throw new NotFoundException(`No hay un valor vigente para el parámetro ${clave}`);
    return aNumero(p.valor);
  }

  /** Valores vigentes de todos los parámetros. */
  async vigentes(fecha = new Date()) {
    const todos = await this.prisma.parametro.findMany({
      where: { vigenteDesde: { lte: fecha } },
      orderBy: [{ clave: 'asc' }, { vigenteDesde: 'desc' }],
    });
    const resultado: Record<string, { valor: number; vigenteDesde: Date; nota: string | null }> = {};
    for (const p of todos) {
      resultado[p.clave] ??= { valor: aNumero(p.valor), vigenteDesde: p.vigenteDesde, nota: p.nota };
    }
    return resultado;
  }

  historial(clave: ClaveParametro) {
    return this.prisma.parametro
      .findMany({
        where: { clave },
        orderBy: { vigenteDesde: 'desc' },
        include: { creadoPor: { select: { nombre: true } } },
      })
      .then((lista) => lista.map(({ creadoPor, ...p }) => ({ ...p, valor: aNumero(p.valor), creadoPor: creadoPor?.nombre ?? null })));
  }

  async registrar(clave: ClaveParametro, valor: number, vigenteDesde: Date, nota?: string, creadoPorId?: number) {
    const p = await this.prisma.parametro.upsert({
      where: { clave_vigenteDesde: { clave, vigenteDesde } },
      update: { valor, nota, creadoPorId },
      create: { clave, valor, vigenteDesde, nota, creadoPorId },
    });
    return { ...p, valor: aNumero(p.valor) };
  }
}
