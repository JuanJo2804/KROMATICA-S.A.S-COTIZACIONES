/**
 * Pruebas de punta a punta contra una base de datos real (DATABASE_URL), migrada y con el seed cargado.
 *   pnpm prisma migrate deploy && pnpm prisma db seed && pnpm test:e2e
 */
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { cifrarClave } from '../src/auth/claves.js';
import { configurarApp } from '../src/main.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Usuarios de prueba: se crean (o se reinician) en cada corrida.
const ADMIN = { usuario: 'e2e-admin', clave: 'clave-e2e-admin' };
const OPERARIO = { usuario: 'e2e-operario', clave: 'clave-e2e-operario' };

// Cotización de referencia (enviada a un cliente real): aplique PVC 5 x 2 cm, base más un color.
const referencia = {
  producto: {
    moMin: 10,
    montaje: 12,
    valorMinuto: 450,
    gramosPorClise: 60,
    precioGramo: 30,
    clise: { cm2: 224, cantidadClises: 1, precioCm2: 500 },
    troqueladaPorUnidad: 120,
  },
  cantidades: [300, 500],
  cif: { porcentajes: [0.16, 0.12], base: 'PRIMERA_FILA' },
  administracion: { porcentajes: [0.05], base: 'PRIMERA_FILA' },
  margenes: [{ valor: 0.35 }, { valor: 0.3 }, { valor: 0.25 }],
};

