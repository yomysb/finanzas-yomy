"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button, Card, Pill } from "@/components/ui/primitives";
import { getExistingSaleDates, importSales, type ImportSaleRow } from "./import-actions";

type PreviewRow = ImportSaleRow & {
  rowIndex: number;
  status: "nuevo" | "actualizará" | "error";
  error?: string;
  include: boolean;
};

const HEADER_ALIASES: Record<string, keyof ImportSaleRow> = {
  fecha: "sale_date",
  "numero de ordenes": "num_orders",
  "número de órdenes": "num_orders",
  ordenes: "num_orders",
  órdenes: "num_orders",
  tickets: "num_orders",
  "numero de tickets": "num_orders",
  "cantidad de productos": "num_products",
  productos: "num_products",
  efectivo: "cash_amount",
  tarjeta: "card_amount",
  transferencia: "transfer_amount",
  notas: "notes",
};

function normalizeKey(h: string) {
  return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export default function ImportSales({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setSummary(null);
    const existingDates = new Set(await getExistingSaleDates());

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError("No se pudo leer el archivo. Revisa que sea un CSV válido.");
          return;
        }
        const mapped: PreviewRow[] = results.data.map((raw, i) => {
          const record: Partial<ImportSaleRow> = {};
          for (const [rawKey, value] of Object.entries(raw)) {
            const canonical = HEADER_ALIASES[normalizeKey(rawKey)];
            if (!canonical) continue;
            if (canonical === "sale_date") record.sale_date = value;
            else if (canonical === "notes") record.notes = value || null;
            else (record as Record<string, number>)[canonical] = parseNumber(value);
          }

          const saleDate = record.sale_date ? parseDate(record.sale_date) : null;
          const cash = record.cash_amount ?? 0;
          const card = record.card_amount ?? 0;
          const transfer = record.transfer_amount ?? 0;

          let status: PreviewRow["status"] = existingDates.has(saleDate ?? "") ? "actualizará" : "nuevo";
          let error: string | undefined;

          if (!saleDate) {
            status = "error";
            error = "Fecha inválida o vacía (usa YYYY-MM-DD o DD/MM/AAAA)";
          } else if ([cash, card, transfer].some((n) => Number.isNaN(n) || n < 0)) {
            status = "error";
            error = "Efectivo, tarjeta o transferencia no es un número válido ≥ 0";
          }

          return {
            rowIndex: i + 2,
            sale_date: saleDate ?? "",
            num_orders: record.num_orders ?? 0,
            num_products: record.num_products ?? 0,
            cash_amount: cash,
            card_amount: card,
            transfer_amount: transfer,
            notes: record.notes ?? null,
            status,
            error,
            include: status !== "error",
          };
        });
        setRows(mapped);
      },
    });
  }

  function toggleInclude(rowIndex: number) {
    setRows((prev) => prev.map((r) => (r.rowIndex === rowIndex ? { ...r, include: !r.include } : r)));
  }

  async function handleImport() {
    setLoading(true);
    try {
      const toImport = rows.filter((r) => r.include && r.status !== "error");
      const result = await importSales(
        toImport.map(({ sale_date, num_orders, num_products, cash_amount, card_amount, transfer_amount, notes }) => ({
          sale_date,
          num_orders,
          num_products,
          cash_amount,
          card_amount,
          transfer_amount,
          notes,
        }))
      );
      setSummary(result);
      setRows([]);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setLoading(false);
    }
  }

  const newCount = rows.filter((r) => r.status === "nuevo" && r.include).length;
  const updateCount = rows.filter((r) => r.status === "actualizará" && r.include).length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-ink">Importar ventas desde CSV</p>
          <p className="text-xs text-ink-soft">
            Columnas esperadas: Fecha, Órdenes, Productos, Efectivo, Tarjeta, Transferencia, Notas (el total se calcula solo).
          </p>
        </div>
        <Button variant="ghost" onClick={onDone}>Cerrar</Button>
      </div>

      {summary ? (
        <div className="space-y-2 rounded-lg border border-line bg-paper p-4 text-sm">
          <p className="text-ink">
            Listo: <span className="text-pine">{summary.created} creados</span>,{" "}
            <span className="text-gold">{summary.updated} actualizados</span>
            {summary.errors.length > 0 && <span className="text-rust">, {summary.errors.length} con error</span>}.
          </p>
          {summary.errors.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-rust">
              {summary.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <Button onClick={onDone}>Ir a la tabla de ventas</Button>
        </div>
      ) : (
        <>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm"
          />
          {parseError && <p className="mt-2 text-sm text-rust">{parseError}</p>}

          {rows.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill tone="pine">{newCount} nuevos</Pill>
                <Pill tone="gold">{updateCount} actualizarán existentes</Pill>
                {errorCount > 0 && <Pill tone="rust">{errorCount} con error (se omiten)</Pill>}
              </div>
              <div className="max-h-80 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-paper">
                    <tr className="border-b border-line text-xs uppercase text-ink-soft">
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Efectivo</th>
                      <th className="px-3 py-2">Tarjeta</th>
                      <th className="px-3 py-2">Transferencia</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowIndex} className="border-b border-line last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={r.include}
                            disabled={r.status === "error"}
                            onChange={() => toggleInclude(r.rowIndex)}
                          />
                        </td>
                        <td className="px-3 py-2 text-ink">{r.sale_date || `(fila ${r.rowIndex})`}</td>
                        <td className="figure px-3 py-2 text-ink-soft">{r.cash_amount}</td>
                        <td className="figure px-3 py-2 text-ink-soft">{r.card_amount}</td>
                        <td className="figure px-3 py-2 text-ink-soft">{r.transfer_amount}</td>
                        <td className="px-3 py-2">
                          {r.status === "error" ? (
                            <Pill tone="rust">{r.error}</Pill>
                          ) : r.status === "actualizará" ? (
                            <Pill tone="gold">Actualizará</Pill>
                          ) : (
                            <Pill tone="pine">Nuevo</Pill>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={loading || newCount + updateCount === 0}>
                  {loading ? "Importando…" : `Importar ${newCount + updateCount} registros`}
                </Button>
                <Button variant="ghost" onClick={() => setRows([])}>Cancelar</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
