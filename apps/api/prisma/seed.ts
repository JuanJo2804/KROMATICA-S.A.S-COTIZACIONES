/**
 * Carga inicial de datos:
 *  - Catálogos (tipos de producto, conceptos con su valor sugerido, espesores)
 *  - Parámetros con fecha de vigencia (valor del minuto, horas por día, $/cm² clisé, $/gramo)
 *  - Política de precios por defecto
 *  - Cotizaciones históricas del Excel (datos-privados/historial-excel.json, si existe: es un repositorio privado
 *    aparte porque tiene clientes y precios reales; sin él no hay historial y las sugerencias no tienen con qué comparar)
 *
 * Es idempotente: se puede correr varias veces sin duplicar datos.
 * Uso: pnpm prisma db seed
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type SeccionConcepto } from '../src/generated/prisma/client.js';
import { cifrarClave, LARGO_MINIMO_CLAVE } from '../src/auth/claves.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const TIPOS_PRODUCTO: [string, string][] = [
  ['llavero', 'Llavero'], ['marquilla', 'Marquilla'], ['aplique', 'Aplique'], ['manilla', 'Manilla'],
  ['portavaso', 'Portavaso'], ['haladera', 'Haladera'], ['pin', 'Pin'], ['dige', 'Dige'],
  ['puntera', 'Puntera'], ['bandera', 'Bandera'], ['correa', 'Correa'], ['sello', 'Sello'],
];

// Renglones de la plantilla del Excel, en su orden, más los que se escribieron a mano en muchas hojas.
// Valor sugerido: el más frecuente en las cotizaciones de 2026. Se quitan del formulario con `activo = false`.
const CONCEPTOS: [string, string, SeccionConcepto, 'POR_UNIDAD' | 'FIJO', number | null][] = [
  // 1. Troqueles (fijos; se suman en el costo del troquel)
  ['troquel_hierro', 'Hierro', 'TROQUEL', 'FIJO', null],
  ['troquel_madera', 'Madera', 'TROQUEL', 'FIJO', null],
  ['troquel_electrico', 'Eléctrico', 'TROQUEL', 'FIJO', null],
  // 2. Clisé (además del área × $/cm²)
  ['pantografo', 'Pantógrafo', 'CLISE', 'FIJO', null],
  // 6. Material (además del rubber)
  ['puya', 'Puya', 'MATERIAL', 'POR_UNIDAD', 310],
  ['aro_pegada', 'Aro + pegada', 'MATERIAL', 'POR_UNIDAD', 350],
  ['impresion', 'Impresión', 'MATERIAL', 'POR_UNIDAD', 35],
  // 7. Armada
  ['cordon', 'Cordón', 'ARMADA', 'POR_UNIDAD', 30],
  ['argolla', 'Argolla', 'ARMADA', 'POR_UNIDAD', 60],
  ['puesta_argolla', 'Armada + puesta argolla', 'ARMADA', 'POR_UNIDAD', 50],
  ['orring', 'O-ring', 'ARMADA', 'POR_UNIDAD', 170],
  ['remache', 'Remache', 'ARMADA', 'POR_UNIDAD', 30],
  ['puntera_pvc', 'Puntera PVC', 'ARMADA', 'POR_UNIDAD', 60],
  ['argolla_cadenilla', 'Argolla + cadenilla', 'ARMADA', 'POR_UNIDAD', 120],
  ['argolla_cadena', 'Argolla + cadena', 'ARMADA', 'POR_UNIDAD', 120],
  ['broches', 'Puesta de broche', 'ARMADA', 'POR_UNIDAD', 31],
  // 8. Empaque
  ['bolsa_individual', 'Bolsa individual', 'EMPAQUE', 'POR_UNIDAD', 40],
  ['sellada', 'Sellada', 'EMPAQUE', 'POR_UNIDAD', 3],
  ['contada', 'Contada', 'EMPAQUE', 'POR_UNIDAD', 2],
  ['empaque_final', 'Empaque final', 'EMPAQUE', 'POR_UNIDAD', 2],
  ['llenada_gel', 'Llenada gel', 'EMPAQUE', 'POR_UNIDAD', null],
  ['pin_soporte', 'Pin soporte', 'EMPAQUE', 'POR_UNIDAD', 50],
  ['pegada', 'Pegada', 'EMPAQUE', 'POR_UNIDAD', 25],
  ['remachada', 'Remachada', 'EMPAQUE', 'POR_UNIDAD', 2],
  ['limpieza', 'Limpieza', 'EMPAQUE', 'POR_UNIDAD', 4],
  // 9. Otros materiales (se suman a la mano de obra rubber)
  ['diseno', 'Diseño', 'OTROS', 'POR_UNIDAD', 5],
  ['perforada', 'Perforada', 'OTROS', 'POR_UNIDAD', 7],
  ['guillotina', 'Guillotina', 'OTROS', 'POR_UNIDAD', null],
  ['pulida', 'Pulida', 'OTROS', 'POR_UNIDAD', 30],
  ['corte_tpu', 'Corte TPU', 'OTROS', 'POR_UNIDAD', 90],
  // Adicionales (3. Screen, 4. Alta frecuencia y columnas E/F de la tabla de costos)
  ['screen', 'Screen', 'ADICIONAL', 'FIJO', 200000],
  ['alta_frecuencia', 'Alta frecuencia', 'ADICIONAL', 'FIJO', 15000],
  ['samblasted', 'Samblasted', 'ADICIONAL', 'FIJO', 15000],
  ['mate', 'Mate / matizado', 'ADICIONAL', 'FIJO', 15000],
  ['tpu', 'TPU', 'ADICIONAL', 'POR_UNIDAD', null],
  ['flete', 'Flete', 'ADICIONAL', 'FIJO', null],
];

// "TABLA DE GRAMOS POR CM²" del Excel, en su orden: nombre, gramos de la muestra, cm² de la muestra.
const ESPESORES: [string, number, number][] = [
  ['0,8 mm', 30, 373], ['1 mm', 40, 375], ['1,2 mm', 45, 373], ['1,5 mm', 75, 387], ['5 mm', 253, 532],
  ['Team', 450, 480], ['Look', 330, 442], ['Manilla', 75, 530], ['3 mm', 90, 333], ['Pin', 75, 217],
  ['Doble cara', 285, 356], ['Dige celular', 43, 221], ['Portavasos', 105, 361], ['Llavero 1 cm', 210, 174],
];

const PARAMETROS: ['VALOR_MINUTO' | 'HORAS_POR_DIA' | 'PRECIO_CM2_CLISE' | 'PRECIO_GRAMO', number, string, string | null][] = [
  ['VALOR_MINUTO', 378, '2025-01-01', 'Valor usado en el Excel en el primer semestre de 2025'],
  ['VALOR_MINUTO', 381, '2025-07-01', 'Valor usado en el Excel en el segundo semestre de 2025'],
  ['VALOR_MINUTO', 435, '2026-01-01', 'Valor usado en el Excel en 2026'],
  ['VALOR_MINUTO', 440, '2026-09-01', null],
  ['VALOR_MINUTO', 450, '2026-10-01', null],
  ['HORAS_POR_DIA', 10, '2015-01-01', 'El Excel usa 10 h para los días requeridos.'],
  ['HORAS_POR_DIA', 8.5, '2026-10-26', 'Jornada real confirmada por Kromatica.'],
  ['PRECIO_CM2_CLISE', 500, '2025-01-01', null],
  ['PRECIO_GRAMO', 30, '2025-01-01', null],
];

interface Historico {
  hoja: string;
  fecha: string | null;
  cliente: string | null;
  referencia: string | null;
  tipoProducto: string | null;
  anchoCm: number | null;
  altoCm: number | null;
  tintas: number | null;
  montaje: number;
  moMin: number;
  valorMinuto: number;
  gramosPorClise: number;
  precioGramo: number;
  /** Estimado como gramos por clisé ÷ cm² del clisé. */
  gramosPorCm2: number | null;
  /** Inferido: TROQUELADO si la hoja tiene costo de troquel. */
  tipoCorte: 'BISTURI' | 'TROQUELADO';
  troqueladasPorHora: number | null;
  calculo: null | {
    conceptos: { seccion: SeccionConcepto; codigo: string; nombre: string; porUnidad: number; fijo: number }[];
    margenes: { valor: number; sobre: 'COSTO' | number }[];
    administracion: { porcentaje: number; filaBase: number }[];
    cantidades: {
      cantidad: number;
      cifPorcentaje: number;
      subtotal: number;
      administracion: number;
      cif: number;
      costoTotal: number;
    }[];
  };
}

