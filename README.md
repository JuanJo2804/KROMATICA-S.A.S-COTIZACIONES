# Kromatica S.A.S · Sistema de cotizaciones

[![CI](https://github.com/JuanJo2804/KROMATICA-S.A.S-COTIZACIONES/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanJo2804/KROMATICA-S.A.S-COTIZACIONES/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)
![Node 22](https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

Sistema web que reemplaza la plantilla de Excel con la que **Kromatica S.A.S** cotiza productos personalizados en
PVC y rubber: llaveros, marquillas, apliques, manillas, portavasos, haladeras, pines, diges, punteras, banderas,
correas y sellos.

Es una herramienta interna, hecha a la medida de cómo trabaja Kromatica. El código es público como portafolio; los
datos reales de la empresa **no** están en este repositorio (ver [Datos privados](#datos-privados)).

## Qué hace

1. **Calcula** costos y precios con las mismas fórmulas del Excel. Se validó contra 552 cotizaciones reales: cada
   subtotal, CIF, administración, costo total y precio coincide.
2. **Guarda** cada cotización con los valores que usó (valor del minuto, $/gramo…) y su ciclo de vida:
   borrador → enviada → aprobada → en pruebas → en producción → terminada (o rechazada / cancelada).
3. **Sugiere** el tiempo de producción (MO min) y las troqueladas por hora a partir de cotizaciones parecidas, para
   no depender solo de la experiencia de una persona. Error promedio de 5,0 min frente a 8,5 min usando el valor
   típico.
4. **Genera el PDF para el cliente** con la imagen del producto, la descripción y los precios elegidos por cantidad.
5. **Controla el acceso** con usuarios y dos perfiles: administrador y operario.

| Pantalla | Para qué |
|---|---|
| Nueva cotización | Cálculo en vivo mientras se escribe, calculadora del clisé, sugerencias de tiempo y troquelada, varias opciones de margen lado a lado |
| Historial | Búsqueda y filtros (estado, cliente, tipo de producto), paginado |
| Detalle | Elegir el precio por cantidad, cambiar el estado, registrar el tiempo real, PDF para el cliente, historial de cambios |
| Editar borrador | Reabrir una cotización que todavía no se envió |
| Parámetros | Valores globales con fecha de vigencia (valor del minuto, $/gramo, $/cm² del clisé, horas por día) |
| Usuarios | Crear usuarios, cambiar su rol o contraseña, desactivarlos (solo administrador) |

### Perfiles

| | Administrador | Operario |
|---|:-:|:-:|
| Cotizar, editar borradores, cambiar estados, generar el PDF | ✅ | ✅ |
| Cambiar parámetros globales | ✅ | — |
| Eliminar cotizaciones (con doble confirmación) | ✅ | — |
| Administrar usuarios | ✅ | — |

Los permisos los exige la API, no solo la interfaz.

## Tecnologías

| Parte | Tecnología |
|---|---|
| Motor de cálculo | TypeScript puro, sin dependencias (`packages/motor-calculo`) |
| API | NestJS 12, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 16, Swagger, pdfkit |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Pruebas | Vitest, Supertest |
| Infraestructura | pnpm workspaces, Docker Compose, GitHub Actions |

## Estructura

```
├── packages/
│   └── motor-calculo/        Cálculo puro en TypeScript (sin BD ni HTTP). El corazón del sistema.
├── apps/
│   ├── api/                  NestJS + Prisma + PostgreSQL. Ver apps/api/README.md
│   └── web/                  Next.js + Tailwind. Ver apps/web/README.md
├── ml/                       Sugerencias de tiempo: resultados y plan de la fase 2
├── herramientas/
│   └── importar-excel/       Scripts que leen el Excel histórico
├── docs/                     Fórmulas, decisiones, arquitectura, pendientes
├── datos-privados/           (no versionado) clon del repositorio privado de datos
└── docker-compose.yml
```

## Requisitos

- Node.js 22 (`.nvmrc`) y pnpm 10 (`corepack enable`)
- Docker Desktop (para PostgreSQL)
- Python 3.11+ con `openpyxl` (solo para volver a importar el Excel)

## Instalación

```bash
git clone https://github.com/JuanJo2804/KROMATICA-S.A.S-COTIZACIONES.git
cd KROMATICA-S.A.S-COTIZACIONES

# Opcional, solo con acceso: historial real de Kromatica (ver "Datos privados")
git clone https://github.com/JuanJo2804/KROMATICA-S.A.S-COTIZACIONES-datos.git datos-privados

corepack enable
pnpm install                     # compila el motor y genera el cliente de Prisma
docker compose up -d db          # PostgreSQL

cd apps/api
cp .env.example .env             # define ADMIN_USUARIO y ADMIN_CLAVE para el primer administrador
pnpm db:deploy                   # crea las tablas
pnpm db:seed                     # catálogos, parámetros, administrador y, si hay datos privados, el historial
pnpm start:dev                   # API en http://localhost:4000/api · Swagger en /api/docs

# en otra terminal, desde la raíz
pnpm dev:web                     # web en http://localhost:3000
```

Entra con el usuario y la contraseña de `ADMIN_USUARIO` / `ADMIN_CLAVE`. Si `ADMIN_CLAVE` está vacía, el seed genera
una y la muestra una sola vez en la terminal. Cámbiala después en **Mi cuenta**.

Para levantar todo con Docker (API incluida): `docker compose --profile completo up -d --build`.
Si el puerto 5432 está ocupado, crea un `.env` en la raíz con `DB_PUERTO=5434` y usa ese puerto en `apps/api/.env`.


## Pruebas

```bash
pnpm test                                # motor de cálculo + API (unitarias)
pnpm --filter @kromatica/api test:e2e    # flujo completo contra PostgreSQL (requiere migrar y seed)
```

| Suite | Qué verifica | Datos privados |
|---|---|:-:|
| `motor-calculo` · hojas del Excel | 552 cotizaciones reales: subtotal, administración, CIF, costo total y cada precio coinciden con el Excel | Sí |
| `motor-calculo` · insumos | 777 hojas: mano de obra, material, planchas por hora y días requeridos | Sí |
| `motor-calculo` · aceptación | Una cotización real enviada a un cliente da $1.760 y $1.490 | No |
| `api` · sugerencias | Con el historial real, MO min se equivoca ~5 min en promedio y la troquelada ~14 % | Sí |
| `api` · unitarias | Estados, PDF, contraseñas y cookie de sesión | No |
| `api` · e2e | Sesión y roles, calcular, guardar, editar, eliminar, elegir margen, estados, tiempo real, PDF, parámetros, usuarios | Dos pruebas |

En GitHub Actions las pruebas corren sin datos privados: las que los necesitan aparecen como saltadas.

## Documentación

- [docs/formulas.md](docs/formulas.md): todas las fórmulas, con la celda del Excel de donde sale cada una
- [docs/decisiones.md](docs/decisiones.md): por qué se eligió cada cosa
- [docs/arquitectura.puml](docs/arquitectura.puml): diagrama de despliegue (PlantUML)
- [docs/pendientes.md](docs/pendientes.md): datos por confirmar y próximos pasos
- [ml/README.md](ml/README.md): sugerencias de tiempo y troquelada, y plan del modelo entrenado
- [herramientas/importar-excel/README.md](herramientas/importar-excel/README.md): cómo regenerar los datos desde el Excel
- [apps/api/README.md](apps/api/README.md) y [apps/web/README.md](apps/web/README.md)

## Autor

**Juan José Ocampo Ramírez**, estudiante de Ingeniería de Software.

## Licencia

[MIT](LICENSE) para el código. Los datos de Kromatica S.A.S no forman parte de este repositorio ni de esta licencia.
