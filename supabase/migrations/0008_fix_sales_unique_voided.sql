-- ============================================================================
-- Fix: la restricción única de sales(business_id, sale_date) bloqueaba
-- crear una venta nueva en una fecha cuya venta anterior ya estaba
-- anulada (voided_at no es null). Se reemplaza por un índice único
-- parcial que solo aplica a ventas activas.
-- ============================================================================

alter table sales drop constraint if exists sales_business_id_sale_date_key;

create unique index if not exists idx_sales_business_date_active
  on sales(business_id, sale_date)
  where voided_at is null;
