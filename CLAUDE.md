# CLAUDE.md · Kromatica Cotizaciones

Contexto para Claude Code. El proyecto empezó en un chat de claude.ai (26-oct-2026); aquí está lo esencial
de esa conversación. Responder siempre en **español**.

## Qué es

Sistema web que reemplaza la plantilla de Excel de cotizaciones de Kromatica (productos personalizados en
PVC/rubber: llaveros, marquillas, apliques, manillas, portavasos, haladeras, pines, diges, punteras, banderas,
correas, sellos). Autor: Juan José Ocampo Ramírez (estudiante de Ingeniería de Software, con experiencia en QA).

Objetivos:
1. Calcular costos y precios igual que el Excel.
2. Guardar historial con ciclo de vida.
3. Sugerir el **MO min** (minutos por plancha), hoy estimado por una operaria con experiencia, para no depender 100 % de ella.

## Estado actual

- ✅ `packages/motor-calculo`: cálculo puro en TS. Validado contra **552 cotizaciones reales** del Excel (golden tests).
- ✅ `apps/api`: NestJS 12 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16. 31 rutas, Swagger en `/api/docs`.
- ✅ Seed con catálogos, parámetros con vigencia y **842 cotizaciones históricas** del Excel.
- ✅ Sugerencia de MO min por vecinos cercanos (fase 1): error medio ≈ 5,0 min (vs. 8,5 usando la mediana).
- ✅ Sugerencia de **troqueladas por hora** por vecinos cercanos: error mediano 14 % (vs. 52 % con la mediana).
  En el Excel el tipo de corte y el espesor no existen: se infieren (ver `ml/README.md`). **Inferencia del corte
  por confirmar** (TROQUELADO = la hoja tiene costo de troquel).
- 🟡 `apps/web` (Next.js 16 + Tailwind 4): **Nueva cotización** (cálculo en vivo con el motor en el navegador,
  calculadora del clisé, sugerencias de tiempo y troquelada, elegir precio, guardar), **Historial** (filtros en la URL, paginado),
  **Detalle** (elegir/quitar precio, cambiar estado, tiempo real, **PDF para el cliente** con imagen), **Editar
  borrador** y **Parámetros** (registrar valores con vigencia).
  Ver `apps/web/README.md`. `lib/calculo.ts` replica la lógica de `CalculoService`: si cambia uno, cambiar el otro.
- ✅ PDF para el cliente (`GET /api/cotizaciones/:id/pdf`, pdfkit en `apps/api/src/cotizaciones/pdf-cliente.ts`) con el
  formato que pidió Kromatica (27-oct-2026): imagen del producto con una línea vertical a la derecha, líneas de texto
  ("Aplique en PVC", "Base más un color", "Tamaño 5 x 2 cms", "Corte recto") y tabla "300 uds | $1.760 + Iva la und"
  con las cantidades que tienen precio elegido. La imagen se guarda en la tabla `ImagenCotizacion` (bytes en
  Postgres; JPG o PNG, hasta 5 MB). El texto es `Cotizacion.textoCliente` (null = descripción + tamaño).
- ✅ **Login y roles** (27-oct-2026, `apps/api/src/auth`): `ADMIN` cambia parámetros, elimina cotizaciones y
  administra usuarios; `OPERARIO` hace todo lo demás. Sesión con cookie HttpOnly `kromatica_sesion` y tabla `Sesion`
  (ver `docs/decisiones.md` §11). Toda ruta exige sesión salvo `@Publica()`; las de admin llevan `@SoloAdmin()`.
  El seed crea el primer administrador con `ADMIN_USUARIO`/`ADMIN_CLAVE` de `apps/api/.env` (en el Mac del autor ya
  está configurada; si falta, el seed genera una y la muestra una vez). Se guarda quién creó cada cotización,
  quién hizo cada cambio de estado y quién registró cada parámetro.
- ✅ **Eliminar cotización** (solo admin): doble confirmación; la segunda es escribir su número (`?confirmar=` en la API).
- El tiempo real de producción es solo el **MO min real** (se quitaron las horas de producción el 27-oct-2026).
- ⬜ Modelo ML (fase 2, `ml/README.md`).
- 🔒 **Datos reales en un repositorio privado aparte** (27-oct-2026). El código es público
  (`JuanJo2804/KROMATICA-S.A.S-COTIZACIONES`, licencia MIT); el historial del Excel y los casos golden tienen
  clientes, costos y precios reales y viven en `datos-privados/` (gitignored), que es un clon del repo privado
  `JuanJo2804/KROMATICA-S.A.S-COTIZACIONES-datos`. Sin esa carpeta el seed no importa historial y las pruebas que
  lo usan se saltan. **Nunca** poner nombres de clientes, hojas o precios reales en el repo público (en pruebas y
  docs se dice "cotización de referencia"); si algo nuevo necesita datos reales, va en `datos-privados/`.
- ✅ Verificado en el Mac del autor (26-oct-2026): `pnpm db:deploy`, seed, las 3.702 pruebas y
  `docker compose --profile completo up --build` funcionan.
- En ese Mac hay un PostgreSQL del sistema en el 5432: el contenedor usa el **5434** (`.env` de la raíz con
  `DB_PUERTO=5434` y `apps/api/.env` apuntando a `localhost:5434`). Ninguno de los dos `.env` se versiona.
- Las pruebas e2e escriben en la misma BD de desarrollo con los usuarios `e2e-admin` y `e2e-operario`, y al terminar
  borran esos usuarios y lo que crearon. Quedan unas 12 cotizaciones "Cliente de prueba e2e" de corridas anteriores
  (de antes de guardar el autor).
