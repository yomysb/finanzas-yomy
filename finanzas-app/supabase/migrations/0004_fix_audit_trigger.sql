-- ============================================================================
-- Fix: el trigger de auditoría usaba la misma lista de columnas para
-- "sales" y "financial_movements", pero cada tabla tiene columnas
-- distintas. Al anular o editar una venta, intentaba leer columnas que
-- no existen en "sales" (movement_date, supplier_id, etc.) y la
-- actualización fallaba.
-- ============================================================================

create or replace function log_financial_change()
returns trigger language plpgsql as $$
declare
  cols text[];
  c text;
  old_val text;
  new_val text;
begin
  if tg_table_name = 'sales' then
    cols := array['sale_date','cash_amount','card_amount','transfer_amount','pos_reported_total','voided_at','void_reason'];
  elsif tg_table_name = 'financial_movements' then
    cols := array['movement_date','amount','payment_method_id','supplier_id','category_id','movement_type_id','voided_at','void_reason'];
  else
    cols := array[]::text[];
  end if;

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
