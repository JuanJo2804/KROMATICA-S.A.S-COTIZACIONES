# Registro de decisiones

Formato: qué se decidió, por qué, y qué se descartó.

### 1. Monorepo con pnpm workspaces
Un solo repositorio para el motor, la API y la web. Se comparten tipos y se versiona todo junto.

### 2. El motor de cálculo es un paquete aparte y sin dependencias
`packages/motor-calculo` no conoce la base de datos ni HTTP. Así se puede probar contra las hojas del Excel
y reutilizar en el frontend para mostrar cálculos en vivo mientras se escribe.

### 3. Pruebas "golden" contra el Excel histórico
Los casos de prueba se generan automáticamente desde el Excel (`herramientas/importar-excel`). Si alguien
cambia una fórmula, 552 cotizaciones reales avisan del error.

### 4. Parámetros con fecha de vigencia, nunca en el código
Valor del minuto, horas por día, $/cm² del clisé y $/gramo viven en la tabla `Parametro`.
El valor del minuto cambió 5 veces entre 2025 y 2026 (378 → 381 → 435 → 440 → 450).

### 5. Cada cotización guarda una copia (snapshot) de lo que usó
Si sube el valor del minuto, las cotizaciones anteriores no cambian. También se guarda la entrada completa
(JSON) para reabrir y editar.

### 6. El margen lo decide la persona
El sistema muestra todas las opciones lado a lado y guarda la elegida y el precio enviado. Ese dato no existía
en el Excel y permitirá analizar qué márgenes se aprueban.

### 7. Todos los renglones del Excel como campos, desde el catálogo
Primero se escondieron los conceptos poco usados detrás de un "+ Agregar". El 26-oct-2026 el usuario pidió lo
contrario: mostrar todo lo que puede sumar en la cotización (como la plantilla) e ir retirando lo innecesario. Los
renglones salen de `ConceptoCatalogo` con su sección y orden; retirar uno es marcar `activo = false`, sin tocar código.

### 8. Ciclo de vida con estados
BORRADOR → ENVIADA → APROBADA → EN_PRUEBAS → EN_PRODUCCION → TERMINADA (+ RECHAZADA, CANCELADA).
Refleja el proceso real: aprobación, clisé y muestras, producción. El tiempo real se registra al final.

### 9. Sugerencia de MO min: vecinos cercanos primero, modelo entrenado después
- **Fase 1 (hecha):** búsqueda de las 10 cotizaciones más parecidas (tintas, tipo, montaje, tamaño) y mediana
  ponderada. Error promedio de 5,0 min, explicable, sin servicio adicional.
- **Fase 2:** Random Forest en Python (error promedio de 4,5 min en la prueba inicial). Se agrega solo si la
  mejora lo justifica.

### 10. Se descartó para esta etapa
- **Event Bus / RabbitMQ:** con ~55 cotizaciones al mes no aporta nada y suma mantenimiento.
- **pgvector / embeddings:** los datos son numéricos y categóricos, no texto.
- **TypeORM:** se eligió Prisma por tipado y migraciones más simples.

### 11. Sesiones en la base de datos y dos roles
- **Roles** (decisión del usuario, 27-oct-2026): `ADMIN` cambia los parámetros globales, elimina cotizaciones y
  administra usuarios; `OPERARIO` hace todo lo demás (cotizar, editar borradores, cambiar estados, PDF).
  La API lo exige con un guard global (`SesionGuard`): toda ruta pide sesión salvo `@Publica()`, y `@SoloAdmin()`
  pide rol de administrador. Ocultar botones en la web es solo comodidad.
- **Sesión con cookie HttpOnly y tabla `Sesion`**, no JWT: la cookie lleva un token aleatorio y la base de datos
  solo su SHA-256. Así cerrar sesión, cambiar la contraseña o desactivar a alguien corta el acceso al instante.
  Con un solo servidor y pocas personas, una consulta por petición no pesa. La web y la API comparten origen
  (rewrite de Next.js), así que basta `SameSite=Lax`.
- **Contraseñas con scrypt** (`node:crypto`), sin dependencias. 5 intentos fallidos bloquean ese usuario 10 minutos.
- **Eliminar** es definitivo (borra en cascada) y pide dos confirmaciones; la segunda es escribir el número de la
  cotización, que la API también exige (`?confirmar=`). Para lo normal está el estado CANCELADA.
- Los usuarios no se borran: se desactivan, para que su nombre siga en las cotizaciones y cambios que hicieron.

### 12. Prisma 7 con adaptador de PostgreSQL
Prisma 7 es la versión estable actual y usa un driver en JavaScript (`@prisma/adapter-pg`) en lugar del motor
binario para las consultas.

### 13. Código público, datos reales en un repositorio privado
- **Decisión del usuario (27-oct-2026):** el código se publica (`KROMATICA-S.A.S-COTIZACIONES`, licencia MIT), pero
  el historial del Excel tiene clientes, costos, márgenes y precios reales de Kromatica y no se puede compartir.
- Los tres JSON (`historial-excel.json`, `hojas-excel-cotizacion.json`, `hojas-excel-insumos.json`) viven en
  `datos-privados/`, que está en el `.gitignore` y es un clon del repositorio privado
  `KROMATICA-S.A.S-COTIZACIONES-datos`. Quien tenga acceso lo clona dentro del proyecto y todo funciona como antes.
- **Sin los datos el sistema funciona igual**: el seed crea catálogos, parámetros y el administrador, y no importa
  historial; las pruebas golden, las de precisión de las sugerencias y dos e2e se saltan. Las sugerencias de MO min
  y troquelada necesitan historial para comparar: en una instalación nueva para Kromatica hay que clonar los datos
  antes de `pnpm db:seed`. Después el historial vive en la base de datos (respaldarla).
- En pruebas y documentación pública no se nombran clientes ni hojas reales ("cotización de referencia"); la
  correspondencia está en `datos-privados/README.md`. Una vez que un dato entra al historial de git de un
  repositorio público no se puede retirar del todo, por eso nunca se versionó ahí.
