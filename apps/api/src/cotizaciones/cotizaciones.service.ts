import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { calcularPrecios, troqueladasPorHora, type Margen } from '@kromatica/motor-calculo';
import { aTextoFecha, hoyEnColombia } from '../comun/fechas.js';
import { aNumero } from '../comun/numeros.js';
import type { EstadoCotizacion, Prisma, SeccionConcepto } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalculoService, type CalculoCompleto } from './calculo.service.js';
import type {
  CambiarEstadoDto,
  ElegirMargenesDto,
  FiltroCotizacionesDto,
  GuardarCotizacionDto,
  TiempoRealDto,
} from './dto/cotizacion.dto.js';
import { aceptaTiempoReal, esEditable, puedeCambiar, transicionesPermitidas } from './estados.js';
import { lineasDeTexto, lineasPorDefecto } from './pdf-cliente.js';

const SECCIONES: Record<string, SeccionConcepto> = {
  troquel: 'TROQUEL',
  clise: 'CLISE',
  pantografo: 'CLISE',
  troquelada: 'TROQUELADA',
  material: 'MATERIAL',
  armada: 'ARMADA',
  empaque: 'EMPAQUE',
  otros: 'OTROS',
};

const INCLUIR = {
  cliente: true,
  tipoProducto: true,
  conceptos: { orderBy: { orden: 'asc' } },
  margenes: { orderBy: { orden: 'asc' } },
  cantidades: { orderBy: { orden: 'asc' } },
  historial: { orderBy: { fecha: 'asc' }, include: { usuario: { select: { nombre: true } } } },
  creadaPor: { select: { id: true, nombre: true } },
  imagen: { select: { tipo: true, nombre: true, subidaEn: true } }, // sin los bytes
} satisfies Prisma.CotizacionInclude;

type CotizacionCompleta = Prisma.CotizacionGetPayload<{ include: typeof INCLUIR }>;

