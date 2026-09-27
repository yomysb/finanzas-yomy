"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button, Card, Input, Label, Pill, Textarea, EmptyState } from "@/components/ui/primitives";
import { createSale, updateSale, voidSale, findSaleByDate } from "./actions";
import { todayISO } from "@/lib/date";
import { exportXLSX, exportCSV, exportPDF, type Column } from "@/lib/export";
import ImportSales from "./import-sales";
import { calcIva16FromTotal } from "@/lib/tax";

type Sale = {
  id: string;
  sale_date: string;
  num_orders: number;
  num_products: number;
  cash_amount: number;
  card_amount: number;
  transfer_amount: number;
  total_amount: number;
  pos_reported_total: number | null;
  pos_difference: number | null;
  sales_iva_amount: number;
  notes: string | null;
  voided_at: string | null;
};

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function SaleManager({ sales }: { sales: Sale[] }) {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saleDate, setSaleDate] = useState(todayISO());
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cashRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);
  const transferRef = useRef<HTMLInputElement>(null);
  const ivaRef = useRef<HTMLInputElement>(null);

  function fillIva16(refs: { cash: HTMLInputElement | null; card: HTMLInputElement | null; transfer: HTMLInputElement | null; iva: HTMLInputElement | null }) {
    const total =
      Number(refs.cash?.value ?? 0) + Number(refs.card?.value ?? 0) + Number(refs.transfer?.value ?? 0);
    if (refs.iva) refs.iva.value = String(calcIva16FromTotal(total));
  }

  const editCashRef = useRef<HTMLInputElement>(null);
  const editCardRef = useRef<HTMLInputElement>(null);
  const editTransferRef = useRef<HTMLInputElement>(null);
  const editIvaRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => [...sales].sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1)),
    [sales]
  );

  const saleColumns: Column<Sale>[] = [
    { key: "sale_date", label: "Fecha" },
    { key: "num_orders", label: "Tickets" },
    { key: "num_products", label: "Productos" },
    { key: "cash_amount", label: "Efectivo", format: (v) => Number(v).toFixed(2) },
    { key: "card_amount", label: "Tarjeta", format: (v) => Number(v).toFixed(2) },
    { key: "transfer_amount", label: "Transferencia", format: (v) => Number(v).toFixed(2) },
    { key: "total_amount", label: "Total", format: (v) => Number(v).toFixed(2) },
  ];

  async function handleDateBlur(date: string) {
    setSaleDate(date);
    if (!date) return;
    const existingId = await findSaleByDate(date);
    setDuplicateId(existingId);
  }

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createSale(formData);
        setShowForm(false);
        setDuplicateId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateSale(id, formData);
        setEditingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleVoid(id: string) {
    const reason = window.prompt("Motivo de la anulación (opcional):") ?? "";
    startTransition(async () => {
      try {
        await voidSale(id, reason);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al anular");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold tracking-tight text-3xl text-ink">Ventas</p>
          <p className="text-sm text-ink-soft">Un registro por día. El total se calcula solo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setShowForm((v) => !v);
              setDuplicateId(null);
            }}
          >
            {showForm ? "Cancelar" : "Nueva venta"}
          </Button>
          <Button variant="ghost" onClick={() => setShowImport((v) => !v)}>
            {showImport ? "Cancelar" : "Importar CSV"}
          </Button>
          <Button variant="ghost" onClick={() => exportXLSX(visible, saleColumns, "ventas")}>XLSX</Button>
          <Button variant="ghost" onClick={() => exportCSV(visible, saleColumns, "ventas")}>CSV</Button>
          <Button variant="ghost" onClick={() => exportPDF("Reporte de ventas", visible, saleColumns, "ventas")}>PDF</Button>
        </div>
      </div>

      {error && <p className="text-sm text-rust">{error}</p>}

      {showImport && <ImportSales onDone={() => setShowImport(false)} />}

      {showForm && (
        <Card className="p-5">
          {duplicateId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold-soft/40 p-4">
              <p className="text-sm text-ink">
                Ya existe una venta para el {saleDate}. Edítala desde la tabla de abajo en vez de crear otra.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(duplicateId);
                  setDuplicateId(null);
                }}
              >
                Ir a editarla
              </Button>
            </div>
          ) : (
            <form action={handleCreate} className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="sale_date">Fecha *</Label>
                <Input
                  id="sale_date"
                  name="sale_date"
                  type="date"
                  required
                  defaultValue={saleDate}
                  onBlur={(e) => handleDateBlur(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="num_orders">Número de órdenes</Label>
                <Input id="num_orders" name="num_orders" type="number" min={0} step={1} defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="num_products">Productos vendidos</Label>
                <Input id="num_products" name="num_products" type="number" min={0} step={1} defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="cash_amount">Efectivo</Label>
                <Input ref={cashRef} id="cash_amount" name="cash_amount" type="number" min={0} step="0.01" defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="card_amount">Tarjeta</Label>
                <Input ref={cardRef} id="card_amount" name="card_amount" type="number" min={0} step="0.01" defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="transfer_amount">Transferencia</Label>
                <Input ref={transferRef} id="transfer_amount" name="transfer_amount" type="number" min={0} step="0.01" defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="pos_reported_total">Total según POS (opcional)</Label>
                <Input id="pos_reported_total" name="pos_reported_total" type="number" min={0} step="0.01" />
              </div>
              <div>
                <Label htmlFor="sales_iva_amount">IVA de venta (opcional)</Label>
                <div className="flex gap-2">
                  <Input ref={ivaRef} id="sales_iva_amount" name="sales_iva_amount" type="number" min={0} step="0.01" placeholder="0.00" />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      fillIva16({ cash: cashRef.current, card: cardRef.current, transfer: transferRef.current, iva: ivaRef.current })
                    }
                  >
                    Calcular 16%
                  </Button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" name="notes" rows={1} />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={isPending}>{isPending ? "Guardando…" : "Guardar venta"}</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {visible.length === 0 ? (
        <EmptyState title="Todavía no hay ventas registradas" description="Agrega la primera con el botón de arriba." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tickets</th>
                <th className="px-4 py-3 font-medium">Efectivo</th>
                <th className="px-4 py-3 font-medium">Tarjeta</th>
                <th className="px-4 py-3 font-medium">Transferencia</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Dif. POS</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) =>
                editingId === s.id ? (
                  <tr key={s.id} className="border-b border-line bg-paper">
                    <td colSpan={8} className="p-4">
                      <form action={(fd) => handleUpdate(s.id, fd)} className="grid gap-3 sm:grid-cols-3">
                        <Input name="num_orders" type="number" min={0} defaultValue={s.num_orders} placeholder="Órdenes" />
                        <Input name="num_products" type="number" min={0} defaultValue={s.num_products} placeholder="Productos" />
                        <div />
                        <Input ref={editCashRef} name="cash_amount" type="number" min={0} step="0.01" defaultValue={s.cash_amount} placeholder="Efectivo" />
                        <Input ref={editCardRef} name="card_amount" type="number" min={0} step="0.01" defaultValue={s.card_amount} placeholder="Tarjeta" />
                        <Input ref={editTransferRef} name="transfer_amount" type="number" min={0} step="0.01" defaultValue={s.transfer_amount} placeholder="Transferencia" />
                        <Input name="pos_reported_total" type="number" min={0} step="0.01" defaultValue={s.pos_reported_total ?? ""} placeholder="Total POS" />
                        <div className="flex gap-2">
                          <Input ref={editIvaRef} name="sales_iva_amount" type="number" min={0} step="0.01" defaultValue={s.sales_iva_amount ?? ""} placeholder="IVA de venta" />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              fillIva16({ cash: editCashRef.current, card: editCardRef.current, transfer: editTransferRef.current, iva: editIvaRef.current })
                            }
                          >
                            16%
                          </Button>
                        </div>
                        <Textarea name="notes" defaultValue={s.notes ?? ""} rows={1} className="sm:col-span-2" />
                        <div className="flex gap-2 sm:col-span-3">
                          <Button type="submit" disabled={isPending}>Guardar</Button>
                          <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className={`border-b border-line last:border-0 hover:bg-paper ${s.voided_at ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-ink">
                      {s.sale_date}
                      {s.voided_at && <Pill tone="rust">Anulada</Pill>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{s.num_orders}</td>
                    <td className="figure px-4 py-3 text-ink-soft">{money(s.cash_amount)}</td>
                    <td className="figure px-4 py-3 text-ink-soft">{money(s.card_amount)}</td>
                    <td className="figure px-4 py-3 text-ink-soft">{money(s.transfer_amount)}</td>
                    <td className="figure px-4 py-3 text-ink">{money(s.total_amount)}</td>
                    <td className="figure px-4 py-3">
                      {s.pos_reported_total == null ? (
                        <span className="text-ink-soft">—</span>
                      ) : (
                        <Pill tone={s.pos_difference === 0 ? "pine" : "rust"}>{money(s.pos_difference ?? 0)}</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!s.voided_at && (
                        <div className="flex justify-end gap-3 text-xs">
                          <button className="text-ink-soft underline underline-offset-2 hover:text-ink" onClick={() => setEditingId(s.id)}>
                            Editar
                          </button>
                          <button className="text-ink-soft underline underline-offset-2 hover:text-rust" onClick={() => handleVoid(s.id)}>
                            Anular
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
