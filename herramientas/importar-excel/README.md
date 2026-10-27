# Importar el Excel histórico

Scripts para volver a generar los casos de prueba y el historial cuando el Excel cambie.

```bash
pip install openpyxl
cd herramientas/importar-excel

# 1. Volcar valores y fórmulas de todas las hojas (≈15 s para 856 hojas)
python 01_volcar_celdas.py /ruta/Cotizaciones.xlsx celdas.json

# 2. Casos de prueba del motor de cálculo
python 02_generar_casos_prueba.py celdas.json ../../datos-privados

# 3. Historial para el seed de la base de datos
python 03_exportar_historial.py celdas.json \
  ../../datos-privados/hojas-excel-cotizacion.json \
  ../../datos-privados/historial-excel.json
```

`celdas.json` y el `.xlsx` no se suben a ningún repositorio (`.gitignore`). Los tres JSON que se generan tienen
clientes, costos y precios reales: van en `datos-privados/`, que es el repositorio privado
`KROMATICA-S.A.S-COTIZACIONES-datos` (ver el README principal). Después de regenerarlos, haz commit y push **ahí**,
nunca en el repositorio público.

**Fecha de cada cotización**: cuando una hoja se volvía a cotizar se agregaba otra fecha debajo (columna N, O,
P o R, filas 1 a 6), a veces como fecha y a veces como número de serie de Excel. Se toma la **más reciente**.
17 hojas no tienen ninguna fecha y quedan con `fecha: null` (al final del historial). Después de regenerar el
JSON, `pnpm db:seed` corrige las fechas de las cotizaciones ya importadas.

**Troquelada, tipo de corte y espesor**: `troqueladasPorHora` = 60 × valor minuto / $ por unidad (celda
"troq/hora"); `tipoCorte` se infiere (TROQUELADO si la hoja tiene costo de troquel, BISTURI si no) y
`gramosPorCm2` se estima como gramos por clisé ÷ cm² del clisé. Ver `ml/README.md`. El seed también corrige
estos tres campos en las cotizaciones ya importadas.

Las hojas que no siguen la plantilla estándar, o que tienen el CIF escrito a mano, no se usan como casos de
prueba (el script imprime cuántas descarta y por qué). Sí se importan al historial si tienen MO min y montaje.
