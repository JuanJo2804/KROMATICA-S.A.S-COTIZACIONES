-- Fecha de la cotización (en las importadas del Excel, la más reciente de la hoja).
ALTER TABLE "Cotizacion" ADD COLUMN "fecha" DATE;

CREATE INDEX "Cotizacion_fecha_idx" ON "Cotizacion"("fecha");

-- Las creadas en el sistema toman el día (hora de Colombia) en que se crearon.
-- Las importadas se completan al volver a correr el seed.
UPDATE "Cotizacion"
SET "fecha" = ("creadaEn" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date
WHERE "origen" = 'SISTEMA';
