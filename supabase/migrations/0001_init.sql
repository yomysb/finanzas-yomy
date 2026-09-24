-- ============================================================================
-- Etapa 1 — Fundación
-- Sistema de gestión financiera para negocios pequeños
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- businesses: preparación multi-negocio. Fase 1 = un solo registro activo.
-- ----------------------------------------------------------------------------
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- users_profile: complementa auth.users de Supabase con rol de negocio.
-- ----------------------------------------------------------------------------
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id),
  role text not null default 'admin' check (role in ('admin', 'capturista', 'lectura')),
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- movement_types: catálogo semilla de reglas contables. No editable por
-- el usuario en fase 1 (las reglas affects_cash_flow / affects_result son
-- responsabilidad del diseño financiero, no de captura).
-- ----------------------------------------------------------------------------
create table movement_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sign text not null default 'salida' check (sign in ('entrada', 'salida')),
  affects_cash_flow boolean not null default true,
  affects_result text not null default 'si' check (affects_result in ('si', 'no', 'diferido')),
  requires_supplier boolean not null default true,
  requires_category boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0
);

insert into movement_types (code, name, sign, affects_cash_flow, affects_result, requires_supplier, requires_category, sort_order) values
  ('purchase_merchandise', 'Compra de mercancía / materia prima', 'salida', true, 'diferido', true, true, 1),
  ('operating_expense',    'Gasto operativo',                      'salida', true, 'si',       true, true, 2),
  ('extraordinary_expense','Gasto extraordinario',                 'salida', true, 'si',       true, true, 3),
  ('asset_investment',     'Inversión / adquisición de activo',    'salida', true, 'no',       true, false, 4),
  ('debt_payment',         'Pago de capital de deuda',             'salida', true, 'no',       false, false, 5),
  ('interest_expense',     'Intereses / gastos financieros',       'salida', true, 'si',       false, false, 6),
  ('owner_withdrawal',     'Retiro del propietario',                'salida', true, 'no',       false, false, 7),
  ('other',                'Otros',                                 'salida', true, 'si',       false, false, 8);

-- ----------------------------------------------------------------------------
-- business_types: giros de proveedor (catálogo administrable)
-- ----------------------------------------------------------------------------
create table business_types (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

-- ----------------------------------------------------------------------------
-- payment_methods: catálogo administrable
-- ----------------------------------------------------------------------------
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

-- ----------------------------------------------------------------------------
-- expense_categories: catálogo administrable, con subcategoría opcional
-- (auto-relación vía parent_category_id)
-- ----------------------------------------------------------------------------
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  name text not null,
  description text,
  parent_category_id uuid references expense_categories(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name, parent_category_id)
);

create index idx_expense_categories_parent on expense_categories(parent_category_id);

-- ----------------------------------------------------------------------------
-- suppliers: catálogo administrable
-- ----------------------------------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  name text not null,
  legal_name text,
  tax_id text,
  phone text,
  contact text,
  business_type_id uuid references business_types(id),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create index idx_suppliers_business_type on suppliers(business_type_id);

-- ----------------------------------------------------------------------------
-- sales: registro diario de ventas
-- ----------------------------------------------------------------------------
create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  sale_date date not null,
  num_orders int not null default 0 check (num_orders >= 0),
  num_products int not null default 0 check (num_products >= 0),
  cash_amount numeric(12,2) not null default 0 check (cash_amount >= 0),
  card_amount numeric(12,2) not null default 0 check (card_amount >= 0),
  transfer_amount numeric(12,2) not null default 0 check (transfer_amount >= 0),
  total_amount numeric(12,2) generated always as (cash_amount + card_amount + transfer_amount) stored,
  pos_reported_total numeric(12,2),
  pos_difference numeric(12,2) generated always as
    (coalesce(pos_reported_total, cash_amount + card_amount + transfer_amount) - (cash_amount + card_amount + transfer_amount)) stored,
  notes text,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sale_date)
);

