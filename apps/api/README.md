# API · Kromatica Cotizaciones

NestJS 12 + Prisma 7 + PostgreSQL 16. Usa el paquete `@kromatica/motor-calculo` para todos los cálculos.

## Arrancar en desarrollo

```bash
# desde la raíz del monorepo
pnpm install
docker compose up -d db          # PostgreSQL en localhost:5432

cd apps/api
cp .env.example .env
pnpm db:deploy                   # crea las tablas (migraciones)
pnpm db:seed                     # catálogos, parámetros, administrador y, si existe datos-privados/, 842 cotizaciones del Excel
pnpm start:dev                   # http://localhost:4000/api
```

Documentación interactiva (Swagger): http://localhost:4000/api/docs

## Rutas principales

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/api/cotizaciones/calcular` | Vista previa: costos, opciones de margen y días de producción, sin guardar |
| POST | `/api/cotizaciones` | Guarda una cotización en BORRADOR |
| GET | `/api/cotizaciones` | Historial con filtros (estado, cliente, tipo, texto) |
| GET | `/api/cotizaciones/:id` | Detalle con opciones de precio |
| PUT | `/api/cotizaciones/:id` | Recalcula un borrador |
| PATCH | `/api/cotizaciones/:id/margenes` | Registra el margen elegido por cantidad |
| PATCH | `/api/cotizaciones/:id/estado` | Enviada → aprobada → en pruebas → producción → terminada |
| PATCH | `/api/cotizaciones/:id/tiempo-real` | Tiempo real de producción |
| GET | `/api/sugerencias/tiempo` | Sugiere MO min a partir de cotizaciones parecidas |
| GET/POST | `/api/parametros` | Valor del minuto, horas por día… con fecha de vigencia |
| GET | `/api/catalogos/*` | Tipos de producto, conceptos, espesores, políticas de precio |

## Pruebas

```bash
pnpm test        # unitarias (estados, PDF, contraseñas; similitud contra el historial real si hay datos-privados/)
pnpm test:e2e    # flujo completo contra la base de datos (requiere migrar y seed)
```
