import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { aNumero } from '../comun/numeros.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CotizacionesService } from './cotizaciones.service.js';
import { generarPdf, imagenValida, lineasDeTexto, MAX_BYTES_IMAGEN, tipoDeImagen } from './pdf-cliente.js';

/** Lo que recibe el cliente: la imagen del producto, el texto y el PDF. */
@Injectable()
export class DocumentoClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  /** Guarda (o reemplaza) la imagen del producto. Solo JPEG o PNG, hasta 5 MB. */
  async subirImagen(id: number, archivo: { buffer: Buffer; originalname?: string } | undefined) {
    await this.existe(id);
    if (!archivo?.buffer?.length) throw new UnprocessableEntityException('Falta el archivo de la imagen (campo "imagen")');
    if (archivo.buffer.length > MAX_BYTES_IMAGEN) {
      throw new UnprocessableEntityException('La imagen pesa más de 5 MB');
    }
    const tipo = tipoDeImagen(archivo.buffer);
    if (!tipo) throw new UnprocessableEntityException('La imagen debe ser JPG o PNG');
    if (!imagenValida(archivo.buffer)) throw new UnprocessableEntityException('El archivo de la imagen está dañado');

    const datos = { tipo, nombre: archivo.originalname ?? null, datos: new Uint8Array(archivo.buffer), subidaEn: new Date() };
    await this.prisma.imagenCotizacion.upsert({
      where: { cotizacionId: id },
      create: { cotizacionId: id, ...datos },
      update: datos,
    });
    return this.cotizaciones.obtener(id);
  }

  async imagen(id: number) {
    const imagen = await this.prisma.imagenCotizacion.findUnique({ where: { cotizacionId: id } });
    if (!imagen) throw new NotFoundException(`La cotización ${id} no tiene imagen`);
    return { tipo: imagen.tipo, datos: Buffer.from(imagen.datos) };
  }

  async borrarImagen(id: number) {
    await this.existe(id);
    await this.prisma.imagenCotizacion.deleteMany({ where: { cotizacionId: id } });
    return this.cotizaciones.obtener(id);
  }

  /** Guarda las líneas del PDF; texto vacío o null vuelve a las líneas por defecto. */
  async guardarTexto(id: number, texto: string | null) {
    await this.existe(id);
    const limpio = texto?.trim() ? texto.trim() : null;
    await this.prisma.cotizacion.update({ where: { id }, data: { textoCliente: limpio } });
    return this.cotizaciones.obtener(id);
  }

  async pdf(id: number) {
    const c = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { cliente: true, tipoProducto: true, imagen: true, cantidades: { orderBy: { orden: 'asc' } } },
    });
    if (!c) throw new NotFoundException(`No existe la cotización ${id}`);
    const filas = c.cantidades
      .filter((q) => q.precioUnitario !== null)
      .map((q) => ({ cantidad: q.cantidad, precioUnitario: aNumero(q.precioUnitario)! }));
    if (filas.length === 0) {
      throw new ConflictException('Para generar el PDF, elige el precio de al menos una cantidad');
    }
    const lineas = c.textoCliente !== null ? lineasDeTexto(c.textoCliente) : this.cotizaciones.lineasPorDefecto(c);
    const archivo = await generarPdf({
      titulo: `Cotización ${c.consecutivo}${c.cliente ? ` · ${c.cliente.nombre}` : ''}`,
      lineas,
      filas,
      imagen: c.imagen ? Buffer.from(c.imagen.datos) : null,
    });
    return { archivo, nombre: nombreArchivo(c.consecutivo, c.cliente?.nombre ?? null) };
  }

  private async existe(id: number) {
    const c = await this.prisma.cotizacion.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException(`No existe la cotización ${id}`);
  }
}

/** "Cotizacion-855-cliente-de-prueba.pdf": sin tildes ni espacios para que funcione en cualquier sistema. */
export function nombreArchivo(consecutivo: number, cliente: string | null) {
  const slug = (cliente ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);
  return `Cotizacion-${consecutivo}${slug ? `-${slug}` : ''}.pdf`;
}
