# Fórmulas de cálculo

Extraídas de las fórmulas de las celdas de `Cotizaciones.xlsx` (plantilla estándar, 780 hojas).
Implementadas en `packages/motor-calculo`.

## Tiempo de producción

La operaria aporta dos datos: **MO min** (los minutos que tarda en hacer una plancha) y las **troqueladas por
hora**. El sistema sugiere los dos con cotizaciones parecidas (`apps/api/src/sugerencias`).

| Concepto | Fórmula | Celda en el Excel |
|---|---|---|
| Planchas por hora | `60 / MO min` | `O12 = 60/K11` |
| Unidades por día | `horas/día × planchas/hora × montaje` | `O13 = 9.5*O12*B14` |
| Días requeridos | `cantidad / (horas/día × planchas/hora × montaje)` | `Q66 = O66/(10*$O$12*$B$14)` |

> El Excel usa **10 h** para los días requeridos (en todas las hojas) y **9,5 h** en la línea informativa de unidades/día (390 hojas).
> El sistema usa un único parámetro `HORAS_POR_DIA`: 8,5 h desde el 26-oct-2026 (jornada real confirmada).

## Costos por unidad

Cada concepto cuesta `porUnidad + fijo / cantidad`.

| Concepto | Fórmula | Celda |
|---|---|---|
| Troquel (fijo) | `costo troquel / cantidad` | `B47 = $C$16/A47` |
| Clisé (fijo) | `(cm² × n.º clisés × $/cm²) / cantidad` | `D25 = B25*B30*C27` |
| Troquelada | `60 × valor minuto / troqueladas por hora` | `D41`; `G42 = (60*O8)/D41` despejado |
| Armada | suma de ítems: puntera, argolla, puesta argolla, remache… | `O22` |
| Material | `gramos por clisé × $/gramo / montaje` + materiales adicionales | `N17 = (O10*H12)/B14` |
| Otros (mano de obra) | `valor minuto × MO min / montaje` + diseño, perforada… | `N36 = (O8*K11)/B14` |
| Empaque | suma de ítems: bolsa, contada, empaque final… | `O27` |
| Adicionales | samblasted, screen, mate, flete… (fijos o por unidad) | columnas E/F |

El **pantógrafo** (`D26`) y los **troqueles** por tipo (hierro, madera, eléctrico) son renglones del catálogo: el
pantógrafo es un costo fijo propio dentro del clisé y los troqueles se suman al costo fijo del troquel.

## Clisé y gramos (recuadro "TAMAÑO CLISE" y "TABLA DE GRAMOS POR CM²")

```
largo del clisé = ancho × unidades a lo largo + espacio × (unidades a lo largo − 1) + 2 cm
ancho del clisé = alto × unidades a lo ancho + espacio × (unidades a lo ancho − 1) + 2 cm
cm² del clisé   = largo × ancho          (sin redondear: el Excel muestra 412 pero calcula con 411,72)
gramos por clisé = gramos por cm² del espesor × cm² del clisé   (redondeado a gramos enteros, "NUEVOS GRAMOS")
montaje          = unidades a lo largo × unidades a lo ancho    (si no se escribe otro)
```

- Espacio entre unidades: **0,3 cm** troquelado, **0 cm** corte bisturí (se puede cambiar).
- El clisé debe caber en el área disponible de **25 × 30 cm** (en cualquier orientación); si no, se avisa.
- Comprobado con los dos ejemplos del Excel: llavero troquelado 5 × 4, 5 × 3 → 28,2 × 14,6 = 411,72 cm²
  ($201.743 a $490/cm²); aplique bisturí 2,7 × 8, 6 × 3 → 18,2 × 26 = 473,2 cm² ($231.868).
- Gramos por cm² de cada espesor: tabla `EspesorMaterial` (gramos ÷ cm² de la muestra; ej. 3 mm = 90 / 333).

## Costo total

```
subtotal       = suma de los conceptos                      (Excel: SUM(B:J))
administración = % admón × subtotal de la fila base         (Excel: N43 = SUM(B48:J48)*0.03)
CIF            = % CIF de la fila × subtotal de la fila base (Excel: N40 = SUM(B47:J47)*0.16)
costo total    = subtotal + administración + CIF            (Excel: M47 = SUM(B47:L47))
```

**Fila base**: el CIF y la administración se pueden calcular sobre el subtotal de la **primera** cantidad
(la más pequeña, decisión confirmada) o sobre el de **cada fila**. En el Excel esto no es consistente:

| Forma en el Excel | Hojas |
|---|---|
| Todo sobre la primera fila | 186 |
| Cada fila sobre sí misma | 227 |
| Mezclado (copias de filas) | 365 |

El sistema usa **primera fila** por defecto (`PoliticaPrecios.cifBase`), configurable.

## Precio

```
precio = costo total / (1 − margen)
```

- Se muestran varias opciones de margen lado a lado (por defecto 35 %, 30 %, 25 %, 20 %). **La persona elige.**
- Un margen puede calcularse sobre el precio de otro margen (`sobre: n`), como la 5.ª columna del Excel.
- El precio al cliente se redondea a decenas: 1.488,7 → **1.490**.
- Ganancia del pedido = `(precio redondeado − costo total) × cantidad`.

## Ejemplo verificado: cotización de referencia

Aplique en PVC, base más un color, 5 × 2 cm, corte recto. MO min 10, montaje 12, valor minuto 450.

| Cantidad | Costo total | Precio 30 % | Enviado al cliente |
|---|---|---|---|
| 300 | 1.232,18 | 1.760,26 | **$1.760** + IVA |
| 500 | 1.042,12 | 1.488,74 | **$1.490** + IVA |
