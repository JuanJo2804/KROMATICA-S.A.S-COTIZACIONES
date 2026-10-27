import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SesionGuard } from './sesion.guard.js';
import { UsuariosController, UsuariosService } from './usuarios.controller.js';

@Global()
@Module({
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, UsuariosService, { provide: APP_GUARD, useClass: SesionGuard }],
  exports: [AuthService],
})
export class AuthModule {}
