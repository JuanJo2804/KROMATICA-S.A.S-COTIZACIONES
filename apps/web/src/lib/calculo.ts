/**
 * Cálculo en vivo en el navegador con `@kromatica/motor-calculo`.
 *
 * Completa la solicitud con los parámetros vigentes y la política de precios igual que
 * `CalculoService` de la API (apps/api/src/cotizaciones/calculo.service.ts). Al guardar, la API vuelve
 * a calcular: lo que queda registrado es siempre el cálculo del servidor.
 */
import {
  calcularCotizacion,
  construirConceptos,
  diasRequeridos,
  ErrorValidacion,
  porcentajesPorFila,
  unidadesPorDia,
  type EntradaCotizacion,
  type Margen,
  type ResultadoCotizacion,
} from "@kromatica/motor-calculo";
import type { GuardarCotizacion, Parametros, PoliticaPrecios } from "./api";

export interface CalculoEnVivo {
  entrada: EntradaCotizacion;
  resultado: ResultadoCotizacion;
  produccion: { cantidad: number; unidadesPorDia: number; diasRequeridos: number }[];
}

export type Calculo = { ok: true; valor: CalculoEnVivo } | { ok: false; error: string };

type DatosCalculo = Pick<
  GuardarCotizacion,
  "producto" | "cantidades" | "cif" | "administracion" | "margenes" | "horasPorDia"
>;

export function calcularEnVivo(dto: DatosCalculo, parametros: Parametros, politica: PoliticaPrecios): Calculo {
  try {
    const p = dto.producto;
    const valorMinuto = p.valorMinuto ?? parametros.VALOR_MINUTO.valor;
    const precioGramo = p.precioGramo ?? parametros.PRECIO_GRAMO.valor;
    const horasPorDia = dto.horasPorDia ?? parametros.HORAS_POR_DIA.valor;
    const clise = p.clise && {
      ...p.clise,
      precioCm2: p.clise.precioCm2 ?? parametros.PRECIO_CM2_CLISE.valor,
    };

    const conceptos = construirConceptos({ ...p, valorMinuto, precioGramo, clise });
    const n = dto.cantidades.length;
    const margenes: Margen[] = dto.margenes
      ? dto.margenes.map((m) => ({ valor: m.valor, sobre: m.sobre ?? "COSTO" }))
      : politica.margenesSugeridos.map((valor) => ({ valor, sobre: "COSTO" as const }));

    const entrada: EntradaCotizacion = {
      cantidades: dto.cantidades,
      conceptos,
      cif: porcentajesPorFila(dto.cif?.porcentajes ?? politica.cifPorcentajes, dto.cif?.base ?? politica.cifBase, n),
      administracion: porcentajesPorFila(
        dto.administracion?.porcentajes ?? [politica.administracionPorcentaje],
        dto.administracion?.base ?? politica.administracionBase,
        n,
      ),
      margenes,
      redondeo: politica.redondeo,
    };

    return {
      ok: true,
      valor: {
        entrada,
        resultado: calcularCotizacion(entrada),
        produccion: dto.cantidades.map((cantidad) => ({
          cantidad,
          unidadesPorDia: unidadesPorDia({ moMin: p.moMin, montaje: p.montaje, horasPorDia }),
          diasRequeridos: diasRequeridos({ cantidad, moMin: p.moMin, montaje: p.montaje, horasPorDia }),
        })),
      },
    };
  } catch (error) {
    if (error instanceof ErrorValidacion) return { ok: false, error: error.message };
    throw error;
  }
}
