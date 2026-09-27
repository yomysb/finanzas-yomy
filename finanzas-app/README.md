# Finanzas — Etapa 1 + 2 + 3 (Fundación, Captura, Análisis)

App de gestión financiera para negocios pequeños: separa ventas, movimientos
financieros (compras/gastos/inversiones), flujo de efectivo y resultado, con
catálogos maestros para evitar datos inconsistentes.

Esta entrega cubre **Etapa 1**: autenticación, esquema completo de base de
datos (incluye las tablas que usarán las etapas 2–4) y los catálogos
administrables: **proveedores, categorías de gasto (con subcategoría) y
configuración (formas de pago, giros de proveedor)**.

**Etapa 2** ya está incluida: captura de **ventas** diarias (con detección de
duplicado por fecha), captura de **compras y gastos** (`financial_movements`,
con tipo de movimiento dinámico, proveedor/categoría, comprobante en foto o
PDF, y aviso no bloqueante de posible duplicado por fecha+proveedor+monto), y
**cierre diario** con los cuatro estados (pendiente → capturado → conciliado
→ cerrado).

Reportes y dashboard financiero con indicadores/gráficas siguen como
pantallas "próximamente" — eso es Etapa 3, sobre los datos que ya se están
capturando aquí.

## Paso extra para la Etapa 2: bucket de comprobantes

Antes de subir fotos de tickets, corre también
`supabase/migrations/0003_storage.sql` en el SQL Editor de Supabase. Crea el
bucket privado `receipts` y sus políticas (cada negocio solo puede subir/ver
sus propios comprobantes, aislados por carpeta `{business_id}/...`).

## Fixes posteriores a la Etapa 2

Corre también, en orden, `0004_fix_audit_trigger.sql` y
`0005_fix_audit_log_rls.sql` — corrigen el trigger de auditoría (usaba la
misma lista de columnas para `sales` y `financial_movements`) y el permiso
de `audit_log` (le faltaba política de INSERT). Sin esto, editar o anular
una venta o movimiento falla.

## Etapa 3: Panel, reportes y gráficas

- **Panel** (`/dashboard`) — selector de periodo (hoy, semana, mes,
  personalizado, etc.) y los tres bloques separados: Ventas, Resultado
  (etiquetado "estimado"), Flujo de efectivo — cada uno comparado contra el
  periodo inmediato anterior. Debajo, indicadores secundarios (tickets,
  ticket promedio, gasto promedio diario) y alertas basadas en datos (días
  con gasto sin venta, posibles duplicados, gastos creciendo más rápido que
  ventas, margen a la baja).
- **Reportes** (`/reportes`) — mismo selector de periodo, con pestañas:
  Ventas, Compras y gastos, Por proveedor (con % del total), Por categoría,
  y Gráficas (ventas vs. gastos por día, ventas por forma de pago, gastos
  por categoría, top proveedores).

Todavía sin exportar a Excel/PDF ni importar desde el POS — eso sigue
pendiente para una etapa futura.

## Tema claro/oscuro automático

El tema sigue `prefers-color-scheme` del sistema operativo — no hay un
switch manual en la app. En iOS, macOS, Windows y Android puedes configurar
"Automático" en la apariencia del sistema para que cambie solo según la
hora; la app hereda eso sin código adicional.

## Etapa 4: exportación e importación

- **Exportar** — en Ventas, Compras y gastos, y cada pestaña de Reportes
  (Ventas, Compras y gastos, Por proveedor, Por categoría) hay botones
  **XLSX / CSV / PDF** que descargan exactamente lo que está filtrado en
  pantalla.
- **Importar ventas** — botón "Importar CSV" en Ventas: sube un archivo,
  muestra una vista previa fila por fila marcando cuáles son nuevas y
  cuáles van a actualizar un día existente, detecta errores (fecha
  inválida, montos negativos) sin bloquear el resto, y deja
  incluir/excluir filas antes de confirmar. Columnas esperadas: Fecha,
  Órdenes, Productos, Efectivo, Tarjeta, Transferencia, Notas.

### Nota de seguridad sobre `xlsx`

El paquete `xlsx` (SheetJS) publicado en npm tiene dos vulnerabilidades
conocidas sin parche disponible ahí (`GHSA-4r6h-8v6p-xvw6`,
`GHSA-5pgg-2g8v-p4x9`), ambas relacionadas con **leer** archivos
maliciosos. Por eso en esta app `xlsx` solo se usa para **generar**
(escribir) los archivos de exportación — nunca para leer archivos que
suba el usuario. La importación de ventas usa `papaparse` (sin
vulnerabilidades conocidas) y por ahora **solo acepta CSV**, no `.xlsx`
directamente; si tu archivo viene de Excel, expórtalo como CSV primero
(Archivo → Guardar como → CSV). Si SheetJS libera una versión parchada en
npm, se puede habilitar importación de `.xlsx` sin cambiar el resto del
diseño.

## Etapa 5: control fiscal (PFAE)

Corre también `supabase/migrations/0006_fiscal.sql` — agrega a `financial_movements`
las columnas `tax_status` ('no_invoice' / 'pending_invoice' / 'invoiced') y
`tax_iva_amount`, y a `sales` la columna `sales_iva_amount`.

- **Compras y gastos** — cada movimiento ahora tiene un estado fiscal
  (Sin factura / Pendiente de facturar / Facturado) y un campo opcional de
  IVA desglosado, para tickets mixtos (parte tasa 0%, parte 16%).
