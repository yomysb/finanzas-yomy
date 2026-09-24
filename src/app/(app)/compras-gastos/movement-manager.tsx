"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Pill, Select, Textarea, EmptyState } from "@/components/ui/primitives";
import {
  checkPossibleDuplicate,
  createMovement,
  createSupplierInline,
  attachReceipt,
  voidMovement,
  getReceiptUrl,
} from "./actions";

type MovementType = {
  id: string;
  code: string;
  name: string;
  requires_supplier: boolean;
  requires_category: boolean;
};
type Option = { id: string; name: string };
type Movement = {
  id: string;
  movement_date: string;
  amount: number;
  notes: string | null;
  voided_at: string | null;
  movement_type: { name: string } | null;
  supplier: { name: string } | null;
  category: { name: string } | null;
  payment_method: { name: string } | null;
  attachments: { id: string; file_url: string; file_type: string }[];
};

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function MovementManager({
  businessId,
  movements,
  movementTypes,
  suppliers,
  categories,
  paymentMethods,
}: {
  businessId: string;
  movements: Movement[];
  movementTypes: MovementType[];
  suppliers: Option[];
  categories: Option[];
  paymentMethods: Option[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [movementTypeId, setMovementTypeId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const selectedType = movementTypes.find((t) => t.id === movementTypeId);

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => (a.movement_date < b.movement_date ? 1 : -1)),
    [movements]
  );

  function resetForm() {
    setMovementTypeId("");
    setSupplierId("");
    setNewSupplierName("");
    setAddingSupplier(false);
    setFile(null);
    setDuplicateConfirmed(false);
    setDuplicateWarning(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      setSaving(true);

      let finalSupplierId = supplierId;
      if (selectedType?.requires_supplier && addingSupplier) {
        const created = await createSupplierInline(newSupplierName);
        finalSupplierId = created.id;
      }
      formData.set("supplier_id", finalSupplierId);

      const amount = Number(formData.get("amount") ?? 0);
      const movementDate = String(formData.get("movement_date") ?? "");

      if (!duplicateConfirmed) {
        const isDup = await checkPossibleDuplicate(movementDate, finalSupplierId || null, amount);
        if (isDup) {
          setDuplicateWarning(true);
          setSaving(false);
          return;
        }
      }

      const movementId = await createMovement(formData);

      if (file) {
        const path = `${businessId}/${movementId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file);
        if (uploadError) throw new Error(`Movimiento guardado, pero falló subir el comprobante: ${uploadError.message}`);
        await attachReceipt(movementId, path, file.type);
      }

      form.reset();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleVoid(id: string) {
    const reason = window.prompt("Motivo de la anulación (opcional):") ?? "";
    voidMovement(id, reason).catch((e) => setError(e instanceof Error ? e.message : "Error al anular"));
  }

  async function handleViewReceipt(path: string) {
    try {
      const url = await getReceiptUrl(path);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el comprobante");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-3xl italic text-ink">Compras y gastos</p>
          <p className="text-sm text-ink-soft">Todo lo que sale de dinero del negocio.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Nuevo movimiento"}</Button>
      </div>

      {error && <p className="text-sm text-rust">{error}</p>}

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="movement_date">Fecha *</Label>
              <Input id="movement_date" name="movement_date" type="date" required defaultValue={todayISO()} />
            </div>
            <div>
              <Label htmlFor="movement_type_id">Tipo de movimiento *</Label>
              <Select
                id="movement_type_id"
                name="movement_type_id"
                required
                value={movementTypeId}
                onChange={(e) => {
                  setMovementTypeId(e.target.value);
                  setSupplierId("");
                  setAddingSupplier(false);
                }}
              >
                <option value="">Selecciona…</option>
                {movementTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>

            {selectedType?.requires_supplier && (
              <div className="sm:col-span-2">
                <Label htmlFor="supplier_id">Proveedor</Label>
                {addingSupplier ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Nombre del proveedor"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                    />
                    <Button type="button" variant="ghost" onClick={() => setAddingSupplier(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select id="supplier_id" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                      <option value="">Selecciona…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                    <Button type="button" variant="ghost" onClick={() => setAddingSupplier(true)}>+ Nuevo</Button>
                  </div>
                )}
              </div>
            )}

            {selectedType?.requires_category && (
              <div>
                <Label htmlFor="category_id">Categoría</Label>
                <Select id="category_id" name="category_id" defaultValue="">
                  <option value="">Selecciona…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="payment_method_id">Forma de pago *</Label>
              <Select id="payment_method_id" name="payment_method_id" required defaultValue="">
                <option value="">Selecciona…</option>
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">Monto *</Label>
              <Input id="amount" name="amount" type="number" min={0.01} step="0.01" required />
            </div>

            <div>
              <Label htmlFor="receipt">Foto o PDF del comprobante</Label>
              <input
                id="receipt"
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>

            {duplicateWarning && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-gold/40 bg-gold-soft/40 p-4 sm:col-span-2">
                <p className="text-sm text-ink">
                  Ya existe un movimiento con la misma fecha, proveedor y monto. ¿Aun así quieres guardarlo?
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setDuplicateConfirmed(true);
                    setDuplicateWarning(false);
                  }}
                >
                  Guardar de todos modos
                </Button>
              </div>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar movimiento"}</Button>
            </div>
          </form>
        </Card>
      )}

      {sortedMovements.length === 0 ? (
        <EmptyState title="Todavía no hay movimientos" description="Agrega el primero con el botón de arriba." />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Forma de pago</th>
                <th className="px-4 py-3 font-medium">Monto</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sortedMovements.map((m) => (
                <tr key={m.id} className={`border-b border-line last:border-0 hover:bg-paper ${m.voided_at ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-ink">{m.movement_date}</td>
                  <td className="px-4 py-3 text-ink-soft">{m.movement_type?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{m.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{m.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{m.payment_method?.name ?? "—"}</td>
                  <td className="figure px-4 py-3 text-ink">{money(m.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3 text-xs">
                      {m.attachments.length > 0 && (
                        <button
                          className="text-ink-soft underline underline-offset-2 hover:text-ink"
                          onClick={() => handleViewReceipt(m.attachments[0].file_url)}
                        >
                          Ver comprobante
                        </button>
                      )}
                      {m.voided_at ? (
                        <Pill tone="rust">Anulado</Pill>
                      ) : (
                        <button className="text-ink-soft underline underline-offset-2 hover:text-rust" onClick={() => handleVoid(m.id)}>
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
