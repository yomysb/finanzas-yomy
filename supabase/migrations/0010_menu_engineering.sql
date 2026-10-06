-- Ingeniería de Menú y Análisis de Precios
-- Catálogo de categorías de menú (independiente de expense_categories: una clasifica
-- gasto, la otra clasifica producto vendido — mezclarlas obligaría a usar categorías
-- de gasto para nombrar platillos, o viceversa).
create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create index idx_menu_categories_business on menu_categories(business_id);

alter table menu_categories enable row level security;

create policy "biz rw" on menu_categories
  for all using (business_id = current_business_id())
  with check (business_id = current_business_id());

-- Productos de menú: costo, precio y supuestos de comisión/margen objetivo.
-- Los campos derivados (utilidad, margen, markup, precio sugerido) NO se guardan:
-- se recalculan siempre a partir de production_cost/sale_price/tpv_commission_pct/
-- target_margin_pct, para que nunca queden desincronizados.
create table menu_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  category_id uuid references menu_categories(id),
  production_cost numeric(10, 2) not null default 0 check (production_cost >= 0),
  sale_price numeric(10, 2) not null default 0 check (sale_price >= 0),
  tpv_commission_pct numeric(5, 2) not null default 2.2 check (tpv_commission_pct >= 0),
  target_margin_pct numeric(5, 2) not null default 50 check (target_margin_pct >= 0 and target_margin_pct < 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create index idx_menu_products_business on menu_products(business_id);
create index idx_menu_products_category on menu_products(category_id);

alter table menu_products enable row level security;

create policy "biz rw" on menu_products
  for all using (business_id = current_business_id())
  with check (business_id = current_business_id());

create or replace function touch_menu_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_menu_products_updated_at
  before update on menu_products
  for each row execute function touch_menu_product_updated_at();
