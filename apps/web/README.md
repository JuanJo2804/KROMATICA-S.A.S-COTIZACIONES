# Web · Kromatica Cotizaciones

Next.js 16 (App Router) + Tailwind 4. Consume la API de `apps/api`.

```bash
pnpm dev:api     # desde la raíz: API en http://localhost:4000
pnpm dev:web     # desde la raíz: web en http://localhost:3000
```

El navegador llama a `/api/*` y Next.js lo reenvía a la API (`rewrites` en `next.config.ts`), así que no
hace falta CORS. Para apuntar a otra API: `API_URL=http://otra:4000 pnpm dev`.

## Estructura

```
src/
├── app/cotizaciones/         Historial (portada)
├── app/cotizaciones/nueva/   Pantalla "Nueva cotización"
├── app/cotizaciones/[id]/    Detalle: precios, estado, tiempo real
├── app/cotizaciones/[id]/editar/  Editar un borrador (reusa el formulario de "Nueva cotización")
├── app/parametros/           Parámetros con fecha de vigencia
├── componentes/              Campos, tabla de precios, sugerencia de tiempo, listas de ítems
└── lib/
    ├── api.ts                Cliente y tipos de la API
    ├── calculo.ts            Cálculo en vivo con @kromatica/motor-calculo (en el navegador)
    ├── estados.ts            Estados de la cotización: nombre y color
    └── formato.ts            Formatos es-CO ($1.760, 30 %)
```

## Cálculo en vivo

El motor corre en el navegador: cada tecla recalcula costos y precios sin llamar al servidor.
`lib/calculo.ts` completa los datos con los parámetros vigentes y la política de precios **igual que
`CalculoService` de la API**. Si cambia uno, hay que cambiar el otro. Al guardar, la API vuelve a calcular y
eso es lo que queda registrado.

## Sesión y permisos

- `src/proxy.ts`: sin la cookie `kromatica_sesion`, cualquier página lleva a `/login?siguiente=…`. Es una revisión
  rápida; la API valida la sesión y el rol en cada petición. Si la sesión vence, `lib/api.ts` lleva a `/login` al
  primer 401.
- `lib/sesion.tsx` (`useSesion()`): quién tiene la sesión y si es administrador, para ocultar lo que no puede hacer
  (registrar parámetros, eliminar, usuarios). Se lee `window.location` y no `usePathname` para no bloquear el
  prerender del layout.
- Pantallas: `/login`, `/cuenta` (cambiar la contraseña propia) y `/usuarios` (solo administradores: crear, cambiar
  rol o contraseña, desactivar).

## Pantallas del MVP

1. ✅ **Nueva cotización**: datos del producto (tipo de corte: bisturí o troquelado), "Dimensiones del producto"
   (medidas, cuántas unidades van a lo largo y a lo ancho, y la tabla de gramos por cm² de cada espesor: de ahí salen
   el área y el costo del clisé, el montaje y los gramos), todos los renglones de costo del Excel por sección (1.
   Troqueles, 2. Clisé, 6. Material, 7. Armada, 8. Empaque, 9. Otros materiales, Adicionales) desde el catálogo, "sugerir tiempo" y "sugerir troqueladas por hora" (`GET /api/sugerencias/tiempo` y
   `/troquelada`), cantidades, tabla de márgenes editable con cálculo en vivo, elegir (o desmarcar) el precio por cantidad y
   guardar como borrador. Los parámetros (valor del minuto, $/gramo, $/cm² del clisé, horas por día) se muestran
   en el recuadro "Valores fijos" y no se editan en el formulario.
2. ✅ **Historial** (`/cotizaciones`, la portada): lista paginada con filtros por estado, tipo de producto y
   texto (cliente, referencia, descripción). Los filtros viven en la URL (`?estado=BORRADOR&tipo=pin`) y se
   cambian con `history.replaceState`, no con `router.replace`, para que dos cambios seguidos no se pisen.
3. ✅ **Detalle** (`/cotizaciones/:id`, se abre desde el historial o al guardar): precios por cantidad (en
   borrador se elige o se quita el precio con un clic y se guarda al instante; `margenOrden: null` lo quita),
   cambio de estado con nota (solo los botones de las transiciones permitidas; "enviada" exige precio en todas las
   cantidades), tiempo real de producción (en producción o terminada, comparado con el MO min estimado), datos del
   producto, costos por concepto, valores usados (snapshot), historial de estados con quién hizo cada cambio y, para
   administradores, **eliminar** con doble confirmación (escribir el número de la cotización).
   **PDF para el cliente** (sección del detalle): subir la imagen del producto (botón o arrastrar; JPG o PNG hasta
   5 MB), editar las líneas de texto (por defecto: la descripción partida por comas + "Tamaño A x B cms") y "Ver PDF"
   (`GET /api/cotizaciones/:id/pdf`, lo genera la API con pdfkit). Solo lleva las cantidades con precio elegido.
5. ✅ **Editar borrador** (`/cotizaciones/:id/editar`, botón "Editar borrador" en el detalle): abre el mismo
   formulario con los datos guardados. `formularioDesdeCotizacion` reconstruye el formulario desde `entrada` (lo
   inverso de `construirSolicitud`): los renglones con nombre o código del catálogo vuelven a su campo y el resto
   queda como "Otro"; el área, el montaje, los gramos y el espacio quedan vacíos si coinciden con lo calculado, para
   que sigan recalculándose. Al guardar se usa `PUT` (recalcula con los parámetros vigentes hoy y quita los
   precios elegidos) y luego se vuelven a enviar las elecciones. **Si cambia `construirSolicitud`, cambiar también
   `formularioDesdeCotizacion`.**
4. ✅ **Parámetros** (`/parametros`): valor vigente e historial de cada parámetro; registrar un valor nuevo con
   fecha de vigencia (misma fecha = reemplaza). Las cotizaciones guardadas no cambian.

Nota: el detalle lee `params` dentro de `<Suspense>` (exigencia de Next 16 con prerender parcial). Si se abre en
una pestaña oculta, React espera un `requestAnimationFrame` para mostrar el contenido; no es un error.