describe('API de cotizaciones (e2e)', () => {
  let app: INestApplication;
  /** Sin sesión. */
  let anonimo: ReturnType<typeof request>;
  /** Con sesión de administrador (la mayoría de las pruebas). */
  let http: ReturnType<typeof request.agent>;
  let operario: ReturnType<typeof request.agent>;
  /** El historial del Excel solo está si el seed encontró datos-privados/ (repositorio privado aparte). */
  let hayHistorial = false;

  const iniciarSesion = async (datos: { usuario: string; clave: string }) => {
    const agente = request.agent(app.getHttpServer());
    await agente.post('/api/auth/login').send(datos).expect(200);
    return agente;
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
    const prisma = app.get(PrismaService);
    for (const [datos, rol] of [[ADMIN, 'ADMIN'], [OPERARIO, 'OPERARIO']] as const) {
      const fila = { nombre: `Prueba ${rol.toLowerCase()}`, rol, activo: true, claveHash: await cifrarClave(datos.clave) };
      await prisma.usuario.upsert({ where: { usuario: datos.usuario }, create: { usuario: datos.usuario, ...fila }, update: fila });
    }
    anonimo = request(app.getHttpServer());
    http = await iniciarSesion(ADMIN);
    operario = await iniciarSesion(OPERARIO);
    hayHistorial = (await prisma.cotizacion.count({ where: { origen: 'EXCEL' } })) > 0;
  });

  afterAll(async () => {
    // Se borra lo que crearon las pruebas: sus cotizaciones (no ensucian el historial ni las sugerencias) y los
    // usuarios e2e-*, para que no queden cuentas activas con contraseñas conocidas (están en este archivo).
    if (app) {
      const prisma = app.get(PrismaService);
      const deE2e = { usuario: { startsWith: 'e2e-' } };
      await prisma.cotizacion.deleteMany({ where: { creadaPor: deE2e } });
      await prisma.usuario.deleteMany({ where: deE2e });
    }
    await app?.close();
  });

  it('GET /api/salud responde ok sin sesión', async () => {
    await anonimo.get('/api/salud').expect(200, { estado: 'ok', baseDeDatos: 'ok' });
  });

  it('sin sesión no se puede usar la API; con datos incorrectos no se entra', async () => {
    await anonimo.get('/api/cotizaciones').expect(401);
    await anonimo.post('/api/auth/login').send({ usuario: ADMIN.usuario, clave: 'otra-clave' }).expect(401);
    const yo = await http.get('/api/auth/yo').expect(200);
    expect(yo.body).toMatchObject({ usuario: ADMIN.usuario, rol: 'ADMIN' });
    expect(JSON.stringify(yo.body)).not.toContain('claveHash');
  });

  it('cerrar sesión invalida la cookie', async () => {
    const agente = await iniciarSesion(OPERARIO);
    await agente.get('/api/auth/yo').expect(200);
    await agente.post('/api/auth/salir').expect(204);
    await agente.get('/api/auth/yo').expect(401);
  });

  it('el operario cotiza, pero no cambia parámetros, no elimina ni administra usuarios', async () => {
    const creada = await operario
      .post('/api/cotizaciones')
      .send({ ...referencia, tipoProducto: 'aplique', tintas: 2, clienteNombre: 'Cliente de prueba e2e' })
      .expect(201);
    expect(creada.body.creadaPor).toMatchObject({ nombre: 'Prueba operario' });
    expect(creada.body.historial[0].usuario).toBe('Prueba operario');

    await operario
      .post('/api/parametros')
      .send({ clave: 'HORAS_POR_DIA', valor: 9, vigenteDesde: '2030-01-01' })
      .expect(403);
    await operario.delete(`/api/cotizaciones/${creada.body.id}?confirmar=${creada.body.consecutivo}`).expect(403);
    await operario.get('/api/usuarios').expect(403);
    await operario.get('/api/parametros').expect(200);
  });

  it('eliminar exige el número de la cotización como segunda confirmación (solo admin)', async () => {
    const creada = await http
      .post('/api/cotizaciones')
      .send({ ...referencia, tipoProducto: 'aplique', tintas: 2, clienteNombre: 'Cliente de prueba e2e' })
      .expect(201);
    const { id, consecutivo } = creada.body;
    await http.delete(`/api/cotizaciones/${id}`).expect(400);
    await http.delete(`/api/cotizaciones/${id}?confirmar=${consecutivo + 1}`).expect(400);
    await http.delete(`/api/cotizaciones/${id}?confirmar=${consecutivo}`).expect(204);
    await http.get(`/api/cotizaciones/${id}`).expect(404);
  });

  it('el admin crea usuarios, los desactiva y no puede quitarse a sí mismo el rol', async () => {
    const nombre = `e2e-temporal-${Date.now()}`;
    const nuevo = await http
      .post('/api/usuarios')
      .send({ usuario: nombre, nombre: 'Temporal', clave: 'corta', rol: 'OPERARIO' })
      .expect(400);
    expect(nuevo.body.message).toContain('8 caracteres');
    const creado = await http
      .post('/api/usuarios')
      .send({ usuario: nombre, nombre: 'Temporal', clave: 'clave-temporal', rol: 'OPERARIO' })
      .expect(201);
    expect(creado.body).not.toHaveProperty('claveHash');
    const temporal = await iniciarSesion({ usuario: nombre, clave: 'clave-temporal' });
    await http.patch(`/api/usuarios/${creado.body.id}`).send({ activo: false }).expect(200);
    await temporal.get('/api/auth/yo').expect(401);
    await anonimo.post('/api/auth/login').send({ usuario: nombre, clave: 'clave-temporal' }).expect(401);

    const yo = await http.get('/api/auth/yo').expect(200);
    await http.patch(`/api/usuarios/${yo.body.id}`).send({ rol: 'OPERARIO' }).expect(409);
  });

  it('POST /api/cotizaciones/calcular reproduce los precios de la cotización de referencia', async () => {
    const { body } = await http.post('/api/cotizaciones/calcular').send(referencia).expect(200);
    const precio30 = (fila: number) =>
      body.resultado.filas[fila].precios.find((p: { margen: number }) => p.margen === 0.3).precioRedondeado;
    expect(precio30(0)).toBe(1760);
    expect(precio30(1)).toBe(1490);
    expect(body.produccion[0].diasRequeridos).toBeGreaterThan(0);
  });

  it('usa los parámetros vigentes cuando no se envían', async () => {
    const { producto, ...resto } = referencia;
    const { valorMinuto: _v, precioGramo: _p, ...sinParametros } = producto;
    const { body } = await http
      .post('/api/cotizaciones/calcular')
      .send({ ...resto, producto: sinParametros })
      .expect(200);
    expect(body.usados.valorMinuto).toBe(450);
    expect(body.usados.horasPorDia).toBe(8.5);
  });

  it('rechaza datos inválidos con 400', async () => {
    await http
      .post('/api/cotizaciones/calcular')
      .send({ ...referencia, cantidades: [0] })
      .expect(400);
    await http
      .post('/api/cotizaciones/calcular')
      .send({ ...referencia, margenes: [{ valor: 0.2, sobre: 0 }] })
      .expect(400);
  });

  it('flujo completo: crear → elegir margen → enviar → aprobar → pruebas → producción → terminar', async () => {
    const creada = await http
      .post('/api/cotizaciones')
      .send({
        ...referencia,
        clienteNombre: 'Cliente de prueba e2e',
        tipoProducto: 'aplique',
        referencia: 'ref-e2e',
        descripcion: 'Aplique en PVC, base más un color',
        tipoCorte: 'BISTURI',
        anchoCm: 5,
        altoCm: 2,
        tintas: 2,
      })
      .expect(201);
    const id = creada.body.id;
    expect(creada.body.estado).toBe('BORRADOR');
    expect(creada.body.cantidades[0].costoTotal).toBeCloseTo(1232.1833, 3);

    // No se puede enviar sin elegir margen
    await http.patch(`/api/cotizaciones/${id}/estado`).send({ estado: 'ENVIADA' }).expect(409);

    const conMargen = await http
      .patch(`/api/cotizaciones/${id}/margenes`)
      .send({
        elecciones: [
          { cantidadOrden: 0, margenOrden: 1 },
          { cantidadOrden: 1, margenOrden: 1 },
        ],
      })
      .expect(200);
    expect(conMargen.body.cantidades.map((q: { precioUnitario: number }) => q.precioUnitario)).toEqual([1760, 1490]);

    // margenOrden null quita la elección; sin precio otra vez no se puede enviar
    const sinMargen = await http
      .patch(`/api/cotizaciones/${id}/margenes`)
      .send({ elecciones: [{ cantidadOrden: 1, margenOrden: null }] })
      .expect(200);
    expect(sinMargen.body.cantidades[1]).toMatchObject({ margenElegidoOrden: null, precioUnitario: null });
    await http.patch(`/api/cotizaciones/${id}/estado`).send({ estado: 'ENVIADA' }).expect(409);
    await http
      .patch(`/api/cotizaciones/${id}/margenes`)
      .send({ elecciones: [{ cantidadOrden: 1, margenOrden: 1 }] })
      .expect(200);

    for (const estado of ['ENVIADA', 'APROBADA', 'EN_PRUEBAS', 'EN_PRODUCCION']) {
      await http.patch(`/api/cotizaciones/${id}/estado`).send({ estado }).expect(200);
    }
    // Ya no se puede editar
    await http.patch(`/api/cotizaciones/${id}/margenes`).send({ elecciones: [] }).expect(409);

    await http.patch(`/api/cotizaciones/${id}/tiempo-real`).send({ moMinReal: 11 }).expect(200);
    const terminada = await http.patch(`/api/cotizaciones/${id}/estado`).send({ estado: 'TERMINADA' }).expect(200);
    expect(terminada.body.moMinReal).toBe(11);
    expect(terminada.body.historial.map((h: { hacia: string }) => h.hacia)).toEqual([
      'BORRADOR',
      'ENVIADA',
      'APROBADA',
      'EN_PRUEBAS',
      'EN_PRODUCCION',
      'TERMINADA',
    ]);

    // Transición inválida
    await http.patch(`/api/cotizaciones/${id}/estado`).send({ estado: 'BORRADOR' }).expect(409);
  });

  it('PUT /api/cotizaciones/:id edita un borrador: recalcula, borra lo vacío y quita los precios elegidos', async () => {
    const datos = { ...referencia, clienteNombre: 'Cliente de prueba e2e', tipoProducto: 'aplique', tintas: 2 };
    const creada = await http
      .post('/api/cotizaciones')
      .send({ ...datos, referencia: 'editar-e2e', observaciones: 'se borra' })
      .expect(201);
    const id = creada.body.id;
    await http
      .patch(`/api/cotizaciones/${id}/margenes`)
      .send({ elecciones: [{ cantidadOrden: 0, margenOrden: 1 }] })
      .expect(200);

    const editada = await http.put(`/api/cotizaciones/${id}`).send({ ...datos, cantidades: [300, 500, 1000] }).expect(200);
    expect(editada.body).toMatchObject({ id, estado: 'BORRADOR', referencia: null, observaciones: null });
    expect(editada.body.cantidades.map((q: { cantidad: number }) => q.cantidad)).toEqual([300, 500, 1000]);
    expect(editada.body.cantidades.every((q: { precioUnitario: number | null }) => q.precioUnitario === null)).toBe(true);

    // Fuera de borrador ya no se edita
    await http.patch(`/api/cotizaciones/${id}/estado`).send({ estado: 'CANCELADA' }).expect(200);
    await http.put(`/api/cotizaciones/${id}`).send(datos).expect(409);
  });

  it('PDF para el cliente: imagen, texto y precios elegidos', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const creada = await http
      .post('/api/cotizaciones')
      .send({
        ...referencia,
        clienteNombre: 'Cliente de prueba e2e',
        tipoProducto: 'aplique',
        descripcion: 'Aplique en PVC, base más un color',
        anchoCm: 5,
        altoCm: 2,
        tintas: 2,
      })
      .expect(201);
    const id = creada.body.id;
    expect(creada.body.lineasCliente).toEqual(['Aplique en PVC', 'Base más un color', 'Tamaño 5 x 2 cms']);
    expect(creada.body.imagen).toBeNull();

    // Sin precio elegido no hay PDF
    await http.get(`/api/cotizaciones/${id}/pdf`).expect(409);
    await http
      .patch(`/api/cotizaciones/${id}/margenes`)
      .send({ elecciones: [{ cantidadOrden: 0, margenOrden: 1 }, { cantidadOrden: 1, margenOrden: 1 }] })
      .expect(200);

    // Solo JPG o PNG
    await http.put(`/api/cotizaciones/${id}/imagen`).attach('imagen', Buffer.from('GIF89a…'), 'logo.gif').expect(422);
    const conImagen = await http.put(`/api/cotizaciones/${id}/imagen`).attach('imagen', png, 'producto.png').expect(200);
    expect(conImagen.body.imagen).toMatchObject({ tipo: 'image/png', nombre: 'producto.png' });
    const imagen = await http.get(`/api/cotizaciones/${id}/imagen`).expect(200);
    expect(imagen.headers['content-type']).toBe('image/png');

    const texto = 'Aplique en PVC\nBase más un color\nTamaño 5 x 2 cms\nCorte recto';
    const conTexto = await http.patch(`/api/cotizaciones/${id}/texto-cliente`).send({ texto }).expect(200);
    expect(conTexto.body.lineasCliente).toHaveLength(4);

    const pdf = await http.get(`/api/cotizaciones/${id}/pdf`).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('Cotizacion-');
    expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe('%PDF-');

    // null vuelve a las líneas por defecto; se puede quitar la imagen
    const sinTexto = await http.patch(`/api/cotizaciones/${id}/texto-cliente`).send({ texto: null }).expect(200);
    expect(sinTexto.body.lineasCliente).toHaveLength(3);
    await http.delete(`/api/cotizaciones/${id}/imagen`).expect(200);
    await http.get(`/api/cotizaciones/${id}/imagen`).expect(404);
    await http.patch(`/api/cotizaciones/${id}/estado`).send({ estado: 'CANCELADA' }).expect(200);
  });

  it('GET /api/cotizaciones lista y filtra el historial importado', async (ctx) => {
    if (!hayHistorial) ctx.skip();
    const { body } = await http.get('/api/cotizaciones?tipoProducto=llavero&porPagina=5').expect(200);
    expect(body.total).toBeGreaterThan(100);
    expect(body.items).toHaveLength(5);
  });

  it('GET /api/sugerencias/tiempo sugiere MO min a partir de cotizaciones parecidas', async (ctx) => {
    if (!hayHistorial) ctx.skip();
    const { body } = await http
      .get('/api/sugerencias/tiempo?tipoProducto=llavero&tintas=4&montaje=12&anchoCm=5&altoCm=4')
      .expect(200);
    expect(body.moMin).toBeGreaterThanOrEqual(20);
    expect(body.moMin).toBeLessThanOrEqual(40);
    expect(body.similares).toHaveLength(10);
  });

  it('GET /api/parametros devuelve los valores vigentes', async () => {
    const { body } = await http.get('/api/parametros').expect(200);
    expect(body.VALOR_MINUTO.valor).toBe(450);
  });
});
