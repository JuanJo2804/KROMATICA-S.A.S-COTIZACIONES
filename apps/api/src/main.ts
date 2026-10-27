import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { FiltroErrorValidacion } from './comun/filtro-errores.js';

/** Configuración compartida entre la app real y las pruebas e2e. */
export function configurarApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new FiltroErrorValidacion());
  return app;
}

async function bootstrap() {
  const app = configurarApp(await NestFactory.create(AppModule));
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Kromatica · Cotizaciones')
      .setDescription('API para calcular, guardar y gestionar cotizaciones')
      .setVersion('0.1.0')
      .addCookieAuth('kromatica_sesion')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento);
  await app.listen(process.env.PORT ?? 4000);
}

if (process.env.NODE_ENV !== 'test') {
  await bootstrap();
}