async function catalogos() {
  for (const [codigo, nombre] of TIPOS_PRODUCTO) {
    await prisma.tipoProducto.upsert({ where: { codigo }, update: {}, create: { codigo, nombre } });
  }
  // El nombre y el valor sugerido no se pisan si ya existen (se pueden haber cambiado); el orden sí.
  for (const [orden, [codigo, nombre, seccion, tipoCosto, valorSugerido]] of CONCEPTOS.entries()) {
    await prisma.conceptoCatalogo.upsert({
      where: { codigo },
      update: { orden, seccion },
      create: { codigo, nombre, seccion, tipoCosto, valorSugerido, orden },
    });
  }
  for (const [orden, [nombre, gramos, cm2]] of ESPESORES.entries()) {
    const datos = { gramos, cm2, gramosPorCm2: gramos / cm2, orden };
    await prisma.espesorMaterial.upsert({ where: { nombre }, update: datos, create: { nombre, ...datos } });
  }
  for (const [clave, valor, desde, nota] of PARAMETROS) {
    const vigenteDesde = new Date(desde);
    await prisma.parametro.upsert({
      where: { clave_vigenteDesde: { clave, vigenteDesde } },
      update: {},
      create: { clave, valor, vigenteDesde, nota },
    });
  }
  await prisma.politicaPrecios.upsert({
    where: { nombre: 'General' },
    update: {},
    create: {
      nombre: 'General',
      cifPorcentajes: [0.16, 0.1, 0.05],
      cifBase: 'PRIMERA_FILA',
      administracionPorcentaje: 0.03,
      administracionBase: 'PRIMERA_FILA',
      margenesSugeridos: [0.35, 0.3, 0.25, 0.2],
      redondeo: 10,
      predeterminada: true,
    },
  });
}

