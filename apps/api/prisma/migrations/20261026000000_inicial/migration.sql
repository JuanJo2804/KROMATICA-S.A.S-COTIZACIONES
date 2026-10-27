-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'EN_PRUEBAS', 'EN_PRODUCCION', 'TERMINADA', 'CANCELADA', 'HISTORICA');

-- CreateEnum
CREATE TYPE "OrigenCotizacion" AS ENUM ('SISTEMA', 'EXCEL');

-- CreateEnum
CREATE TYPE "FuenteTiempo" AS ENUM ('OPERARIA', 'SUGERENCIA_ACEPTADA', 'SUGERENCIA_CORREGIDA');

-- CreateEnum
CREATE TYPE "BaseCalculo" AS ENUM ('PRIMERA_FILA', 'PROPIA_FILA');

-- CreateEnum
CREATE TYPE "SeccionConcepto" AS ENUM ('TROQUEL', 'CLISE', 'TROQUELADA', 'MATERIAL', 'ARMADA', 'EMPAQUE', 'OTROS', 'ADICIONAL');

-- CreateEnum
CREATE TYPE "TipoCosto" AS ENUM ('POR_UNIDAD', 'FIJO');

-- CreateEnum
CREATE TYPE "ClaveParametro" AS ENUM ('VALOR_MINUTO', 'HORAS_POR_DIA', 'PRECIO_CM2_CLISE', 'PRECIO_GRAMO');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoProducto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoCatalogo" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "seccion" "SeccionConcepto" NOT NULL,
    "tipoCosto" "TipoCosto" NOT NULL,
    "valorSugerido" DECIMAL(14,4),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConceptoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspesorMaterial" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "gramosPorCm2" DECIMAL(10,6) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EspesorMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametro" (
    "id" SERIAL NOT NULL,
    "clave" "ClaveParametro" NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticaPrecios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cifPorcentajes" DECIMAL(6,4)[],
    "cifBase" "BaseCalculo" NOT NULL DEFAULT 'PRIMERA_FILA',
    "administracionPorcentaje" DECIMAL(6,4) NOT NULL,
    "administracionBase" "BaseCalculo" NOT NULL DEFAULT 'PRIMERA_FILA',
    "margenesSugeridos" DECIMAL(6,4)[],
    "redondeo" INTEGER NOT NULL DEFAULT 10,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PoliticaPrecios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" SERIAL NOT NULL,
    "consecutivo" SERIAL NOT NULL,
    "origen" "OrigenCotizacion" NOT NULL DEFAULT 'SISTEMA',
    "hojaExcel" TEXT,
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'BORRADOR',
    "clienteId" INTEGER,
    "tipoProductoId" INTEGER,
    "referencia" TEXT,
    "descripcion" TEXT,
    "tipoCorte" TEXT,
    "anchoCm" DECIMAL(8,2),
    "altoCm" DECIMAL(8,2),
    "tintas" INTEGER,
    "montaje" INTEGER NOT NULL,
    "espesor" TEXT,
    "moMin" DECIMAL(8,2) NOT NULL,
    "moMinFuente" "FuenteTiempo" NOT NULL DEFAULT 'OPERARIA',
    "moMinSugerido" DECIMAL(8,2),
    "moMinReal" DECIMAL(8,2),
    "horasRealesProduccion" DECIMAL(8,2),
    "valorMinuto" DECIMAL(10,2) NOT NULL,
    "horasPorDia" DECIMAL(5,2) NOT NULL,
    "gramosPorClise" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "precioGramo" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "cifBase" "BaseCalculo" NOT NULL DEFAULT 'PRIMERA_FILA',
    "administracionPorcentaje" DECIMAL(6,4) NOT NULL,
    "administracionBase" "BaseCalculo" NOT NULL DEFAULT 'PRIMERA_FILA',
    "redondeo" INTEGER NOT NULL DEFAULT 10,
    "entrada" JSONB,
    "observaciones" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionConcepto" (
    "id" SERIAL NOT NULL,
    "cotizacionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "seccion" "SeccionConcepto" NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porUnidad" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "fijo" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CotizacionConcepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionMargen" (
    "id" SERIAL NOT NULL,
    "cotizacionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "valor" DECIMAL(6,4) NOT NULL,
    "sobreOrden" INTEGER,

    CONSTRAINT "CotizacionMargen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionCantidad" (
    "id" SERIAL NOT NULL,
    "cotizacionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "cifPorcentaje" DECIMAL(6,4) NOT NULL,
    "subtotal" DECIMAL(14,4) NOT NULL,
    "administracion" DECIMAL(14,4) NOT NULL,
    "cif" DECIMAL(14,4) NOT NULL,
    "costoTotal" DECIMAL(14,4) NOT NULL,
    "diasRequeridos" DECIMAL(8,2) NOT NULL,
    "margenElegidoOrden" INTEGER,
    "precioUnitario" DECIMAL(14,2),

    CONSTRAINT "CotizacionCantidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioEstado" (
    "id" SERIAL NOT NULL,
    "cotizacionId" INTEGER NOT NULL,
    "desde" "EstadoCotizacion",
    "hacia" "EstadoCotizacion" NOT NULL,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CambioEstado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_nit_key" ON "Cliente"("nit");

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TipoProducto_codigo_key" ON "TipoProducto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoCatalogo_codigo_key" ON "ConceptoCatalogo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "EspesorMaterial_nombre_key" ON "EspesorMaterial"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Parametro_clave_vigenteDesde_key" ON "Parametro"("clave", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticaPrecios_nombre_key" ON "PoliticaPrecios"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_consecutivo_key" ON "Cotizacion"("consecutivo");

-- CreateIndex
CREATE INDEX "Cotizacion_estado_idx" ON "Cotizacion"("estado");

-- CreateIndex
CREATE INDEX "Cotizacion_creadaEn_idx" ON "Cotizacion"("creadaEn");

-- CreateIndex
CREATE INDEX "Cotizacion_tipoProductoId_tintas_montaje_idx" ON "Cotizacion"("tipoProductoId", "tintas", "montaje");

-- CreateIndex
CREATE INDEX "CotizacionConcepto_cotizacionId_idx" ON "CotizacionConcepto"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionMargen_cotizacionId_orden_key" ON "CotizacionMargen"("cotizacionId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionCantidad_cotizacionId_orden_key" ON "CotizacionCantidad"("cotizacionId", "orden");

-- CreateIndex
CREATE INDEX "CambioEstado_cotizacionId_idx" ON "CambioEstado"("cotizacionId");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_tipoProductoId_fkey" FOREIGN KEY ("tipoProductoId") REFERENCES "TipoProducto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionConcepto" ADD CONSTRAINT "CotizacionConcepto_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionMargen" ADD CONSTRAINT "CotizacionMargen_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionCantidad" ADD CONSTRAINT "CotizacionCantidad_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioEstado" ADD CONSTRAINT "CambioEstado_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
