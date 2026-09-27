-- ============================================================================
-- Etapa 6 — Provisión de reserva fiscal: solo guarda el checkbox de
-- "ya aparté el efectivo"; los montos de IVA/ISR NUNCA se guardan aquí,
-- siempre se calculan en vivo desde sales/financial_movements reales.
-- ============================================================================

create table fiscal_reserve_status (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  period_month date not null, -- primer día del mes, ej. 2026-09-01
  is_reserved boolean not null default false,
  reserved_at timestamptz,
  reserved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, period_month)
);

alter table fiscal_reserve_status enable row level security;

create policy "biz rw" on fiscal_reserve_status
  for all
  using (business_id = current_business_id())
  with check (business_id = current_business_id());
