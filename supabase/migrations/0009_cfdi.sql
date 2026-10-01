-- ============================================================================
-- Etapa 7 — Registrar gastos desde factura (CFDI XML)
-- ============================================================================

-- RFC del propio negocio, para poder avisar si un CFDI subido no está a
-- nombre de este negocio (receptor distinto).
alter table businesses add column rfc text;

-- Identificador único del CFDI (folio fiscal / UUID del timbre) y el RFC
-- de quien lo emitió. cfdi_uuid es NULL para movimientos capturados a mano
-- (sin factura) — solo se llena cuando el movimiento viene de un XML.
alter table financial_movements
  add column cfdi_uuid text,
  add column cfdi_issuer_rfc text;

-- Evita registrar el mismo CFDI dos veces por error (por negocio, y solo
-- entre movimientos activos — uno anulado libera el folio, igual que con
-- las ventas).
create unique index idx_movements_cfdi_uuid_active
  on financial_movements(business_id, cfdi_uuid)
  where cfdi_uuid is not null and voided_at is null;
