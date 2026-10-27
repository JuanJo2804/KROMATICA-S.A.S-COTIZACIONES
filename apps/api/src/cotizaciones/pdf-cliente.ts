/**
 * PDF de la cotización para el cliente, con el formato que usa Kromatica:
 *
 *   [imagen del producto]   |
 *
 *   Aplique en PVC
 *   Base más un color
 *   Tamaño 5 x 2 cms
 *   Corte recto
 *
 *   ┌─────────┬──────────────────────┐
 *   │ 300 uds │ $1.760 + Iva la und  │
 *   │ 500 uds │ $1.490 + Iva la und  │
 *   └─────────┴──────────────────────┘
 */
import PDFDocument from 'pdfkit';

/** Formatos de imagen que acepta pdfkit. */
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png'] as const;
export type TipoImagen = (typeof TIPOS_IMAGEN)[number];
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

const conMayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('es-CO') + texto.slice(1);

/**
 * Líneas por defecto: la descripción partida en renglones (por salto de línea o por coma) y el tamaño.
 * "Aplique en PVC, base más un color" + 5 × 2 → ["Aplique en PVC", "Base más un color", "Tamaño 5 x 2 cms"].
 */
export function lineasPorDefecto(c: {
  descripcion: string | null;
  tipoProducto: string | null;
  anchoCm: number | null;
  altoCm: number | null;
}): string[] {
  const lineas = (c.descripcion ?? '')
    .split(/\n|,\s*/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(conMayuscula);
  if (lineas.length === 0 && c.tipoProducto) lineas.push(c.tipoProducto);
  if (c.anchoCm && c.altoCm) lineas.push(`Tamaño ${numero.format(c.anchoCm)} x ${numero.format(c.altoCm)} cms`);
  return lineas;
}

/** Texto guardado por la persona → líneas (sin renglones vacíos). */
export const lineasDeTexto = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Tipo real de la imagen según sus primeros bytes (no se confía en el nombre ni en el Content-Type). */
export function tipoDeImagen(datos: Uint8Array): TipoImagen | null {
  if (datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => datos[i] === b)) return 'image/png';
  return null;
}

/** true si pdfkit puede abrir la imagen (detecta archivos dañados al subirlos, no al generar el PDF). */
export function imagenValida(datos: Buffer): boolean {
  try {
    // openImage existe en pdfkit pero no está en sus tipos.
    (new PDFDocument({ autoFirstPage: false }) as unknown as { openImage(d: Buffer): unknown }).openImage(datos);
    return true;
  } catch {
    return false;
  }
}

export interface DatosPdf {
  titulo: string;
  lineas: string[];
  /** Solo las cantidades con precio elegido. */
  filas: { cantidad: number; precioUnitario: number }[];
  imagen: Buffer | null;
}

// Medidas en puntos (carta: 612 × 792). Margen izquierdo de 1 pulgada como un documento de Word.
const X = 72;
const IMAGEN = { x: 100, y: 60, ancho: 260, alto: 140 };
const LINEA_VERTICAL = { x: 395, desde: 45, hasta: 235 };
const TAMANO_LETRA = 15;
const ESPACIO_LINEAS = 33;
const TABLA = { columnas: [180, 245], alto: 22, relleno: 12 };

export function generarPdf(d: DatosPdf): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: X, info: { Title: d.titulo, Author: 'Kromatica' } });
  const partes: Buffer[] = [];
  doc.on('data', (b: Buffer) => partes.push(b));
  const fin = new Promise<Buffer>((resolver, rechazar) => {
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);
  });

  let y = X;
  if (d.imagen) {
    doc.image(d.imagen, IMAGEN.x, IMAGEN.y, { fit: [IMAGEN.ancho, IMAGEN.alto], align: 'center', valign: 'center' });
    doc
      .moveTo(LINEA_VERTICAL.x, LINEA_VERTICAL.desde)
      .lineTo(LINEA_VERTICAL.x, LINEA_VERTICAL.hasta)
      .lineWidth(0.8)
      .stroke('#000000');
    y = 260;
  }

  doc.font('Helvetica').fontSize(TAMANO_LETRA).fillColor('#000000');
  for (const linea of d.lineas) {
    doc.text(linea, X, y, { width: 612 - 2 * X, lineBreak: false, ellipsis: true });
    y += ESPACIO_LINEAS;
  }

  y += 10;
  const [col1, col2] = TABLA.columnas as [number, number];
  doc.lineWidth(0.8).strokeColor('#000000');
  for (const fila of d.filas) {
    doc.rect(X, y, col1, TABLA.alto).stroke();
    doc.rect(X + col1, y, col2, TABLA.alto).stroke();
    const yTexto = y + (TABLA.alto - TAMANO_LETRA) / 2 + 1.5;
    doc.text(`${numero.format(fila.cantidad)} uds`, X + TABLA.relleno, yTexto, { lineBreak: false });
    doc.text(`$${numero.format(fila.precioUnitario)} + Iva la und`, X + col1 + TABLA.relleno, yTexto, {
      lineBreak: false,
    });
    y += TABLA.alto;
  }

  doc.end();
  return fin;
}
