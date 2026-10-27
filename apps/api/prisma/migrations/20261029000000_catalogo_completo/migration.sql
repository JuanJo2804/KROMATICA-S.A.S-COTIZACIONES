-- Orden de los conceptos del catálogo (como en el Excel) y muestra pesada de cada espesor.
ALTER TABLE "ConceptoCatalogo" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EspesorMaterial"
  ADD COLUMN "gramos" DECIMAL(10,2),
  ADD COLUMN "cm2" DECIMAL(10,2),
  ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;
