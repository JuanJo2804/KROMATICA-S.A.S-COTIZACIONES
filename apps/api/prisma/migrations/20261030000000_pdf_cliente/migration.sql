-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "textoCliente" TEXT;

-- CreateTable
CREATE TABLE "ImagenCotizacion" (
    "id" SERIAL NOT NULL,
    "cotizacionId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT,
    "datos" BYTEA NOT NULL,
    "subidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagenCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImagenCotizacion_cotizacionId_key" ON "ImagenCotizacion"("cotizacionId");

-- AddForeignKey
ALTER TABLE "ImagenCotizacion" ADD CONSTRAINT "ImagenCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