const HISTORIAL = new URL('../../../datos-privados/historial-excel.json', import.meta.url);

async function historial() {
  if (!existsSync(HISTORIAL)) {
    console.info('Sin datos-privados/historial-excel.json: no se importa el historial del Excel.');
    return;
  }
  const datos = JSON.parse(readFileSync(HISTORIAL, 'utf-8')) as Historico[];
  const tipos = new Map((await prisma.tipoProducto.findMany()).map((t) => [t.codigo, t.id]));
  const yaImportadas = new Map(
    (
      await prisma.cotizacion.findMany({
        where: { origen: 'EXCEL' },
        select: { id: true, hojaExcel: true, fecha: true, tipoCorte: true, gramosPorCm2: true, troqueladasPorHora: true },
      })
    ).map((c) => [c.hojaExcel, c]),
  );
  const clientes = new Map<string, number>();
  const aFecha = (texto: string | null) => (texto ? new Date(texto) : null);

  let nuevas = 0;
  let actualizadas = 0;
  const numero = (d: { toString(): string } | null) => (d == null ? null : Number(d.toString()));
  for (const h of datos) {
    const existente = yaImportadas.get(h.hoja);
    if (existente) {
      // Si cambió la forma de leer el Excel (fecha, troquelada…), se corrige sin volver a importar.
      const cambios = {
        ...(existente.fecha?.getTime() !== aFecha(h.fecha)?.getTime() && { fecha: aFecha(h.fecha) }),
        ...(existente.tipoCorte !== h.tipoCorte && { tipoCorte: h.tipoCorte }),
        ...(numero(existente.gramosPorCm2) !== h.gramosPorCm2 && { gramosPorCm2: h.gramosPorCm2 }),
        ...(numero(existente.troqueladasPorHora) !== h.troqueladasPorHora && { troqueladasPorHora: h.troqueladasPorHora }),
      };
      if (Object.keys(cambios).length > 0) {
        await prisma.cotizacion.update({ where: { id: existente.id }, data: cambios });
        actualizadas++;
      }
      continue;
    }

    let clienteId: number | undefined;
    if (h.cliente) {
      const clave = h.cliente.toUpperCase();
      clienteId = clientes.get(clave);
      if (!clienteId) {
        const existente = await prisma.cliente.findFirst({ where: { nombre: { equals: h.cliente, mode: 'insensitive' } } });
        clienteId = existente?.id ?? (await prisma.cliente.create({ data: { nombre: h.cliente } })).id;
        clientes.set(clave, clienteId);
      }
    }

    const c = h.calculo;
    const horasPorDia = 10;
    await prisma.cotizacion.create({
      data: {
        origen: 'EXCEL',
        hojaExcel: h.hoja,
        estado: 'HISTORICA',
        clienteId,
        tipoProductoId: h.tipoProducto ? tipos.get(h.tipoProducto) : undefined,
        referencia: h.referencia,
        tipoCorte: h.tipoCorte,
        gramosPorCm2: h.gramosPorCm2,
        troqueladasPorHora: h.troqueladasPorHora,
        anchoCm: h.anchoCm,
        altoCm: h.altoCm,
        tintas: h.tintas,
        montaje: h.montaje,
        moMin: h.moMin,
        moMinFuente: 'OPERARIA',
        valorMinuto: h.valorMinuto,
        horasPorDia,
        gramosPorClise: h.gramosPorClise,
        precioGramo: h.precioGramo,
        // En el Excel la fila base del CIF varía entre hojas; el valor exacto de cada fila queda en `cantidades`.
        cifBase: 'PRIMERA_FILA',
        administracionPorcentaje: c?.administracion[0]?.porcentaje ?? 0,
        fecha: aFecha(h.fecha),
        observaciones: c ? null : 'Importada del Excel sin tabla de costos estándar',
        conceptos: c
          ? { create: c.conceptos.map((k, orden) => ({ orden, ...k })) }
          : undefined,
        margenes: c
          ? {
              create: c.margenes.map((m, orden) => ({
                orden,
                valor: m.valor,
                sobreOrden: m.sobre === 'COSTO' ? null : m.sobre,
              })),
            }
          : undefined,
        cantidades: c
          ? {
              create: c.cantidades.map((q, orden) => ({
                orden,
                ...q,
                diasRequeridos: q.cantidad / (horasPorDia * (60 / h.moMin) * h.montaje),
              })),
            }
          : undefined,
      },
    });
    nuevas++;
  }
  console.log(
    `Cotizaciones históricas importadas: ${nuevas} (ya existían: ${yaImportadas.size}, actualizadas: ${actualizadas})`,
  );
}

/**
 * Primer administrador, solo si todavía no hay ninguno. Usuario y contraseña salen de ADMIN_USUARIO y ADMIN_CLAVE
 * (.env); si no hay ADMIN_CLAVE se genera una al azar y se muestra una sola vez en la consola.
 */
async function administrador() {
  if (await prisma.usuario.count({ where: { rol: 'ADMIN' } })) return;
  const usuario = (process.env.ADMIN_USUARIO ?? 'admin').trim().toLowerCase();
  const generada = !process.env.ADMIN_CLAVE;
  const clave = process.env.ADMIN_CLAVE ?? randomBytes(9).toString('base64url');
  if (clave.length < LARGO_MINIMO_CLAVE) throw new Error(`ADMIN_CLAVE debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`);
  await prisma.usuario.create({ data: { usuario, nombre: 'Administrador', rol: 'ADMIN', claveHash: await cifrarClave(clave) } });
  console.log(
    generada
      ? `Administrador creado: usuario "${usuario}", contraseña "${clave}". Cámbiala al entrar (no se vuelve a mostrar).`
      : `Administrador creado: usuario "${usuario}" con la contraseña de ADMIN_CLAVE.`,
  );
}

async function main() {
  await catalogos();
  await historial();
  await administrador();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