- **Pestaña "Pendientes de facturar"** — filtro con badge de conteo dentro
  de Compras y gastos, con botón de un clic "Marcar como facturado".
- **Tarjeta "Reserva fiscal y utilidad neta real (PFAE)"** en el Panel —
  IVA de ventas vs. IVA acreditable (solo de movimientos "Facturado"), IVA
  a pagar estimado, base gravable e ISR estimado con la tarifa progresiva
  real del Art. 96 LISR (tabla en `src/lib/isr-table.ts`, vigente para
  2026), prorrateada a los días del periodo seleccionado.

**Limitaciones que debes conocer, no son bugs:**
- El ISR real de un PFAE se calcula **acumulado desde enero** (ingresos y
  deducciones del año a la fecha, menos pagos provisionales ya hechos).
  Esta tarjeta calcula el periodo seleccionado de forma aislada y
  prorratea la tarifa mensual a esos días — es una referencia, no el
  cálculo oficial.
- La tabla del Art. 96 vive en `src/lib/isr-table.ts`, con el año marcado.
  El SAT la actualiza cada diciembre por inflación — hay que actualizar
  ese archivo cada año.
- Nada de esto sustituye a tu contador. Antes de tomar decisiones de
  retiro de utilidades o pagos provisionales reales, confirma las cifras
  con él.

## Etapa 6: provisión de reserva fiscal (datos reales, sin simulación)

Corre también `supabase/migrations/0007_fiscal_reserve_status.sql` — crea
`fiscal_reserve_status`, que **solo guarda el checkbox** de "ya aparté el
efectivo" por mes. Los montos de IVA/ISR nunca se guardan ahí: siempre se
calculan en vivo desde `sales` y `financial_movements` reales, cada vez que
se carga el Panel.

Nueva tarjeta "Provisión de reserva fiscal y liquidez real" en el Panel,
siempre sobre el **mes en curso** (independiente del selector de periodo de
arriba):
- Reserva fiscal sugerida del mes (IVA a pagar + ISR estimado, ambos con
  tus cifras reales acumuladas del 1 al día de hoy).
- Apartado diario recomendado (reserva ÷ días transcurridos del mes).
- Utilidad neta disponible (limpia): ventas − gastos reales − reserva.
- Cobertura CFDI: % de tus gastos del mes que ya están marcados
  "Facturado".
- Fecha límite de pago (día 17 del mes siguiente) y un checkbox para
  marcar cuando ya apartaste el dinero en una cuenta separada.

**Nota:** en una etapa anterior de este proyecto se consideró (y se
rechazó) un "simulador" que permitía elegir declarar solo un % de las
ventas reales al SAT para proyectar un ahorro de impuestos — eso es
evasión fiscal, no planeación, y no está ni estará en esta app. Todo lo
que ves aquí parte del 100% de tus ventas y gastos reales.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL + Auth + Row Level Security)

## 1. Crear el proyecto en Supabase

1. Crea un proyecto en supabase.com.
2. En **SQL Editor**, ejecuta el contenido de
   `supabase/migrations/0001_init.sql`. Esto crea todas las tablas, el
   catálogo semilla de `movement_types` (con sus reglas de flujo/resultado
   ya resueltas) y las políticas de seguridad (RLS).

## 2. Variables de entorno

Copia `.env.example` a `.env.local` y llena con los datos de
**Project Settings → API** de tu proyecto Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Crear tu primer usuario y negocio

1. En Supabase, ve a **Authentication → Users → Add user** y crea tu
   usuario admin (correo + contraseña).
2. En **SQL Editor**, sigue la plantilla de
   `supabase/migrations/0002_seed_first_business.sql.example` para crear tu
   negocio y vincular tu usuario como `admin`. (No es una migración
   automática a propósito — el nombre del negocio y tu user id son tuyos.)

## 4. Correr en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` — te pedirá iniciar sesión y luego irás al
Panel, donde verás el checklist de catálogos.

## 5. Desplegar

Conecta el repositorio a Vercel, agrega las mismas variables de entorno del
paso 2, y despliega. Nada más que configurar — no hay servidor propio que
mantener.

> Nota: `next/font` descarga las tipografías (Fraunces, Work Sans, IBM Plex
> Mono) desde Google Fonts durante `npm run build`. Esto requiere acceso a
> internet en el entorno donde compiles (funciona normal en Vercel y en
> desarrollo local); si compilas detrás de un proxy restringido, next/font
> lo señalará con un error claro.

## Decisiones de arquitectura relevantes

- **`financial_movements`** reemplaza el concepto genérico de "gastos": cada
  movimiento tiene un `movement_type` (compra de mercancía, gasto operativo,
  gasto extraordinario, inversión, pago de deuda, intereses, retiro del
  propietario, otros) cuyas reglas de `affects_cash_flow` / `affects_result`
  viven en el catálogo `movement_types`, no se capturan por movimiento.
- **RLS por `business_id`**: aunque hoy hay un solo negocio, el esquema ya
  aísla los datos por negocio — necesario si en el futuro administras más de
  uno.
- **Soft delete** (`is_active`) en catálogos; **anulación** (`voided_at` +
  `void_reason`) en `sales`/`financial_movements` en vez de edición o borrado
  silencioso — con trigger de auditoría (`audit_log`) sobre los campos
  monetarios y de fecha.
- **`operation_days`** queda listo para el cierre diario de la Etapa 2.
