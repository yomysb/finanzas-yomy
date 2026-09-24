# Finanzas — Etapa 1 (Fundación)

App de gestión financiera para negocios pequeños: separa ventas, movimientos
financieros (compras/gastos/inversiones), flujo de efectivo y resultado, con
catálogos maestros para evitar datos inconsistentes.

Esta entrega cubre **Etapa 1**: autenticación, esquema completo de base de
datos (incluye las tablas que usarán las etapas 2–4) y los catálogos
administrables: **proveedores, categorías de gasto (con subcategoría) y
configuración (formas de pago, giros de proveedor)**.

Ventas, compras/gastos, reportes y dashboard financiero son pantallas
"próximamente" — la Etapa 2 las activa sobre este mismo esquema, sin
migraciones adicionales.

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
