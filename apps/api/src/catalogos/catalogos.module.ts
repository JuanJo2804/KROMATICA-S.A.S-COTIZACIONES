import { Module } from '@nestjs/common';
import { CatalogosController } from './catalogos.controller.js';

@Module({ controllers: [CatalogosController] })
export class CatalogosModule {}
