import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { AuthModule } from './auth/auth.module.js';
import { Publica } from './auth/decoradores.js';
import { CatalogosModule } from './catalogos/catalogos.module.js';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module.js';
import { ParametrosModule } from './parametros/parametros.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { SugerenciasModule } from './sugerencias/sugerencias.module.js';

@ApiTags('salud')
@Publica()
@Controller('salud')
class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async salud() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { estado: 'ok', baseDeDatos: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ParametrosModule,
    CatalogosModule,
    CotizacionesModule,
    SugerenciasModule,
  ],
  controllers: [SaludController],
})
export class AppModule {}
