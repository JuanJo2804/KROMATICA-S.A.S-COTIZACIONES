import { Module } from '@nestjs/common';
import { ParametrosModule } from '../parametros/parametros.module.js';
import { CalculoService } from './calculo.service.js';
import { CotizacionesController } from './cotizaciones.controller.js';
import { CotizacionesService } from './cotizaciones.service.js';
import { DocumentoClienteService } from './documento-cliente.service.js';

@Module({
  imports: [ParametrosModule],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, CalculoService, DocumentoClienteService],
})
export class CotizacionesModule {}
