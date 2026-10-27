/**
 * Fórmulas de los insumos de una cotización, tal como están en la plantilla de Excel,
 * y el armado de la lista de conceptos a partir de los datos del producto.
 */
import { exigirNoNegativo, exigirPositivo } from './errores.js';
import type { ConceptoCosto } from './tipos.js';

/** Mano de obra rubber por unidad = valor minuto × MO min / montaje   (Excel: =(O8*K11)/B14) */
export function manoDeObraPorUnidad(p: { valorMinuto: number; moMin: number; montaje: number }): number {
  exigirNoNegativo(p.valorMinuto, 'valorMinuto');
  exigirPositivo(p.moMin, 'moMin');
  exigirPositivo(p.montaje, 'montaje');
  return (p.valorMinuto * p.moMin) / p.montaje;
}

/** Material por unidad = gramos por clisé × $/gramo / montaje   (Excel: =(O10*H12)/B14) */
export function materialPorUnidad(p: { gramosPorClise: number; precioGramo: number; montaje: number }): number {
  exigirNoNegativo(p.gramosPorClise, 'gramosPorClise');
  exigirNoNegativo(p.precioGramo, 'precioGramo');
  exigirPositivo(p.montaje, 'montaje');
  return (p.gramosPorClise * p.precioGramo) / p.montaje;
}

/** Costo total (fijo) de los clisés = cm² × cantidad de clisés × $/cm²   (Excel: =B25*B30*C27) */
export function costoClise(p: { cm2: number; cantidadClises: number; precioCm2: number }): number {
  exigirNoNegativo(p.cm2, 'cm2');
  exigirNoNegativo(p.cantidadClises, 'cantidadClises');
  exigirNoNegativo(p.precioCm2, 'precioCm2');
  return p.cm2 * p.cantidadClises * p.precioCm2;
}

/**
 * Troquelada por unidad a partir de las unidades que se troquelan en una hora.
 * En el Excel la operaria da las troqueladas por hora y se ajusta el $ por unidad hasta llegar a ese valor
 * (troq/hora = 60 × valor minuto / $ unidad, celda G42); aquí se despeja directamente.
 */
export function troqueladaPorUnidad(p: { valorMinuto: number; troqueladasPorHora: number }): number {
  exigirNoNegativo(p.valorMinuto, 'valorMinuto');
  exigirPositivo(p.troqueladasPorHora, 'troqueladasPorHora');
  return (60 * p.valorMinuto) / p.troqueladasPorHora;
}

/** Troqueladas por hora = 60 × valor minuto / $ por unidad   (Excel: =+(60*O8)/D41) */
export function troqueladasPorHora(p: { valorMinuto: number; troqueladaPorUnidad: number }): number {
  exigirPositivo(p.valorMinuto, 'valorMinuto');
  exigirPositivo(p.troqueladaPorUnidad, 'troqueladaPorUnidad');
  return (60 * p.valorMinuto) / p.troqueladaPorUnidad;
}

/** Ítem con valor por unidad (argolla, remache, bolsa individual…). */
export interface ItemPorUnidad {
  nombre: string;
  valor: number;
}

/** Concepto adicional poco frecuente (samblasted, flete, tampografía…). */
export interface ConceptoAdicional {
  codigo: string;
  nombre: string;
  porUnidad?: number;
  fijo?: number;
}

/** Datos de un producto, organizados como las secciones de la plantilla de Excel. */
export interface DatosProducto {
  /** Minutos por plancha (dato de la operaria o sugerido por el modelo). */
  moMin: number;
  /** Unidades por plancha. */
  montaje: number;
  /** Valor del minuto de mano de obra vigente. */
  valorMinuto: number;
  gramosPorClise: number;
  precioGramo: number;
  /** 1. Costo del troquel (fijo, se reparte entre las unidades). */
  troquel?: number;
  /** 1. Troqueles por tipo (hierro, madera, eléctrico): fijos, se suman a `troquel`. */
  troqueles?: ItemPorUnidad[];
  /** 2. Clisé (fijo). */
  clise?: { cm2: number; cantidadClises: number; precioCm2: number };
  /** 5. Troquelada: valor por unidad (bisturí, guillotina, madera). Tiene prioridad sobre `troqueladasPorHora`. */
  troqueladaPorUnidad?: number;
  /** 5. Troquelada: unidades por hora (dato de la operaria o sugerido); se convierte a $ por unidad. */
  troqueladasPorHora?: number;
  /** 6. Materiales adicionales por unidad, además del rubber. */
  materialesAdicionales?: ItemPorUnidad[];
  /** 7. Armada: cordón, argolla, remache… */
  armada?: ItemPorUnidad[];
  /** 8. Empaque: bolsa, contada, empaque final… */
  empaque?: ItemPorUnidad[];
  /** 9. Otros por unidad, además de la mano de obra: diseño, perforada… */
  otros?: ItemPorUnidad[];
  adicionales?: ConceptoAdicional[];
}

const sumar = (items: ItemPorUnidad[] | undefined, campo: string): number =>
  (items ?? []).reduce((total, item, i) => {
    exigirNoNegativo(item.valor, `${campo}[${i}].valor`);
    return total + item.valor;
  }, 0);

/** Convierte los datos del producto en la lista de conceptos que usa `calcularCotizacion`. */
export function construirConceptos(d: DatosProducto): ConceptoCosto[] {
  const conceptos: ConceptoCosto[] = [];
  const agregar = (codigo: string, nombre: string, porUnidad: number, fijo: number) => {
    if (porUnidad !== 0 || fijo !== 0) conceptos.push({ codigo, nombre, porUnidad, fijo });
  };

  agregar('troquel', 'Troquel', 0, (d.troquel ?? 0) + sumar(d.troqueles, 'troqueles'));
  agregar('clise', 'Clisé', 0, d.clise ? costoClise(d.clise) : 0);
  const troquelada =
    d.troqueladaPorUnidad ??
    (d.troqueladasPorHora ? troqueladaPorUnidad({ valorMinuto: d.valorMinuto, troqueladasPorHora: d.troqueladasPorHora }) : 0);
  agregar('troquelada', 'Troquelada', troquelada, 0);
  agregar('armada', 'Armada', sumar(d.armada, 'armada'), 0);
  agregar(
    'material',
    'Material',
    materialPorUnidad(d) + sumar(d.materialesAdicionales, 'materialesAdicionales'),
    0,
  );
  agregar('otros', 'Otros (mano de obra)', manoDeObraPorUnidad(d) + sumar(d.otros, 'otros'), 0);
  agregar('empaque', 'Empaque', sumar(d.empaque, 'empaque'), 0);
  for (const a of d.adicionales ?? []) {
    agregar(a.codigo, a.nombre, a.porUnidad ?? 0, a.fijo ?? 0);
  }
  return conceptos;
}
