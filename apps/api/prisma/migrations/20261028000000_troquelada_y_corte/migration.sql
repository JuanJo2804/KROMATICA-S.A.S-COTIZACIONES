-- Tipo de corte como enum (antes texto libre), espesor en gramos por cm² y troqueladas por hora.

-- CreateEnum
CREATE TYPE "TipoCorte" AS ENUM ('BISTURI', 'TROQUELADO');

-- AlterTable: el texto anterior se convierte en lugar de borrarse ("Corte recto" → BISTURI).
ALTER TABLE "Cotizacion"
  ADD COLUMN "gramosPorCm2" DECIMAL(10,6),
  ADD COLUMN "troqueladasPorHora" DECIMAL(10,2),
  ADD COLUMN "troqueladasPorHoraSugerida" DECIMAL(10,2),
  ALTER COLUMN "tipoCorte" TYPE "TipoCorte" USING (
    CASE
      WHEN "tipoCorte" ILIKE '%troquel%' THEN 'TROQUELADO'
      WHEN "tipoCorte" IS NOT NULL AND btrim("tipoCorte") <> '' THEN 'BISTURI'
    END
  )::"TipoCorte";

-- Cotizaciones del sistema: troqueladas por hora a partir del $ por unidad guardado (60 × valor minuto / $ unidad).
UPDATE "Cotizacion" c
SET "troqueladasPorHora" = round(60 * c."valorMinuto" / k."porUnidad", 2)
FROM "CotizacionConcepto" k
WHERE k."cotizacionId" = c.id AND k.codigo = 'troquelada' AND k."porUnidad" > 0 AND c.origen = 'SISTEMA';

-- Gramos por cm² del espesor elegido.
UPDATE "Cotizacion" c
SET "gramosPorCm2" = e."gramosPorCm2"
FROM "EspesorMaterial" e
WHERE e.nombre = c.espesor;