- El proyecto vive en `~/Code/kromatica-cotizaciones` (fuera de iCloud) desde el 26-oct-2026. Antes estaba en
  `~/Documents`, y con el disco casi lleno iCloud sacaba de disco los archivos de `node_modules`: `tsc`,
  `nest build` y Prisma parecían colgados. **No volver a ponerlo en una carpeta sincronizada.** Si algo se cuelga
  sin usar CPU, revisar `find . -flags +dataless | wc -l`.
- Orden del historial: campo `Cotizacion.fecha` (DATE). En las importadas es la fecha **más reciente** de la hoja
  (ver `herramientas/importar-excel/README.md`); 17 hojas no tienen fecha y van al final. `creadaEn` es cuándo
  entró al sistema.

## Comandos

```bash
pnpm install                       # compila el motor (prepare) y genera el cliente Prisma (postinstall)
git clone https://github.com/JuanJo2804/KROMATICA-S.A.S-COTIZACIONES-datos.git datos-privados   # requiere acceso
docker compose up -d db
cd apps/api && cp .env.example .env
pnpm db:deploy && pnpm db:seed
pnpm start:dev                     # http://localhost:4000/api
pnpm dev:web                       # desde la raíz: web en http://localhost:3000 (necesita la API)
pnpm test                          # desde la raíz: motor (3.685) + API unitarias (34)
pnpm --filter @kromatica/api test:e2e   # 15 pruebas e2e, requiere BD migrada y con seed
# Sin datos-privados/ se saltan las que usan datos reales: motor 28, API 32, e2e 13 (así corre el CI)
```

Si se cambia `packages/motor-calculo/src`, recompilar (`pnpm --filter @kromatica/motor-calculo build`): la API
importa desde `dist/`.

## Reglas del dominio (confirmadas por el usuario)

- **Fórmulas**: ver `docs/formulas.md` (con la celda del Excel de cada una).
- La operaria aporta **MO min** (`planchas/hora = 60 / MO min`) y las **troqueladas por hora**
  (`$ troquelada por unidad = 60 × valor minuto / troqueladas por hora`). Los dos se pueden sugerir.
- **Tipo de corte**: corte bisturí o troquelado (enum `TipoCorte`).
- **Clisé**: se calcula con las medidas y la disposición (ver `docs/formulas.md`); los gramos por clisé salen del
  espesor × cm² del clisé. Debe caber en 25 × 30 cm.
- **Parámetros** (valor minuto, $/gramo, $/cm² clisé, horas por día) casi no cambian: se muestran en un recuadro de
  solo lectura en la cotización, no son campos del formulario. Siguen en la tabla `Parametro` con vigencia.
- **CIF y administración** se calculan a propósito sobre el subtotal de la **primera fila** de cantidad (la más
  pequeña) porque representan el costo real. En el Excel esto no es consistente (186 hojas primera fila,
  227 cada fila, 365 mezcla). Por defecto: `PRIMERA_FILA`, configurable.
- **El margen de ganancia lo decide la persona**: mostrar todas las opciones lado a lado, editables, y guardar
  la elegida y el precio enviado. Precio = costo / (1 − margen), redondeado a decenas.
- **Horas por día: 8,5** (confirmado el 26-oct-2026; parámetro `HORAS_POR_DIA` con vigencia desde esa fecha).
  El Excel usaba 10, así que los días requeridos de las cotizaciones nuevas no coinciden con los del Excel.
- **Estados**: BORRADOR → ENVIADA → APROBADA → EN_PRUEBAS (clisé + muestras) → EN_PRODUCCION → TERMINADA
  (+ RECHAZADA, CANCELADA; HISTORICA para lo importado). El tiempo real llega tarde y es opcional.
- El tipo de producto es **obligatorio** (en el Excel faltaba en el 54 % de las hojas).
- **Todos los renglones de costo del Excel se muestran como campos** (decisión del usuario del 26-oct-2026, revierte
  la idea anterior de esconderlos): troqueles hierro/madera/eléctrico, pantógrafo, material, armada, empaque, otros
  materiales y adicionales. Salen de `ConceptoCatalogo` (sección + orden); para quitar uno del formulario se marca
  `activo = false`, sin tocar código. La idea es ir retirando los que no se usen.
- Comparar con el Excel: una hoja de un aplique bisturí 4,5 × 1,2 cm es prueba de aceptación del motor ($889 / $687,69;
  el nombre real de la hoja está en `datos-privados/README.md`).
  Una cotización nueva con los mismos datos da distinto por el valor del minuto ($450 hoy vs. $435 en marzo) y por
  la política de CIF/administración por defecto (16/10/5 % y 3 %, la combinación más común; esa hoja usó 15/10 % y 5 %).
- Volumen real: unas 55 cotizaciones al mes. Por eso se descartaron Event Bus, RabbitMQ y pgvector
  (ver `docs/decisiones.md`).
- Ejemplo de referencia: **cotización de referencia** (aplique PVC 5 × 2 cm, base + 1 color) → 300 uds **$1.760**, 500 uds
  **$1.490** + IVA. Está como prueba de aceptación.

## Convenciones

- Código, nombres de dominio y comentarios en español (`cotizacion`, `calcularPrecios`…).
- Valores que cambian con el tiempo → tabla `Parametro` con `vigenteDesde`. Nunca constantes en el código.
- Cada cotización guarda un snapshot de los valores usados y la entrada completa (`entrada` JSON).
- Toda lógica de cálculo va en `motor-calculo` con pruebas. La API solo orquesta.
- El Excel original (`Cotizaciones.xlsx`, 856 hojas) no está en ningún repo. Para regenerar fixtures o el
  historial, ver `herramientas/importar-excel/README.md`.
