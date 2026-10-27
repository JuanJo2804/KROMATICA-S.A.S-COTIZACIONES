import { describe, expect, it } from 'vitest';
import { nombreArchivo } from './documento-cliente.service.js';
import { generarPdf, imagenValida, lineasDeTexto, lineasPorDefecto, tipoDeImagen } from './pdf-cliente.js';

// PNG de 1 × 1 píxel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('PDF para el cliente', () => {
  it('arma las líneas por defecto con la descripción y el tamaño (cotización de referencia)', () => {
    expect(
      lineasPorDefecto({ descripcion: 'Aplique en PVC, base más un color', tipoProducto: 'Aplique', anchoCm: 5, altoCm: 2 }),
    ).toEqual(['Aplique en PVC', 'Base más un color', 'Tamaño 5 x 2 cms']);
  });

  it('usa el tipo de producto si no hay descripción y escribe decimales con coma', () => {
    expect(lineasPorDefecto({ descripcion: null, tipoProducto: 'Llavero', anchoCm: 4.5, altoCm: 1.2 })).toEqual([
      'Llavero',
      'Tamaño 4,5 x 1,2 cms',
    ]);
  });

  it('parte el texto guardado en líneas sin renglones vacíos', () => {
    expect(lineasDeTexto('Aplique en PVC\n\n  Corte recto  \n')).toEqual(['Aplique en PVC', 'Corte recto']);
  });

  it('reconoce JPG y PNG por sus bytes, no por el nombre', () => {
    expect(tipoDeImagen(PNG)).toBe('image/png');
    expect(tipoDeImagen(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(tipoDeImagen(Buffer.from('GIF89a'))).toBeNull();
    expect(imagenValida(PNG)).toBe(true);
    expect(imagenValida(Buffer.concat([PNG.subarray(0, 8), Buffer.from('dañado')]))).toBe(false);
  });

  it('nombra el archivo sin tildes ni espacios', () => {
    expect(nombreArchivo(855, 'José Peña Muñoz')).toBe('Cotizacion-855-jose-pena-munoz.pdf');
    expect(nombreArchivo(12, null)).toBe('Cotizacion-12.pdf');
  });

  it('genera un PDF con y sin imagen', async () => {
    const datos = {
      titulo: 'Cotización 1',
      lineas: ['Aplique en PVC', 'Base más un color', 'Tamaño 5 x 2 cms', 'Corte recto'],
      filas: [
        { cantidad: 300, precioUnitario: 1760 },
        { cantidad: 500, precioUnitario: 1490 },
      ],
    };
    for (const imagen of [PNG, null]) {
      const pdf = await generarPdf({ ...datos, imagen });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(1000);
    }
  });
});
