-- ============================================================================
-- Etapa 2 — Storage para comprobantes de compras/gastos
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Convención de ruta: {business_id}/{financial_movement_id}/{filename}
-- Así podemos aislar por negocio sin agregar columnas a storage.objects.

create policy "business can upload its receipts"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = current_business_id()::text
  );

create policy "business can read its receipts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = current_business_id()::text
  );

create policy "business can delete its receipts"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = current_business_id()::text
  );
