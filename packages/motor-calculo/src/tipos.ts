/**
 * Tipos del motor de cálculo.
 *
 * El motor es una librería pura: no conoce la base de datos ni HTTP.
 * Recibe números y devuelve números, por eso se puede probar contra
 * las hojas del Excel histórico.
 */

/** Sobre qué fila de cantidad se calcula un porcentaje (CIF o administración). */
export type BaseCalculo = 'PRIMERA_FILA' | 'PROPIA_FILA';

/**
 * Un concepto de costo de la cotización (troquel, clisé, material, armada…).
 *
 * Su costo por unidad para una cantidad `q` es:  porUnidad + fijo / q
 *  - `porUnidad`: lo que cuesta cada unidad (material, mano de obra, empaque).
 *  - `fijo`: un costo único que se reparte entre todas las unidades (troquel, clisé).
 */
export interface ConceptoCosto {
  codigo: string;
  nombre: string;
  porUnidad: number;
  fijo: number;
}

/** Porcentaje aplicado a una fila de cantidad, calculado sobre el subtotal de `filaBase`. */
export interface PorcentajeFila {
  porcentaje: number;
  /** Índice (desde 0) de la fila de cantidad cuyo subtotal se usa como base. */
  filaBase: number;
}

/**
 * Margen de ganancia. Precio = base / (1 - valor).
 *  - `sobre: 'COSTO'`  → la base es el costo total (caso normal).
 *  - `sobre: n`        → la base es el precio calculado con el margen n (ej. precio para intermediarios).
 */
export interface Margen {
  valor: number;
  sobre: 'COSTO' | number;
}

export interface EntradaCotizacion {
  /** Cantidades a cotizar, ej. [300, 500, 1000]. */
  cantidades: number[];
  conceptos: ConceptoCosto[];
  /** Un porcentaje de CIF por cada cantidad. */
  cif: PorcentajeFila[];
  /** Un porcentaje de administración por cada cantidad. */
  administracion: PorcentajeFila[];
  /** Opciones de margen que se le muestran a la persona para que escoja. */
  margenes: Margen[];
  /** Múltiplo al que se redondea el precio para el cliente. Por defecto 10 (ej. 1.488,7 → 1.490). */
  redondeo?: number;
}

export interface ConceptoCalculado {
  codigo: string;
  nombre: string;
  costoUnitario: number;
}

export interface PrecioCalculado {
  /** Margen aplicado, ej. 0.3 */
  margen: number;
  sobre: 'COSTO' | number;
  /** Precio unitario exacto (sin redondear). */
  precioUnitario: number;
  /** Precio unitario redondeado que se le envía al cliente (sin IVA). */
  precioRedondeado: number;
  /** Ganancia por unidad con el precio redondeado. */
  gananciaUnitaria: number;
  /** Ganancia del pedido completo con el precio redondeado. */
  gananciaTotal: number;
}

export interface FilaCotizacion {
  cantidad: number;
  conceptos: ConceptoCalculado[];
  /** Suma de los conceptos por unidad (equivale a SUM(B:J) del Excel). */
  subtotal: number;
  administracion: number;
  cif: number;
  /** Costo real por unidad = subtotal + administración + CIF. */
  costoTotal: number;
  precios: PrecioCalculado[];
}

export interface ResultadoCotizacion {
  filas: FilaCotizacion[];
}
