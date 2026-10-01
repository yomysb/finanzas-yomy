-- ============================================================================
-- Fix: audit_log tiene RLS activado pero nunca se le agregó una policy de
-- INSERT, así que el trigger de auditoría (que corre con los permisos del
-- usuario autenticado, no como superusuario) no podía escribir ahí, y la
-- transacción completa (anular/editar una venta o movimiento) fallaba.
--
-- La función pasa a SECURITY DEFINER: se ejecuta con los permisos de quien
-- la creó (no del usuario), así que puede escribir en audit_log sin
-- necesitar una policy adicional. Es seguro porque la función no recibe
-- table_name/record_id como parámetros arbitrarios del usuario — siempre
-- usa TG_TABLE_NAME y el id de la fila que ya pasó la policy de UPDATE de
-- su propia tabla (sales o financial_movements).
-- ============================================================================

alter function log_financial_change() security definer;
alter function log_financial_change() set search_path = public;
