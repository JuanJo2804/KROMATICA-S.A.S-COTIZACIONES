import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ErrorValidacion } from '@kromatica/motor-calculo';
import type { Response } from 'express';

/** Convierte los errores de validación del motor de cálculo en respuestas 400. */
@Catch(ErrorValidacion)
export class FiltroErrorValidacion implements ExceptionFilter {
  catch(error: ErrorValidacion, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({ statusCode: HttpStatus.BAD_REQUEST, error: 'Datos inválidos', message: error.message, campo: error.campo });
  }
}
