import { Module } from '@nestjs/common';
import { ParametrosController } from './parametros.controller.js';
import { ParametrosService } from './parametros.service.js';

@Module({
  controllers: [ParametrosController],
  providers: [ParametrosService],
  exports: [ParametrosService],
})
export class ParametrosModule {}
