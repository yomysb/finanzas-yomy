"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label, Pill, Select, Textarea, EmptyState } from "@/components/ui/primitives";
import { createSupplier, updateSupplier, toggleSupplierActive } from "./actions";

type BusinessType = { id: string; name: string };
type Supplier = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  contact: string | null;
  business_type_id: string | null;
  notes: string | null;
  is_active: boolean;
};

export default function SupplierManager({
  suppliers,
  businessTypes,
}: {
  suppliers: Supplier[];
  businessTypes: BusinessType[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = suppliers.filter((s) => showInactive || s.is_active);
  const typeName = (id: string | null) => businessTypes.find((t) => t.id === id)?.name ?? "—";

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createSupplier(formData);
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateSupplier(id, formData);
        setEditingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-3xl italic text-ink">Proveedores</p>
          <p className="text-sm text-ink-soft">Un solo registro por proveedor — evita duplicados con nombres distintos.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inactivos
          </label>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Nuevo proveedor"}</Button>
        </div>
      </div>

      {error && <p className="text-sm text-rust">{error}</p>}

      {showForm && (
        <Card className="p-5">
          <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Nombre comercial *</Label>
              <Input id="name" name="name" required placeholder="Cremería La Michoacana" />
            </div>
            <div>
              <Label htmlFor="business_type_id">Giro</Label>
              <Select id="business_type_id" name="business_type_id" defaultValue="">
                <option value="">Sin especificar</option>
                {businessTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="legal_name">Razón social</Label>
              <Input id="legal_name" name="legal_name" />
            </div>
            <div>
              <Label htmlFor="tax_id">RFC</Label>
              <Input id="tax_id" name="tax_id" />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" />
            </div>
            <div>
              <Label htmlFor="contact">Contacto</Label>
              <Input id="contact" name="contact" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isPending}>{isPending ? "Guardando…" : "Guardar proveedor"}</Button>
            </div>
          </form>
        </Card>
      )}

      {visible.length === 0 ? (
        <EmptyState title="Todavía no hay proveedores" description="Agrega el primero con el botón de arriba." />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase tracking-normal text-ink-soft">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Giro</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) =>
                editingId === s.id ? (
                  <tr key={s.id} className="border-b border-line bg-paper">
                    <td colSpan={5} className="p-4">
                      <form action={(fd) => handleUpdate(s.id, fd)} className="grid gap-3 sm:grid-cols-2">
                        <Input name="name" defaultValue={s.name} required placeholder="Nombre comercial" />
                        <Select name="business_type_id" defaultValue={s.business_type_id ?? ""}>
                          <option value="">Sin especificar</option>
                          {businessTypes.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </Select>
                        <Input name="legal_name" defaultValue={s.legal_name ?? ""} placeholder="Razón social" />
                        <Input name="tax_id" defaultValue={s.tax_id ?? ""} placeholder="RFC" />
                        <Input name="phone" defaultValue={s.phone ?? ""} placeholder="Teléfono" />
                        <Input name="contact" defaultValue={s.contact ?? ""} placeholder="Contacto" />
                        <Textarea name="notes" defaultValue={s.notes ?? ""} rows={2} className="sm:col-span-2" />
                        <div className="flex gap-2 sm:col-span-2">
                          <Button type="submit" disabled={isPending}>Guardar</Button>
                          <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-3">
                      <p className="text-ink">{s.name}</p>
                      {s.legal_name && <p className="text-xs text-ink-soft">{s.legal_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{typeName(s.business_type_id)}</td>
                    <td className="px-4 py-3 text-ink-soft">{s.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Pill tone={s.is_active ? "pine" : "neutral"}>{s.is_active ? "Activo" : "Inactivo"}</Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3 text-xs">
                        <button className="text-ink-soft underline underline-offset-2 hover:text-ink" onClick={() => setEditingId(s.id)}>
                          Editar
                        </button>
                        <button
                          className="text-ink-soft underline underline-offset-2 hover:text-rust"
                          onClick={() => startTransition(() => toggleSupplierActive(s.id, !s.is_active))}
                        >
                          {s.is_active ? "Desactivar" : "Reactivar"}
                        </button>
                      </div>
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
