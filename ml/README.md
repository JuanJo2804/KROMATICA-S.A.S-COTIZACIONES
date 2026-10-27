# Modelos de predicción (MO min y troqueladas por hora)

Todavía no hay código aquí a propósito: la fase 1 (vecinos cercanos en `apps/api/src/sugerencias`) ya cubre la
sugerencia con un error promedio de 5,0 min.

## Resultado de la prueba inicial (842 cotizaciones del Excel, validación agrupada por cliente)

| Método | Error promedio | Dentro de ±5 min |
|---|---|---|
| Valor típico (mediana) | 8,5 min | — |
| Vecinos cercanos (fase 1, en producción) | 5,0 min | 76 % |
| Random Forest (scikit-learn) | 4,5 min | 71 % |

Variable más importante: **número de tintas** (62 %). Luego empaque, troquelada, gramos y tamaño.

## Cuándo pasar a la fase 2

- Cuando haya suficientes cotizaciones con **tiempo real** (`moMinReal`) para entrenar con datos medidos
  y no solo con estimados.
- Cuando el error de la fase 1, medido con `moMinSugerido` frente a `moMin`, deje de ser aceptable.

## Plan

1. `entrenar.py`: lee la BD, entrena, valida y guarda `modelo_vN.pkl` con sus métricas.
2. `servicio/` (FastAPI): `POST /predecir-tiempo`. La API lo llama con un timeout de 2 s y, si falla,
   usa la fase 1.
3. Un modelo nuevo solo reemplaza al anterior si mejora el error en el conjunto de validación.

**Datos y modelos entrenados son privados.** Las métricas de arriba salen del historial real, que está en el
repositorio privado `KROMATICA-S.A.S-COTIZACIONES-datos` (`datos-privados/`). El código de entrenamiento puede
ir aquí, pero los `modelo_vN.pkl` se guardan en `datos-privados/modelos/`, nunca en este repositorio público: un
modelo entrenado contiene información de los datos con que se entrenó.

## Troqueladas por hora (fase 1, en producción)

`apps/api/src/sugerencias/troquelada.ts`, ruta `GET /api/sugerencias/troquelada`. Vecinos cercanos con tipo de
producto, tipo de corte, área, montaje, espesor (gramos por cm²) y tintas. 835 cotizaciones del Excel con
troquelada, validación agrupada por cliente:

| Método | Error mediano | Dentro de ±25 % |
|---|---|---|
| Valor típico (mediana, 280 por hora) | 52 % | 30 % |
| Mediana por tipo de producto | 23 % | 54 % |
| Vecinos cercanos sin tipo de corte | 17 % | 61 % |
| **Vecinos cercanos (en producción)** | **14 %** | **62 %** |

Cómo se sacó el dato del Excel (`herramientas/importar-excel/03_exportar_historial.py`):

- **Troqueladas por hora** = 60 × valor minuto / $ por unidad de la troquelada. Coincide con la celda "troq/hora"
  en las 500 hojas que la tienen.
- **Tipo de corte**: el Excel no lo dice. Se infiere TROQUELADO si la hoja tiene costo de troquel (349 hojas, mediana
  145 por hora) y BISTURI si no (493 hojas, mediana 353 por hora). **Por confirmar con la operaria.**
- **Espesor**: el Excel no lo dice. Se estima como gramos por clisé ÷ cm² del clisé (685 hojas), que es la misma
  relación de la tabla de espesores. En las cotizaciones nuevas se toma de la tabla.

Pesos (búsqueda en rejilla): tipo de producto 1, tipo de corte 1, área 0,6, montaje 0,3, espesor 0,3, tintas 0,1;
10 vecinos. Las cotizaciones nuevas guardan `troqueladasPorHoraSugerida` para medir la precisión real.
