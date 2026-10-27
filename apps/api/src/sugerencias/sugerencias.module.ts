import { Module } from '@nestjs/common';
import { SugerenciasController } from './sugerencias.controller.js';

@Module({ controllers: [SugerenciasController] })
export class SugerenciasModule {}
