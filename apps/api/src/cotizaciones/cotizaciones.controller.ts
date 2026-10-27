import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { CalculoService } from './calculo.service.js';
import { CotizacionesService } from './cotizaciones.service.js';
import { SoloAdmin, UsuarioActual, type UsuarioSesion } from '../auth/decoradores.js';
import { DocumentoClienteService } from './documento-cliente.service.js';
import { MAX_BYTES_IMAGEN } from './pdf-cliente.js';
import {
  CalcularCotizacionDto,
  CambiarEstadoDto,
  ElegirMargenesDto,
  FiltroCotizacionesDto,
  GuardarCotizacionDto,
  TextoClienteDto,
  TiempoRealDto,
} from './dto/cotizacion.dto.js';

@ApiTags('cotizaciones')
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(
    private readonly cotizaciones: CotizacionesService,
    private readonly calculo: CalculoService,
    private readonly documento: DocumentoClienteService,
  ) {}

  @Post('calcular')
  @HttpCode(200)
  @ApiOperation({ summary: 'Calcula costos y opciones de precio sin guardar (vista previa)' })
  calcular(@Body() dto: CalcularCotizacionDto) {
    return this.calculo.calcular(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una cotización en estado BORRADOR' })
  crear(@Body() dto: GuardarCotizacionDto, @UsuarioActual() usuario: UsuarioSesion) {
    return this.cotizaciones.crear(dto, usuario.id);
  }

  @Get()
  listar(@Query() filtro: FiltroCotizacionesDto) {
    return this.cotizaciones.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.cotizaciones.obtener(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Recalcula una cotización en BORRADOR con datos nuevos' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardarCotizacionDto) {
    return this.cotizaciones.actualizar(id, dto);
  }

  @Patch(':id/margenes')
  @ApiOperation({ summary: 'Registra el margen elegido por la persona para cada cantidad' })
  elegirMargenes(@Param('id', ParseIntPipe) id: number, @Body() dto: ElegirMargenesDto) {
    return this.cotizaciones.elegirMargenes(id, dto);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambia el estado (enviada, aprobada, en pruebas, en producción…)' })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDto,
    @UsuarioActual() usuario: UsuarioSesion,
  ) {
    return this.cotizaciones.cambiarEstado(id, dto, usuario.id);
  }

  @Delete(':id')
  @SoloAdmin()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Elimina la cotización (solo administradores). ?confirmar=<número de la cotización>; no se puede deshacer',
  })
  async eliminar(@Param('id', ParseIntPipe) id: number, @Query('confirmar') confirmar?: string) {
    await this.cotizaciones.eliminar(id, confirmar === undefined ? undefined : Number(confirmar));
  }

  @Patch(':id/tiempo-real')
  @ApiOperation({ summary: 'Registra el tiempo real de producción (alimenta el modelo)' })
  tiempoReal(@Param('id', ParseIntPipe) id: number, @Body() dto: TiempoRealDto) {
    return this.cotizaciones.registrarTiempoReal(id, dto);
  }

  // ───────────── Documento para el cliente ─────────────

  @Get(':id/pdf')
  @ApiOperation({ summary: 'PDF para el cliente: imagen, líneas de texto y precios elegidos' })
  @ApiProduces('application/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number) {
    const { archivo, nombre } = await this.documento.pdf(id);
    return new StreamableFile(archivo, { type: 'application/pdf', disposition: `inline; filename="${nombre}"` });
  }

  @Put(':id/imagen')
  @ApiOperation({ summary: 'Sube o reemplaza la imagen del producto (JPG o PNG, hasta 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { imagen: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('imagen', { limits: { fileSize: MAX_BYTES_IMAGEN } }))
  subirImagen(@Param('id', ParseIntPipe) id: number, @UploadedFile() archivo?: { buffer: Buffer; originalname: string }) {
    return this.documento.subirImagen(id, archivo);
  }

  @Get(':id/imagen')
  async imagen(@Param('id', ParseIntPipe) id: number) {
    const { tipo, datos } = await this.documento.imagen(id);
    return new StreamableFile(datos, { type: tipo });
  }

  @Delete(':id/imagen')
  borrarImagen(@Param('id', ParseIntPipe) id: number) {
    return this.documento.borrarImagen(id);
  }

  @Patch(':id/texto-cliente')
  @ApiOperation({ summary: 'Guarda las líneas de texto del PDF (null vuelve a las de por defecto)' })
  textoCliente(@Param('id', ParseIntPipe) id: number, @Body() dto: TextoClienteDto) {
    return this.documento.guardarTexto(id, dto.texto);
  }
}
