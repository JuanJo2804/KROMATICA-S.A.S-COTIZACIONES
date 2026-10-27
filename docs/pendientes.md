# Pendientes

## Datos por confirmar con el negocio

- [ ] **Horas de trabajo por día.** Hoy `HORAS_POR_DIA = 10` (lo que usa el Excel). Confirmar horas semanales
      y días laborales reales. La jornada legal en Colombia es de 42 h/semana desde el 15-jul-2026.
      Se cambia con `POST /api/parametros` sin tocar código.
- [ ] Revisar los valores sugeridos del catálogo de conceptos (salieron de los valores más frecuentes de 2026).
- [ ] Revisar la política de precios por defecto: CIF 16/10/5 % sobre la primera fila, administración 3 %,
      márgenes 35/30/25/20 %.

## Próximos pasos técnicos

1. ✅ **Frontend (Next.js + Tailwind)**: nueva cotización, historial, detalle, editar borrador, parámetros.
2. ✅ **PDF para el cliente** con imagen del producto.
3. ✅ **Autenticación y roles**: administrador y operario (27-oct-2026). Si más adelante se necesitan más perfiles
   (comercial, producción), se agrega un valor al enum `Rol` y se marca qué rutas permite.
4. **Fase 2 de IA** (`ml/`): entrenar el modelo cuando haya tiempos reales registrados.
5. **CI**: el workflow `.github/workflows/ci.yml` ya corre las pruebas en cada push.
   En GitHub corre **sin** `datos-privados/`: las pruebas que usan datos reales se saltan. Las golden se corren en
   local antes de cambiar el motor.