-- ----------------------------------------------------------------------------
-- financial_movements: toda salida de dinero del negocio (antes "expenses")
-- ----------------------------------------------------------------------------
create table financial_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  movement_date date not null,
  movement_type_id uuid not null references movement_types(id),
  supplier_id uuid references suppliers(id),
  category_id uuid references expense_categories(id),
  payment_method_id uuid not null references payment_methods(id),
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_movements_date on financial_movements(movement_date);
create index idx_movements_type on financial_movements(movement_type_id);
create index idx_movements_supplier on financial_movements(supplier_id);
create index idx_movements_category on financial_movements(category_id);
-- Apoyo para detección de posibles duplicados (fecha + proveedor + monto)
create index idx_movements_dup_check on financial_movements(movement_date, supplier_id, amount);

-- ----------------------------------------------------------------------------
-- operation_days: cierre diario
-- ----------------------------------------------------------------------------
create table operation_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  operation_date date not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'capturado', 'conciliado', 'cerrado')),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  notes text,
  unique (business_id, operation_date)
);

-- ----------------------------------------------------------------------------
-- attachments: comprobantes ligados a un movimiento financiero
-- ----------------------------------------------------------------------------
create table attachments (
  id uuid primary key default gen_random_uuid(),
  financial_movement_id uuid not null references financial_movements(id) on delete cascade,
  file_url text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- audit_log: registro de cualquier modificación a transacciones financieras
-- ----------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  field_changed text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  reason text
);

create index idx_audit_log_record on audit_log(table_name, record_id);

-- ============================================================================
-- Row Level Security: cada usuario solo ve datos de su business_id
-- ============================================================================
alter table businesses enable row level security;
alter table user_profiles enable row level security;
alter table business_types enable row level security;
alter table payment_methods enable row level security;
alter table expense_categories enable row level security;
alter table suppliers enable row level security;
alter table sales enable row level security;
alter table financial_movements enable row level security;
alter table operation_days enable row level security;
alter table attachments enable row level security;
alter table audit_log enable row level security;

create or replace function current_business_id()
returns uuid language sql stable as $$
  select business_id from user_profiles where id = auth.uid()
$$;

create policy "own business" on businesses for select using (id = current_business_id());
create policy "own profile" on user_profiles for select using (business_id = current_business_id());

create policy "biz rw" on business_types for all using (business_id = current_business_id()) with check (business_id = current_business_id());
create policy "biz rw" on payment_methods for all using (business_id = current_business_id()) with check (business_id = current_business_id());
create policy "biz rw" on expense_categories for all using (business_id = current_business_id()) with check (business_id = current_business_id());
create policy "biz rw" on suppliers for all using (business_id = current_business_id()) with check (business_id = current_business_id());
create policy "biz rw" on sales for all using (business_id = current_business_id()) with check (business_id = current_business_id());
create policy "biz rw" on financial_movements for all using (business_id = current_business_id()) with check (business_id = current_business_id());
create policy "biz rw" on operation_days for all using (business_id = current_business_id()) with check (business_id = current_business_id());

create policy "attachments via movement" on attachments for all using (
  financial_movement_id in (select id from financial_movements where business_id = current_business_id())
) with check (
  financial_movement_id in (select id from financial_movements where business_id = current_business_id())
);

create policy "audit read own business" on audit_log for select using (
  (table_name = 'sales' and record_id in (select id from sales where business_id = current_business_id()))
  or (table_name = 'financial_movements' and record_id in (select id from financial_movements where business_id = current_business_id()))
);

-- ============================================================================
-- Trigger genérico de auditoría para sales y financial_movements
-- ============================================================================
create or replace function log_financial_change()
returns trigger language plpgsql as $$
declare
  cols text[] := array['movement_date','amount','payment_method_id','supplier_id','category_id','movement_type_id',
                        'sale_date','cash_amount','card_amount','transfer_amount','pos_reported_total','voided_at','void_reason'];
  c text;
  old_val text;
  new_val text;
begin
  foreach c in array cols loop
    execute format('select ($1).%I::text', c) using old into old_val;
    execute format('select ($1).%I::text', c) using new into new_val;
    if old_val is distinct from new_val then
      insert into audit_log (table_name, record_id, field_changed, old_value, new_value, changed_by)
      values (tg_table_name, new.id, c, old_val, new_val, auth.uid());
    end if;
  end loop;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger trg_audit_sales before update on sales
  for each row execute function log_financial_change();

create trigger trg_audit_movements before update on financial_movements
  for each row execute function log_financial_change();

drop policy "own profile" on user_profiles;

create policy "own profile" on user_profiles
  for select
  using (id = auth.uid());