@Injectable()
export class CotizacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculo: CalculoService,
  ) {}

  async crear(dto: GuardarCotizacionDto, usuarioId: number) {
    const calculo = await this.calculo.calcular(dto);
    const datos = await this.datosParaGuardar(dto, calculo);
    const creada = await this.prisma.cotizacion.create({
      data: {
        ...datos,
        fecha: hoyEnColombia(),
        creadaPorId: usuarioId,
        historial: { create: { hacia: 'BORRADOR', nota: 'Creada', usuarioId } },
      },
      include: INCLUIR,
    });
    return this.aRespuesta(creada);
  }

  /** Recalcula y reemplaza una cotización que todavía es un borrador. */
  async actualizar(id: number, dto: GuardarCotizacionDto) {
    const actual = await this.buscar(id);
    if (!esEditable(actual.estado)) {
      throw new ConflictException(`Una cotización en estado ${actual.estado} no se puede editar`);
    }
    const calculo = await this.calculo.calcular(dto);
    const datos = await this.datosParaGuardar(dto, calculo);
    const actualizada = await this.prisma.$transaction(async (tx) => {
      await tx.cotizacionConcepto.deleteMany({ where: { cotizacionId: id } });
      await tx.cotizacionMargen.deleteMany({ where: { cotizacionId: id } });
      await tx.cotizacionCantidad.deleteMany({ where: { cotizacionId: id } });
      return tx.cotizacion.update({ where: { id }, data: datos, include: INCLUIR });
    });
    return this.aRespuesta(actualizada);
  }

  async listar(f: FiltroCotizacionesDto) {
    const pagina = f.pagina ?? 1;
    const porPagina = f.porPagina ?? 20;
    const where: Prisma.CotizacionWhereInput = {
      estado: f.estado,
      clienteId: f.clienteId,
      tipoProducto: f.tipoProducto ? { codigo: f.tipoProducto } : undefined,
      OR: f.buscar
        ? [
            { referencia: { contains: f.buscar, mode: 'insensitive' } },
            { descripcion: { contains: f.buscar, mode: 'insensitive' } },
            { cliente: { nombre: { contains: f.buscar, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const total = await this.prisma.cotizacion.count({ where });
    const items = await this.prisma.cotizacion.findMany({
      where,
      // Las importadas sin fecha van al final.
      orderBy: [{ fecha: { sort: 'desc', nulls: 'last' } }, { consecutivo: 'desc' }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: { cliente: true, tipoProducto: true, cantidades: { orderBy: { orden: 'asc' } } },
    });
    return {
      total,
      pagina,
      porPagina,
      items: items.map((c) => ({
        id: c.id,
        consecutivo: c.consecutivo,
        estado: c.estado,
        origen: c.origen,
        cliente: c.cliente?.nombre ?? null,
        tipoProducto: c.tipoProducto?.nombre ?? null,
        referencia: c.referencia,
        descripcion: c.descripcion,
        tintas: c.tintas,
        montaje: c.montaje,
        moMin: aNumero(c.moMin),
        cantidades: c.cantidades.map((q) => ({
          cantidad: q.cantidad,
          costoTotal: aNumero(q.costoTotal),
          precioUnitario: aNumero(q.precioUnitario),
        })),
        fecha: aTextoFecha(c.fecha),
        creadaEn: c.creadaEn,
      })),
    };
  }

  async obtener(id: number) {
    return this.aRespuesta(await this.buscar(id));
  }

  /** Registra qué opción de margen escogió la persona para cada cantidad y fija el precio para el cliente. */
  async elegirMargenes(id: number, dto: ElegirMargenesDto) {
    const c = await this.buscar(id);
    if (!esEditable(c.estado)) {
      throw new ConflictException(`Una cotización en estado ${c.estado} no se puede editar`);
    }
    const margenes: Margen[] = c.margenes.map((m) => ({
      valor: aNumero(m.valor),
      sobre: m.sobreOrden ?? 'COSTO',
    }));
    const cambios = dto.elecciones.map((e) => {
      const fila = c.cantidades.find((q) => q.orden === e.cantidadOrden);
      if (!fila) throw new BadRequestException(`No existe la cantidad con orden ${e.cantidadOrden}`);
      if (e.margenOrden === null) return { id: fila.id, margenElegidoOrden: null, precioUnitario: null };
      if (e.margenOrden >= margenes.length) {
        throw new BadRequestException(`No existe la opción de margen ${e.margenOrden}`);
      }
      const precio = calcularPrecios(aNumero(fila.costoTotal), fila.cantidad, margenes, c.redondeo)[e.margenOrden]!;
      return { id: fila.id, margenElegidoOrden: e.margenOrden, precioUnitario: precio.precioRedondeado };
    });
    await this.prisma.$transaction(async (tx) => {
      for (const { id: filaId, ...data } of cambios) {
        await tx.cotizacionCantidad.update({ where: { id: filaId }, data });
      }
    });
    return this.obtener(id);
  }

  async cambiarEstado(id: number, dto: CambiarEstadoDto, usuarioId: number) {
    const c = await this.buscar(id);
    if (!puedeCambiar(c.estado, dto.estado)) {
      const permitidos = transicionesPermitidas(c.estado);
      throw new ConflictException(
        `No se puede pasar de ${c.estado} a ${dto.estado}. Permitidos: ${permitidos.join(', ') || 'ninguno'}`,
      );
    }
    if (dto.estado === 'ENVIADA' && c.cantidades.some((q) => q.precioUnitario == null)) {
      throw new ConflictException('Antes de enviar, elige el margen de cada cantidad');
    }
    await this.prisma.cotizacion.update({
      where: { id },
      data: {
        estado: dto.estado,
        historial: { create: { desde: c.estado, hacia: dto.estado as EstadoCotizacion, nota: dto.nota, usuarioId } },
      },
    });
    return this.obtener(id);
  }

  async registrarTiempoReal(id: number, dto: TiempoRealDto) {
    const c = await this.buscar(id);
    if (!aceptaTiempoReal(c.estado)) {
      throw new ConflictException('El tiempo real se registra cuando la cotización está en producción o terminada');
    }
    await this.prisma.cotizacion.update({
      where: { id },
      data: { moMinReal: dto.moMinReal },
    });
    return this.obtener(id);
  }

  /**
   * Elimina la cotización y todo lo suyo (conceptos, cantidades, historial, imagen). No se puede deshacer.
   * `confirmacion` debe ser el número (consecutivo) de la cotización: es la segunda confirmación, también en la API.
   */
  async eliminar(id: number, confirmacion: number | undefined) {
    const c = await this.prisma.cotizacion.findUnique({ where: { id }, select: { consecutivo: true } });
    if (!c) throw new NotFoundException(`No existe la cotización ${id}`);
    if (confirmacion !== c.consecutivo) {
      throw new BadRequestException(`Para eliminarla, confirma con el número de la cotización (${c.consecutivo})`);
    }
    await this.prisma.cotizacion.delete({ where: { id } });
  }

  // ───────────────────────── auxiliares ─────────────────────────

  private async buscar(id: number): Promise<CotizacionCompleta> {
    const c = await this.prisma.cotizacion.findUnique({ where: { id }, include: INCLUIR });
    if (!c) throw new NotFoundException(`No existe la cotización ${id}`);
    return c;
  }

  private async datosParaGuardar(dto: GuardarCotizacionDto, calculo: CalculoCompleto) {
    const tipo = await this.prisma.tipoProducto.findUnique({ where: { codigo: dto.tipoProducto } });
    if (!tipo) throw new BadRequestException(`No existe el tipo de producto "${dto.tipoProducto}"`);

    let clienteId = dto.clienteId;
    if (!clienteId && dto.clienteNombre) {
      const existente = await this.prisma.cliente.findFirst({
        where: { nombre: { equals: dto.clienteNombre, mode: 'insensitive' } },
      });
      clienteId = existente?.id ?? (await this.prisma.cliente.create({ data: { nombre: dto.clienteNombre } })).id;
    }

    const espesor = dto.espesor
      ? await this.prisma.espesorMaterial.findUnique({ where: { nombre: dto.espesor } })
      : null;
    if (dto.espesor && !espesor) throw new BadRequestException(`No existe el espesor "${dto.espesor}"`);

    const { entrada, resultado, produccion, usados } = calculo;
    const porUnidad = entrada.conceptos.find((k) => k.codigo === 'troquelada')?.porUnidad ?? 0;
    // Los opcionales van como null (no undefined) para que al editar un borrador se borre lo que se dejó vacío.
    return {
      clienteId: clienteId ?? null,
      tipoProductoId: tipo.id,
      referencia: dto.referencia ?? null,
      descripcion: dto.descripcion ?? null,
      tipoCorte: dto.tipoCorte ?? null,
      anchoCm: dto.anchoCm ?? null,
      altoCm: dto.altoCm ?? null,
      tintas: dto.tintas,
      montaje: dto.producto.montaje,
      espesor: dto.espesor ?? null,
      gramosPorCm2: espesor?.gramosPorCm2 ?? null,
      troqueladasPorHora:
        dto.producto.troqueladasPorHora ??
        (porUnidad > 0 ? troqueladasPorHora({ valorMinuto: usados.valorMinuto, troqueladaPorUnidad: porUnidad }) : null),
      troqueladasPorHoraSugerida: dto.troqueladasPorHoraSugerida ?? null,
      moMin: dto.producto.moMin,
      moMinFuente: dto.moMinFuente ?? 'OPERARIA',
      moMinSugerido: dto.moMinSugerido ?? null,
      valorMinuto: usados.valorMinuto,
      horasPorDia: usados.horasPorDia,
      gramosPorClise: dto.producto.gramosPorClise,
      precioGramo: usados.precioGramo,
      cifBase: usados.cifBase,
      administracionPorcentaje: usados.administracionPorcentaje,
      administracionBase: usados.administracionBase,
      redondeo: usados.redondeo,
      entrada: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
      observaciones: dto.observaciones ?? null,
      conceptos: {
        create: entrada.conceptos.map((k, orden) => ({
          orden,
          seccion: SECCIONES[k.codigo] ?? 'ADICIONAL',
          codigo: k.codigo,
          nombre: k.nombre,
          porUnidad: k.porUnidad,
          fijo: k.fijo,
        })),
      },
      margenes: {
        create: entrada.margenes.map((m, orden) => ({
          orden,
          valor: m.valor,
          sobreOrden: m.sobre === 'COSTO' ? null : m.sobre,
        })),
      },
      cantidades: {
        create: resultado.filas.map((f, orden) => ({
          orden,
          cantidad: f.cantidad,
          cifPorcentaje: entrada.cif[orden]!.porcentaje,
          subtotal: f.subtotal,
          administracion: f.administracion,
          cif: f.cif,
          costoTotal: f.costoTotal,
          diasRequeridos: produccion[orden]!.diasRequeridos,
        })),
      },
    } satisfies Prisma.CotizacionUncheckedCreateInput;
  }

  lineasPorDefecto(c: Pick<CotizacionCompleta, 'descripcion' | 'tipoProducto' | 'anchoCm' | 'altoCm'>) {
    return lineasPorDefecto({
      descripcion: c.descripcion,
      tipoProducto: c.tipoProducto?.nombre ?? null,
      anchoCm: aNumero(c.anchoCm),
      altoCm: aNumero(c.altoCm),
    });
  }

  /** Respuesta con números normales y las opciones de precio recalculadas desde el costo guardado. */
  private aRespuesta(c: CotizacionCompleta) {
    const margenes: Margen[] = c.margenes.map((m) => ({ valor: aNumero(m.valor), sobre: m.sobreOrden ?? 'COSTO' }));
    return {
      id: c.id,
      consecutivo: c.consecutivo,
      estado: c.estado,
      transicionesPermitidas: transicionesPermitidas(c.estado),
      origen: c.origen,
      hojaExcel: c.hojaExcel,
      cliente: c.cliente,
      tipoProducto: c.tipoProducto,
      referencia: c.referencia,
      descripcion: c.descripcion,
      tipoCorte: c.tipoCorte,
      anchoCm: aNumero(c.anchoCm),
      altoCm: aNumero(c.altoCm),
      tintas: c.tintas,
      montaje: c.montaje,
      espesor: c.espesor,
      gramosPorCm2: aNumero(c.gramosPorCm2),
      troqueladasPorHora: aNumero(c.troqueladasPorHora),
      troqueladasPorHoraSugerida: aNumero(c.troqueladasPorHoraSugerida),
      moMin: aNumero(c.moMin),
      moMinFuente: c.moMinFuente,
      moMinSugerido: aNumero(c.moMinSugerido),
      moMinReal: aNumero(c.moMinReal),
      parametros: {
        valorMinuto: aNumero(c.valorMinuto),
        horasPorDia: aNumero(c.horasPorDia),
        gramosPorClise: aNumero(c.gramosPorClise),
        precioGramo: aNumero(c.precioGramo),
        cifBase: c.cifBase,
        administracionPorcentaje: aNumero(c.administracionPorcentaje),
        administracionBase: c.administracionBase,
        redondeo: c.redondeo,
      },
      conceptos: c.conceptos.map((k) => ({
        seccion: k.seccion,
        codigo: k.codigo,
        nombre: k.nombre,
        porUnidad: aNumero(k.porUnidad),
        fijo: aNumero(k.fijo),
      })),
      margenes: margenes.map((m) => ({ valor: m.valor, sobre: m.sobre })),
      cantidades: c.cantidades.map((q) => {
        const costoTotal = aNumero(q.costoTotal);
        return {
          orden: q.orden,
          cantidad: q.cantidad,
          cifPorcentaje: aNumero(q.cifPorcentaje),
          subtotal: aNumero(q.subtotal),
          administracion: aNumero(q.administracion),
          cif: aNumero(q.cif),
          costoTotal,
          diasRequeridos: aNumero(q.diasRequeridos),
          opciones: margenes.length ? calcularPrecios(costoTotal, q.cantidad, margenes, c.redondeo) : [],
          margenElegidoOrden: q.margenElegidoOrden,
          precioUnitario: aNumero(q.precioUnitario),
        };
      }),
      entrada: c.entrada,
      observaciones: c.observaciones,
      imagen: c.imagen,
      textoCliente: c.textoCliente,
      /** Líneas que lleva el PDF: las guardadas o, si no hay, las que salen de la descripción y el tamaño. */
      lineasCliente: c.textoCliente !== null ? lineasDeTexto(c.textoCliente) : this.lineasPorDefecto(c),
      historial: c.historial.map(({ usuario, ...h }) => ({ ...h, usuario: usuario?.nombre ?? null })),
      creadaPor: c.creadaPor,
      fecha: aTextoFecha(c.fecha),
      creadaEn: c.creadaEn,
      actualizadaEn: c.actualizadaEn,
    };
  }
}
