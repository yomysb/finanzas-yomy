-- ============================================================================
-- Etapa 5 — Control fiscal (PFAE): estado de factura e IVA desglosado
-- ============================================================================

-- financial_movements (equivalente a "expenses" en la propuesta original)
alter table financial_movements
  add column tax_status text not null default 'no_invoice'
    check (tax_status in ('no_invoice', 'pending_invoice', 'invoiced')),
  add column tax_iva_amount numeric(12,2) not null default 0
    check (tax_iva_amount >= 0);

create index idx_movements_tax_status on financial_movements(tax_status);

-- sales (equivalente a "daily_closings" — aquí "sales" ya es el registro
-- de un renglón por día, así que el IVA de venta vive ahí directamente
-- en vez de en una tabla de cierre aparte)
alter table sales
  add column sales_iva_amount numeric(12,2) not null default 0
    check (sales_iva_amount >= 0);
